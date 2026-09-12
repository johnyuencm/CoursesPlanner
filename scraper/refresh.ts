import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Catalog } from "../lib/types";
import { validateCatalog } from "../lib/catalog";
import {
  PROGRAM_URL,
  buildCourseGraph,
  parseCourses,
  parseProgramRequirements,
} from "./parser";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const REQUEST_DELAY_MS = 750;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const CATALOG_ORIGIN = "https://catalog.northeastern.edu";

interface Source {
  key: string;
  url: string;
  fileName: string;
  required: boolean;
}

const PROGRAM_SOURCE: Source = {
  key: "program",
  url: PROGRAM_URL,
  fileName: "mscs-sea-program.html",
  required: true,
};

export const SUBJECT_SOURCES = {
  CS: {
    key: "CS",
    url: `${CATALOG_ORIGIN}/course-descriptions/cs/`,
    fileName: "cs.html",
    required: true,
  },
  CY: {
    key: "CY",
    url: `${CATALOG_ORIGIN}/course-descriptions/cy/`,
    fileName: "cy.html",
    required: false,
  },
  DS: {
    key: "DS",
    url: `${CATALOG_ORIGIN}/course-descriptions/ds/`,
    fileName: "ds.html",
    required: false,
  },
  DADS: {
    key: "DADS",
    url: `${CATALOG_ORIGIN}/course-descriptions/dads/`,
    fileName: "dads.html",
    required: false,
  },
} satisfies Record<string, Source>;

type FetchImplementation = typeof fetch;

export interface RefreshOptions {
  force?: boolean;
  rootDir?: string;
  fetchImpl?: FetchImplementation;
  delayMs?: number;
  now?: () => Date;
}

interface CacheEntry {
  url: string;
  fetchedAt: string;
}

interface CacheMetadata {
  version: 1;
  sources: Record<string, CacheEntry>;
}

interface LoadedSource {
  source: Source;
  html: string;
  fetchedAt: string;
  fromNetwork: boolean;
}

const sleep = (milliseconds: number) =>
  milliseconds > 0 ? new Promise((resolve) => setTimeout(resolve, milliseconds)) : Promise.resolve();

async function readCacheMetadata(filePath: string): Promise<CacheMetadata> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "version" in parsed &&
      parsed.version === 1 &&
      "sources" in parsed &&
      typeof parsed.sources === "object" &&
      parsed.sources !== null
    ) {
      return parsed as CacheMetadata;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      // A malformed sidecar should not make otherwise valid official HTML unusable.
    }
  }
  return { version: 1, sources: {} };
}

async function readBoundedFile(filePath: string): Promise<string> {
  const details = await stat(filePath);
  if (details.size > MAX_RESPONSE_BYTES) {
    throw new Error(`Cached response exceeds ${MAX_RESPONSE_BYTES} bytes: ${filePath}`);
  }
  return readFile(filePath, "utf8");
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
  text += decoder.decode();
  return text;
}

function safeRedirect(currentUrl: string, location: string): string {
  const redirected = new URL(location, currentUrl);
  if (
    redirected.protocol !== "https:" ||
    redirected.origin !== CATALOG_ORIGIN ||
    /^\/(?:search|xsearch|course-search|archive)(?:\/|$)/i.test(redirected.pathname)
  ) {
    throw new Error(`Refused catalog redirect to ${redirected.toString()}`);
  }
  return redirected.toString();
}

