import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getAdapter } from "./adapters";
import type { CatalogSourceDefinition, PageSource } from "./source-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parsePageSource(value: unknown, label: string): PageSource {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  if (typeof value.key !== "string" || !value.key) throw new Error(`${label}.key is required`);
  if (typeof value.url !== "string") throw new Error(`${label}.url is required`);
  const url = new URL(value.url);
  if (url.protocol !== "https:") throw new Error(`${label}.url must be HTTPS`);
  if (typeof value.fileName !== "string" || !/^[\w.-]+$/.test(value.fileName)) {
    throw new Error(`${label}.fileName is invalid`);
  }
  if (typeof value.required !== "boolean") throw new Error(`${label}.required must be boolean`);
  return {
    key: value.key,
    url: value.url,
    fileName: value.fileName,
    required: value.required,
  };
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return value;
}

export function parseSourceDefinition(value: unknown, fileName: string): CatalogSourceDefinition {
  if (!isRecord(value)) throw new Error(`${fileName} must be a JSON object`);
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,80}$/.test(value.id)) {
    throw new Error(`${fileName} has an invalid id`);
  }
  const requiredStrings = ["university", "program", "adapter", "userAgent"] as const;
  for (const field of requiredStrings) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new Error(`${fileName} is missing ${field}`);
    }
  }
  getAdapter(String(value.adapter));
  if (typeof value.enabled !== "boolean") throw new Error(`${fileName}.enabled must be boolean`);
  if (!Array.isArray(value.allowedOrigins) || value.allowedOrigins.length === 0) {
    throw new Error(`${fileName}.allowedOrigins is required`);
  }
  const allowedOrigins = value.allowedOrigins.map((origin, index) => {
    if (typeof origin !== "string") throw new Error(`${fileName}.allowedOrigins[${index}] is invalid`);
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
      throw new Error(`${fileName}.allowedOrigins[${index}] must be an HTTPS origin`);
    }
    return url.origin;
  });
  if (!Array.isArray(value.disallowedPathPatterns) || !value.disallowedPathPatterns.every((item) => typeof item === "string")) {
    throw new Error(`${fileName}.disallowedPathPatterns must be an array of strings`);
  }
  if (value.robotsUrl !== undefined) {
    if (typeof value.robotsUrl !== "string") throw new Error(`${fileName}.robotsUrl is invalid`);
    const robots = new URL(value.robotsUrl);
    if (robots.protocol !== "https:") throw new Error(`${fileName}.robotsUrl must be HTTPS`);
  }
  const programSource = parsePageSource(value.programSource, `${fileName}.programSource`);
  if (!isRecord(value.subjectSources)) throw new Error(`${fileName}.subjectSources must be an object`);
  const subjectSources: Record<string, PageSource> = {};
  for (const [subject, source] of Object.entries(value.subjectSources)) {
    if (!/^[A-Z]{2,6}$/.test(subject)) throw new Error(`${fileName}.subjectSources has an invalid key: ${subject}`);
    subjectSources[subject] = parsePageSource(source, `${fileName}.subjectSources.${subject}`);
  }

  let storage: CatalogSourceDefinition["storage"];
  if (value.storage !== undefined) {
    if (!isRecord(value.storage)) throw new Error(`${fileName}.storage must be an object`);
    storage = {};
    for (const field of ["rawDir", "catalogFile", "coursesFile", "requirementsFile"] as const) {
      if (value.storage[field] !== undefined) {
        if (
          typeof value.storage[field] !== "string" ||
          value.storage[field].includes("..") ||
          path.isAbsolute(value.storage[field])
        ) {
          throw new Error(`${fileName}.storage.${field} is invalid`);
        }
        storage[field] = value.storage[field];
      }
    }
  }

  return {
    id: value.id,
    university: String(value.university),
    program: String(value.program),
    adapter: String(value.adapter),
    enabled: value.enabled,
    pollIntervalMs: requiredNumber(value.pollIntervalMs, `${fileName}.pollIntervalMs`),
    requestDelayMs: requiredNumber(value.requestDelayMs, `${fileName}.requestDelayMs`),
    cacheTtlMs: requiredNumber(value.cacheTtlMs, `${fileName}.cacheTtlMs`),
    requestTimeoutMs: requiredNumber(value.requestTimeoutMs, `${fileName}.requestTimeoutMs`),
    userAgent: String(value.userAgent),
    robotsUrl: typeof value.robotsUrl === "string" ? value.robotsUrl : undefined,
    allowedOrigins,
    disallowedPathPatterns: value.disallowedPathPatterns as string[],
    programSource,
    subjectSources,
    storage,
  };
}

export async function loadRegistry(
  sourcesDir = path.join(process.cwd(), "catalog-service", "sources"),
): Promise<CatalogSourceDefinition[]> {
  const names = (await readdir(sourcesDir)).filter((name) => name.endsWith(".json") && !name.startsWith("."));
  const sources: CatalogSourceDefinition[] = [];
  const ids = new Set<string>();
  for (const name of names.sort()) {
    const parsed = parseSourceDefinition(JSON.parse(await readFile(path.join(sourcesDir, name), "utf8")), name);
    if (ids.has(parsed.id)) throw new Error(`Duplicate catalog source id: ${parsed.id}`);
    ids.add(parsed.id);
    sources.push(parsed);
  }
  if (!sources.length) throw new Error(`No catalog sources found in ${sourcesDir}`);
  return sources;
}

export function enabledSources(sources: CatalogSourceDefinition[]): CatalogSourceDefinition[] {
  return sources.filter((source) => source.enabled);
}

export function findSource(sources: CatalogSourceDefinition[], id: string): CatalogSourceDefinition {
  const match = sources.find((source) => source.id === id);
  if (!match) throw new Error(`Unknown catalog source: ${id}`);
  return match;
}

export function defaultCatalogId(): string {
  return process.env.CATALOG_ID ?? "neu-mscs-seattle";
}
