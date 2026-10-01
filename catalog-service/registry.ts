import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getAdapter } from "./adapters";
import type { CatalogSourceDefinition, PageSource } from "../lib/source-types";
import { enabledUniversities, loadUniversityDirectory, parseAllowedOrigins, parsePageSource, parseUniversityDirectory, requiredHttpsUrl, requiredNumber } from "../lib/university-directory";

// Re-exported so existing catalog-service callers keep one import path (A2).
export { enabledUniversities, loadUniversityDirectory, parseUniversityDirectory };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);





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
  const allowedOrigins = parseAllowedOrigins(value.allowedOrigins, `${fileName}.allowedOrigins`);
  if (!Array.isArray(value.disallowedPathPatterns) || !value.disallowedPathPatterns.every((item) => typeof item === "string")) {
    throw new Error(`${fileName}.disallowedPathPatterns must be an array of strings`);
  }
  const robotsUrl =
    value.robotsUrl === undefined ? undefined : requiredHttpsUrl(value.robotsUrl, `${fileName}.robotsUrl`);
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
    robotsUrl,
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