async function fetchOfficialHtml(
  source: Source,
  fetchImpl: FetchImplementation,
  waitForTurn: () => Promise<void>,
): Promise<string> {
  let currentUrl = source.url;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    await waitForTurn();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetchImpl(currentUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "CoursesPlanner/1.0 (local educational catalog cache)",
        },
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 3) throw new Error(`Unexpected redirect from ${currentUrl}`);
        currentUrl = safeRedirect(currentUrl, location);
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
      return html;
    } catch (error) {
      if (controller.signal.aborted) throw new Error(`Catalog request timed out for ${currentUrl}`);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(`Too many redirects for ${source.url}`);
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, filePath);
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export async function refreshCatalog(options: RefreshOptions = {}): Promise<Catalog> {
  const force = options.force ?? false;
  const rootDir = options.rootDir ?? process.cwd();
  const fetchImpl = options.fetchImpl ?? fetch;
  const delayMs = options.delayMs ?? REQUEST_DELAY_MS;
  const now = options.now ?? (() => new Date());
  const rawDir = path.join(rootDir, "data", "raw");
  const metadataPath = path.join(rawDir, ".catalog-cache.json");
  const metadata = await readCacheMetadata(metadataPath);
  const warnings: string[] = [];
  let lastRequestAt = 0;

  const waitForTurn = async () => {
    const remaining = delayMs - (Date.now() - lastRequestAt);
    if (remaining > 0) await sleep(remaining);
    lastRequestAt = Date.now();
  };

  const loadSource = async (source: Source): Promise<LoadedSource> => {
    const cachePath = path.join(rawDir, source.fileName);
    let cachedHtml: string | undefined;
    let cacheTimestamp: string | undefined;
    try {
      const details = await stat(cachePath);
      cachedHtml = await readBoundedFile(cachePath);
      const recorded = metadata.sources[source.key];
      cacheTimestamp =
        recorded?.url === source.url && !Number.isNaN(Date.parse(recorded.fetchedAt))
          ? recorded.fetchedAt
          : details.mtime.toISOString();
      const fresh = now().getTime() - Date.parse(cacheTimestamp) <= CACHE_TTL_MS;
      if (!force && fresh) {
        return { source, html: cachedHtml, fetchedAt: cacheTimestamp, fromNetwork: false };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    try {
      const html = await fetchOfficialHtml(source, fetchImpl, waitForTurn);
      return { source, html, fetchedAt: now().toISOString(), fromNetwork: true };
    } catch (error) {
      if (cachedHtml && cacheTimestamp) {
        warnings.push(
          `Using stale cache for ${source.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return { source, html: cachedHtml, fetchedAt: cacheTimestamp, fromNetwork: false };
      }
      throw error;
    }
  };

  const loaded: LoadedSource[] = [];
  const programSource = await loadSource(PROGRAM_SOURCE);
  loaded.push(programSource);
  const builtAt = now().toISOString();
  const requirements = parseProgramRequirements(programSource.html, PROGRAM_URL, builtAt);

  const listedCodes = [
    ...requirements.coreCourses,
    ...requirements.eligibleElectives,
    ...requirements.breadthRequirements.categories.flatMap((category) => category.courses),
  ];
  const subjects = [...new Set(listedCodes.map((code) => code.split(" ")[0]))];
  for (const subject of subjects) {
    const source = SUBJECT_SOURCES[subject as keyof typeof SUBJECT_SOURCES];
    if (!source) throw new Error(`No approved bulk catalog source configured for subject ${subject}`);
    try {
      loaded.push(await loadSource(source));
    } catch (error) {
      if (source.required) throw error;
      warnings.push(
        `Could not load optional ${subject} bulk catalog; listed courses remain uncertain placeholders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const parsedCourses = loaded
    .filter((entry) => entry.source.key !== PROGRAM_SOURCE.key)
    .flatMap((entry) => parseCourses(entry.html, entry.source.url));
  const courses = buildCourseGraph(parsedCourses, requirements);
  const placeholderCount = courses.filter((course) => course.title.startsWith("External course (")).length;
  const uncertainCourseCount = courses.filter((course) => course.uncertainties.length > 0).length;
  if (placeholderCount) {
    warnings.push(`${placeholderCount} external dependency or unavailable department courses have placeholder details.`);
  }
  if (uncertainCourseCount) {
    warnings.push(`${uncertainCourseCount} courses contain unavailable or conservatively parsed catalog clauses.`);
  }
  warnings.push("Topic labels are keyword-based recommendations, not official catalog rules.");

  const catalog: Catalog = {
    courses,
    requirements,
    lastUpdated: builtAt,
    sources: loaded.map(({ source }) => source.url),
    warnings: [...new Set([...requirements.uncertainties, ...warnings])],
  };
  validateCatalog(catalog);

  for (const entry of loaded.filter(({ fromNetwork }) => fromNetwork)) {
    await atomicWrite(path.join(rawDir, entry.source.fileName), entry.html);
  }
  const nextMetadata: CacheMetadata = {
    version: 1,
    sources: Object.fromEntries(
      loaded.map(({ source, fetchedAt }) => [source.key, { url: source.url, fetchedAt }]),
    ),
  };
  await atomicWrite(metadataPath, json(nextMetadata));

  const dataDir = path.join(rootDir, "data");
  await atomicWrite(path.join(dataDir, "courses.json"), json(courses));
  await atomicWrite(path.join(dataDir, "requirements.json"), json(requirements));
  await atomicWrite(path.join(dataDir, "catalog.json"), json(catalog));
  return catalog;
}

async function main() {
  const arguments_ = process.argv.slice(2);
  const unexpected = arguments_.filter((argument) => argument !== "--force");
  if (unexpected.length) throw new Error(`Unknown catalog refresh option: ${unexpected.join(" ")}`);
  const catalog = await refreshCatalog({ force: arguments_.includes("--force") });
  process.stdout.write(
    `Catalog refreshed: ${catalog.courses.length} courses, ${catalog.requirements.catalogYear}, ${catalog.warnings.length} warnings.\n`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
