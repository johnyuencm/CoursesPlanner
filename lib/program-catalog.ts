// The full catalog (`Catalog`) of each published catalog key (#74).
// The default key has a modeled catalog (data/catalog.json, Audit tier).
// Every other key has only a prerequisite roadmap, so it becomes a Map-tier catalog.
import { readFileSync } from "node:fs";
import path from "node:path";
import { readCatalog, validateProgramRoadmap } from "./catalog";
import { DEFAULT_CATALOG_KEY } from "./catalog-key";
import { findUniversity, universityDir } from "./roadmap-reader";
import { snapshotAsset } from "./snapshot-assets";
import type { Catalog, ProgramRoadmap } from "./types";
import { loadUniversityDirectory } from "./university-directory";

/**
 * The catalog year of a crawl date: Northeastern publishes a new edition each summer.
 * ponytail: a date rule, not the edition text. Store the edition in the roadmap when a college publishes on another cycle.
 */
export function catalogYearOf(timestamp: string): string {
  const date = new Date(timestamp);
  const start = date.getUTCFullYear() - (date.getUTCMonth() < 6 ? 1 : 0);
  return `${start}-${start + 1}`;
}

/** A Map-tier catalog from a roadmap: the courses and their prerequisites, with one unmodeled rule group. */
export function roadmapCatalog(roadmap: ProgramRoadmap): Catalog {
  return {
    id: roadmap.programId,
    university: roadmap.university,
    program: roadmap.program,
    shortName: roadmap.shortName,
    adapter: roadmap.adapter,
    courses: roadmap.courses,
    requirements: {
      version: 2,
      name: roadmap.program,
      catalogYear: catalogYearOf(roadmap.lastUpdated),
      officialUrl: roadmap.officialUrl,
      uncertainties: [],
      lastUpdated: roadmap.lastUpdated,
      root: {
        kind: "unmodeled",
        id: "program",
        label: roadmap.program,
        rawText: "The degree rules of this program are not modeled. Read them on the official program page.",
      },
    },
    lastUpdated: roadmap.lastUpdated,
    sources: roadmap.sources,
    warnings: roadmap.warnings,
  };
}

const roadmapCatalogs = new Map<string, Promise<Catalog>>();

async function loadRoadmapCatalog(key: string, rootDir: string): Promise<Catalog> {
  const [universityId = "", programId = ""] = key.split("/");
  const file = path.join(universityDir(rootDir, universityId), "roadmaps", `${programId}.json`);
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    // Worker: no project files. The build validated the published copy, so do not spend request CPU on it again.
    const published = (await snapshotAsset(file)) as ProgramRoadmap | undefined;
    if (published === undefined) throw error;
    return roadmapCatalog(published);
  }
  // Node (prerender, tests, dev): read only the committed roadmap file, never the ignored crawl
  // status or raw cache (#123). The build (lib/snapshot-manifest.ts) checks that the program is ready.
  const university = findUniversity(await loadUniversityDirectory(path.join(rootDir, "catalog-service", "universities.json")), universityId);
  const roadmap: unknown = JSON.parse(text);
  validateProgramRoadmap(roadmap, university.crawl?.allowedOrigins ?? []);
  if (roadmap.universityId !== universityId || roadmap.programId !== programId) {
    throw new Error(`Roadmap ${file} does not match the catalog key ${key}`);
  }
  return roadmapCatalog(roadmap);
}

/** The catalog of a catalog key, one parse per isolate. Call it only with a key of `CATALOGS`. */
export function readProgramCatalog(key: string, rootDir = process.cwd()): Promise<Catalog> {
  if (key === DEFAULT_CATALOG_KEY) return readCatalog(rootDir === process.cwd() ? undefined : path.join(rootDir, "data", "catalog.json"));
  const cacheKey = `${rootDir}|${key}`;
  let pending = roadmapCatalogs.get(cacheKey);
  if (!pending) {
    pending = loadRoadmapCatalog(key, rootDir);
    pending.catch(() => roadmapCatalogs.delete(cacheKey)); // try again on the next call
    roadmapCatalogs.set(cacheKey, pending);
  }
  return pending;
}
