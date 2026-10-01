import { readFile } from "node:fs/promises";
import path from "node:path";
import type { UniversityCrawlConfig, UniversityDirectoryEntry } from "./source-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return value;
}

export function requiredHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be HTTPS`);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new Error(`${label} must be HTTPS`);
  return value;
}

export function parsePageSource(value: unknown, label: string) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  if (typeof value.key !== "string" || !value.key) throw new Error(`${label}.key is required`);
  const url = requiredHttpsUrl(value.url, `${label}.url`);
  if (typeof value.fileName !== "string" || !/^[\w.-]+$/.test(value.fileName) || value.fileName === "." || value.fileName === "..") {
    throw new Error(`${label}.fileName is invalid`);
  }
  if (typeof value.required !== "boolean") throw new Error(`${label}.required must be boolean`);
  if (value.format !== undefined && value.format !== "html" && value.format !== "xml") {
    throw new Error(`${label}.format must be html or xml`);
  }
  return {
    key: value.key,
    url,
    fileName: value.fileName,
    required: value.required,
    ...(value.format ? { format: value.format as "html" | "xml" } : {}),
  };
}

export function parseAllowedOrigins(value: unknown, label: string): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} is required`);
  return value.map((origin, index) => {
    if (typeof origin !== "string") throw new Error(`${label}[${index}] is invalid`);
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`${label}[${index}] must be an HTTPS origin`);
    }
    return url.origin;
  });
}

function parseUniversityCrawlConfig(value: unknown, label: string): UniversityCrawlConfig {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  if (typeof value.adapter !== "string" || !value.adapter) throw new Error(`${label}.adapter is required`);
  const discoverySource = parsePageSource(value.discoverySource, `${label}.discoverySource`);
  const allowedOrigins = parseAllowedOrigins(value.allowedOrigins, `${label}.allowedOrigins`);
  const robotsUrl =
    value.robotsUrl === undefined ? undefined : requiredHttpsUrl(value.robotsUrl, `${label}.robotsUrl`);
  if (!allowedOrigins.includes(new URL(discoverySource.url).origin)) {
    throw new Error(`${label}.discoverySource.url origin must be listed in ${label}.allowedOrigins`);
  }
  if (robotsUrl !== undefined && !allowedOrigins.includes(new URL(robotsUrl).origin)) {
    throw new Error(`${label}.robotsUrl origin must be listed in ${label}.allowedOrigins`);
  }
  return {
    adapter: value.adapter,
    discoverySource,
    requestDelayMs: requiredNumber(value.requestDelayMs, `${label}.requestDelayMs`),
    robotsUrl,
    allowedOrigins,
  };
}

export function parseUniversityDirectory(value: unknown, label: string): UniversityDirectoryEntry[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be a JSON array`);
  const universities = value.map((entry, index): UniversityDirectoryEntry => {
    const entryLabel = `${label}[${index}]`;
    if (!isRecord(entry)) throw new Error(`${entryLabel} must be an object`);
    if (typeof entry.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(entry.id)) {
      throw new Error(`${entryLabel} has an invalid id`);
    }
    if (typeof entry.university !== "string" || !entry.university) {
      throw new Error(`${entryLabel}.university is required`);
    }
    if (entry.region !== "us" && entry.region !== "world") {
      throw new Error(`${entryLabel}.region must be us or world`);
    }
    if (!Number.isInteger(entry.priority) || Number(entry.priority) < 1 || Number(entry.priority) > 20) {
      throw new Error(`${entryLabel}.priority must be an integer from 1 through 20`);
    }
    const catalogUrl = requiredHttpsUrl(entry.catalogUrl, `${entryLabel}.catalogUrl`);
    if (entry.support !== "unverified" && entry.support !== "supported" && entry.support !== "unsupported") {
      throw new Error(`${entryLabel}.support must be unverified, supported, or unsupported`);
    }
    if (typeof entry.enabled !== "boolean") throw new Error(`${entryLabel}.enabled must be boolean`);
    if (entry.enabled && entry.support !== "supported") {
      throw new Error(`${entryLabel} can be enabled only when support is supported`);
    }
    if (entry.crawl !== undefined && entry.support !== "supported") {
      throw new Error(`${entryLabel}.crawl is only valid when support is supported`);
    }
    if (entry.enabled && entry.crawl === undefined) {
      throw new Error(`${entryLabel}.enabled requires crawl config`);
    }
    const crawl =
      entry.crawl === undefined ? undefined : parseUniversityCrawlConfig(entry.crawl, `${entryLabel}.crawl`);
    return {
      id: entry.id,
      university: entry.university,
      region: entry.region,
      priority: Number(entry.priority),
      catalogUrl,
      support: entry.support,
      enabled: entry.enabled,
      crawl,
    };
  });
  const ids = new Set<string>();
  const priorities = new Set<string>();
  for (const university of universities) {
    if (ids.has(university.id)) throw new Error(`Duplicate university id: ${university.id}`);
    ids.add(university.id);
    const priority = `${university.region}:${university.priority}`;
    if (priorities.has(priority)) {
      throw new Error(`Duplicate university priority: ${university.region} ${university.priority}`);
    }
    priorities.add(priority);
  }
  return universities.sort((a, b) =>
    a.region === b.region ? a.priority - b.priority : a.region === "us" ? -1 : 1,
  );
}

export function enabledUniversities(universities: UniversityDirectoryEntry[]): UniversityDirectoryEntry[] {
  return universities.filter((university) => university.enabled);
}

function validateProductionUniversityDirectory(
  universities: UniversityDirectoryEntry[],
  label: string,
): void {
  for (const region of ["us", "world"] as const) {
    const priorities = universities.filter((entry) => entry.region === region).map((entry) => entry.priority);
    if (priorities.length !== 20 || priorities.some((priority, index) => priority !== index + 1)) {
      throw new Error(`${label} must contain exactly 20 ${region} entries with priorities exactly 1 through 20`);
    }
  }
}

export async function loadUniversityDirectory(
  filePath = path.join(process.cwd(), "catalog-service", "universities.json"),
): Promise<UniversityDirectoryEntry[]> {
  const label = path.basename(filePath);
  const universities = parseUniversityDirectory(JSON.parse(await readFile(filePath, "utf8")), label);
  validateProductionUniversityDirectory(universities, label);
  return universities;
}
