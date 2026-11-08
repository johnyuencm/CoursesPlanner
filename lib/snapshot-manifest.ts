import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCatalog } from "./catalog";
import { requirementsV2FromV1, requirementTier } from "./requirements-v2";
import { findUniversity, readReadyRoadmap, readState } from "./roadmap-reader";
import { SNAPSHOT_ASSET_DIR } from "./snapshot-assets";
import type { SupportTier } from "./types";
import { loadUniversityDirectory } from "./university-directory";

/** The allowlist of published roadmaps: one catalog key (`<universityId>/<programId>`) per program. */
export const PUBLISHED_FILE = "data/published.json";
const UNIVERSITIES_FILE = "catalog-service/universities.json";
const CATALOG_FILE = "data/catalog.json";

export type SnapshotManifest = {
  version: 1;
  catalogs: { key: string; tier: SupportTier; edition: string; file: string }[];
  /** Every repo file that the Worker can read, as a repo-relative path. */
  files: string[];
};

/**
 * Validate every published snapshot and give the static asset files that the
 * Worker reads (asset path → JSON text), including `_snapshots/manifest.json`.
 * Throws when the allowlist names a missing or invalid snapshot, so the build fails.
 */
export async function buildSnapshotAssets(rootDir: string): Promise<Map<string, string>> {
  const contents = new Map<string, unknown>();
  const catalogs: SnapshotManifest["catalogs"] = [];

  const universitiesPath = path.join(rootDir, UNIVERSITIES_FILE);
  const universities = await loadUniversityDirectory(universitiesPath);
  contents.set(UNIVERSITIES_FILE, JSON.parse(await readFile(universitiesPath, "utf8")));

  const catalog = await readCatalog(path.join(rootDir, CATALOG_FILE));
  contents.set(CATALOG_FILE, catalog);
  // The tier comes from validation of the requirement model. A roadmap has no model, so it is Map.
  const tier = requirementTier(requirementsV2FromV1(catalog.requirements), catalog.courses);
  catalogs.push({ key: catalog.id ?? "default", tier, edition: catalog.lastUpdated, file: CATALOG_FILE });

  const keys: unknown = JSON.parse(await readFile(path.join(rootDir, PUBLISHED_FILE), "utf8"));
  if (!Array.isArray(keys)) throw new Error(`${PUBLISHED_FILE} must be a JSON array of catalog keys`);
  const published = new Set<string>();
  const programFiles = new Map<string, unknown>();
  for (const key of keys) {
    const [universityId, programId, extra] = typeof key === "string" ? key.split("/") : [];
    if (!universityId || !programId || extra !== undefined || published.has(key)) {
      throw new Error(`${PUBLISHED_FILE} has an invalid or duplicate catalog key: ${String(key)}`);
    }
    published.add(key);
    try {
      const university = findUniversity(universities, universityId);
      const roadmap = await readReadyRoadmap(university, programId, rootDir);
      const file = `data/catalogs/${universityId}/roadmaps/${programId}.json`;
      contents.set(file, roadmap);
      catalogs.push({ key, tier: "map", edition: roadmap.lastUpdated, file });
      if (!programFiles.has(universityId)) {
        programFiles.set(universityId, (await readState(university, rootDir, () => new Date())).programs);
      }
    } catch (error) {
      throw new Error(`Published snapshot ${key} is missing or invalid: ${(error as Error).message}`);
    }
  }
  // The Worker lists only published programs, so unpublishing needs no code change.
  for (const [universityId, programs] of programFiles) {
    const directory = programs as { programs: { id: string }[] };
    contents.set(`data/catalogs/${universityId}/programs.json`, {
      ...directory,
      programs: directory.programs.filter((program) => published.has(`${universityId}/${program.id}`)),
    });
  }

  const manifest: SnapshotManifest = { version: 1, catalogs, files: [...contents.keys()].sort() };
  const assets = new Map<string, string>([[`${SNAPSHOT_ASSET_DIR}/manifest.json`, JSON.stringify(manifest)]]);
  for (const [file, value] of contents) assets.set(`${SNAPSHOT_ASSET_DIR}/${file}`, JSON.stringify(value));
  return assets;
}
