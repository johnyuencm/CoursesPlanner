import type { CatalogSourceDefinition, PageSource } from "./source-types";
import { parseRobots, pathDisallowed, type RobotsRules } from "./robots";

export const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

type FetchImplementation = typeof fetch;

export interface FetchResult {
  html: string;
  fromNetwork: boolean;
  notModified: boolean;
  fetchedAt: string;
  etag?: string;
  lastModified?: string;
}

interface Waiter {
  (): Promise<void>;
}

const sleep = (milliseconds: number) =>
  milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();

export function createTurnWaiter(delayMs: number): Waiter {
  let lastRequestAt = 0;
  return async () => {
    const remaining = delayMs - (Date.now() - lastRequestAt);
    if (remaining > 0) await sleep(remaining);
    lastRequestAt = Date.now();
  };
}

export function assertAllowedUrl(source: CatalogSourceDefinition, target: string): URL {
  const url = new URL(target);
  if (url.protocol !== "https:") throw new Error(`Refused non-HTTPS catalog URL ${target}`);
  if (!source.allowedOrigins.includes(url.origin)) {
    throw new Error(`Refused catalog URL outside allowlist: ${target}`);
  }
  const blocked = source.disallowedPathPatterns.some((pattern) => new RegExp(pattern, "i").test(url.pathname));
  if (blocked) throw new Error(`Refused catalog path ${url.pathname}`);
  return url;
}

export async function loadRobots(
  source: CatalogSourceDefinition,
  fetchImpl: FetchImplementation,
  waitForTurn: Waiter,
  cache?: RobotsRules,
  now = () => new Date(),
): Promise<RobotsRules> {
  if (!source.robotsUrl) return cache ?? { fetchedAt: now().toISOString(), disallowed: [] };
  if (cache && now().getTime() - Date.parse(cache.fetchedAt) < 24 * 60 * 60 * 1_000) return cache;
  assertAllowedUrl(source, source.robotsUrl);
  await waitForTurn();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), source.requestTimeoutMs);
  try {
    const response = await fetchImpl(source.robotsUrl, {
      headers: { Accept: "text/plain", "User-Agent": source.userAgent },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`robots.txt request failed (${response.status})`);
    const text = await response.text();
    if (text.length > 256 * 1024) throw new Error("robots.txt exceeds 256 KB");
    return { fetchedAt: now().toISOString(), disallowed: parseRobots(text) };
  } finally {
    clearTimeout(timeout);
  }
}

async function responseText(response: Response, url: string): Promise<string> {
  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_RESPONSE_BYTES) {
    throw new Error(`Response from ${url} exceeds ${MAX_RESPONSE_BYTES} bytes`);
  }
  if (!response.body) throw new Error(`Response from ${url} has no body`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error(`Response from ${url} exceeds ${MAX_RESPONSE_BYTES} bytes`);
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

export async function fetchOfficialHtml(
  definition: CatalogSourceDefinition,
  page: PageSource,
  fetchImpl: FetchImplementation,
  waitForTurn: Waiter,
  options: { etag?: string; lastModified?: string; robots?: RobotsRules; now?: () => Date } = {},
): Promise<FetchResult> {
  const now = options.now ?? (() => new Date());
  let currentUrl = page.url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const parsed = assertAllowedUrl(definition, currentUrl);
    if (options.robots && pathDisallowed(parsed.pathname, options.robots.disallowed)) {
      throw new Error(`robots.txt disallows ${parsed.pathname}`);
    }
    await waitForTurn();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), definition.requestTimeoutMs);
    try {
      const headers: Record<string, string> = {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": definition.userAgent,
      };
      if (options.etag) headers["If-None-Match"] = options.etag;
      if (options.lastModified) headers["If-Modified-Since"] = options.lastModified;
      const response = await fetchImpl(currentUrl, { headers, redirect: "manual", signal: controller.signal });
      if (response.status === 304) {
        return {
          html: "",
          fromNetwork: false,
          notModified: true,
          fetchedAt: now().toISOString(),
          etag: options.etag,
          lastModified: options.lastModified,
        };
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error(`Unexpected redirect from ${currentUrl}`);
        currentUrl = new URL(location, currentUrl).toString();
        continue;
      }
      if (!response.ok) throw new Error(`Catalog request failed (${response.status}) for ${currentUrl}`);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (contentType && !contentType.includes("html")) {
        throw new Error(`Expected HTML from ${currentUrl}, received ${contentType}`);
      }
      const html = await responseText(response, currentUrl);
      if (!/<(?:!doctype\s+html|html)\b/i.test(html)) {
        throw new Error(`Response from ${currentUrl} is not an HTML document`);
      }
      return {
        html,
        fromNetwork: true,
        notModified: false,
        fetchedAt: now().toISOString(),
        etag: response.headers.get("etag") ?? undefined,
        lastModified: response.headers.get("last-modified") ?? undefined,
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Catalog request timed out for ${currentUrl}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Too many redirects for ${page.url}`);
}
