// The full catalog (`Catalog`) of each published catalog key (#74).
// The default key has a modeled catalog (data/catalog.json, Audit tier).
// Every other key has only a prerequisite roadmap, so it becomes a Map-tier catalog.
import { statSync } from "node:fs";
import path from "node:path";
import { readCatalog } from "./catalog";
import { DEFAULT_CATALOG_KEY } from "./catalog-key";
import { findUniversity, readReadyRoadmap, universityDir } from "./roadmap-reader";
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

async function loadRoadmapCatalog(key: string): Promise<Catalog> {
  const [universityId = "", programId = ""] = key.split("/");
  const file = path.join(universityDir(process.cwd(), universityId), "roadmaps", `${programId}.json`);
  try {
    statSync(file);
  } catch (error) {
    // Worker: no project files. The build validated the published copy, so do not spend request CPU on it again.
    const published = (await snapshotAsset(file)) as ProgramRoadmap | undefined;
    if (published === undefined) throw error;
    return roadmapCatalog(published);
  }
  // Node (prerender, tests, dev): validate the disk file against the program directory.
  return roadmapCatalog(await readReadyRoadmap(findUniversity(await loadUniversityDirectory(), universityId), programId));
}

/** The catalog of a catalog key, one parse per isolate. Call it only with a key of `CATALOGS`. */
export function readProgramCatalog(key: string): Promise<Catalog> {
  if (key === DEFAULT_CATALOG_KEY) return readCatalog();
  let pending = roadmapCatalogs.get(key);
  if (!pending) {
    pending = loadRoadmapCatalog(key);
    pending.catch(() => roadmapCatalogs.delete(key)); // try again on the next call
    roadmapCatalogs.set(key, pending);
  }
  return pending;
}
