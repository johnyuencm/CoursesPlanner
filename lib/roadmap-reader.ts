import path from "node:path";
import {
  validateDiscoveredPrograms,
  validateProgramRoadmap,
} from "./catalog";
import type {
  DiscoveredPrograms,
  ProgramDirectoryResponse,
  ProgramRoadmap,
  RoadmapCrawlStatus,
} from "./types";
import type { UniversityDirectoryEntry, UniversityRoadmapSummary } from "./source-types";
import { snapshotAsset } from "./snapshot-assets";
import { readBoundedFile } from "./read-bounded-file";

const validId = (id: string) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);
const crawlable = (university: UniversityDirectoryEntry) =>
  university.support === "supported" && university.enabled && university.crawl !== undefined;

export function universityDir(rootDir: string, id: string): string {
  if (!validId(id)) throw new Error(`Invalid university id: ${id}`);
  return path.join(rootDir, "data", "catalogs", id);
}

export async function readOptionalJson(filePath: string): Promise<unknown> {
  try {
    return JSON.parse(await readBoundedFile(filePath));
  } catch (error) {
    // Only a missing file uses the published asset. A corrupt or oversize disk file must fail loudly.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return snapshotAsset(filePath);
  }
}

export function findUniversity(universities: UniversityDirectoryEntry[], id: string): UniversityDirectoryEntry {
  const university = validId(id) && universities.find((entry) => entry.id === id);
  if (!university) throw new Error(`Unknown university: ${id}`);
  return university;
}

export function initialStatus(university: UniversityDirectoryEntry, updatedAt: string): RoadmapCrawlStatus {
  const status = crawlable(university) ? "queued" : university.support === "unsupported" ? "unsupported" : "unverified";
  return {
    version: 1, universityId: university.id, status, discoveryStatus: status,
    queue: [], counts: { queued: 0, ready: 0, unsupported: 0, error: 0 }, updatedAt,
    ...(status === "unsupported" ? { reason: "No supported roadmap adapter for this university." } : {}),
  };
}

export function summarize(programs: DiscoveredPrograms, updatedAt: string): RoadmapCrawlStatus {
  const counts = { queued: 0, ready: 0, unsupported: 0, error: 0 };
  const queue: string[] = [];
  for (const program of programs.programs) {
    if (program.status === "queued" || program.status === "unverified") {
      queue.push(program.id);
      counts.queued += 1;
    } else {
      counts[program.status] += 1;
    }
  }
  const status = queue.length ? "queued" : counts.error ? "error" : counts.ready ? "ready" : "unsupported";
  return {
    version: 1, universityId: programs.universityId, status, discoveryStatus: "ready",
    queue, counts, updatedAt,
    ...(status === "error" ? { reason: "Some programs failed; use --retry-errors to retry them." } : {}),
    ...(status === "unsupported" ? { reason: "No course-based roadmaps were found in the discovered programs." } : {}),
  };
}

/** The tracked program directory (`programs.json`), validated. Undefined before discovery. Never reads the crawl status (#127). */
export async function readPrograms(university: UniversityDirectoryEntry, rootDir: string): Promise<DiscoveredPrograms | undefined> {
  if (!crawlable(university)) return undefined;
  const programs = await readOptionalJson(path.join(universityDir(rootDir, university.id), "programs.json"));
  if (programs === undefined) return undefined;
  validateDiscoveredPrograms(programs, university.crawl!.allowedOrigins);
  if (
    programs.universityId !== university.id || programs.university !== university.university ||
    programs.adapter !== university.crawl!.adapter || programs.sourceUrl !== university.crawl!.discoverySource.url
  ) throw new Error("Discovered programs do not match the university registry");
  programs.programs.sort((a, b) => a.officialUrl.localeCompare(b.officialUrl) || a.id.localeCompare(b.id));
  return programs;
}

/** The newest time in a program directory: its discovery, each program status, and `also` when given. */
export function latestUpdate(programs: DiscoveredPrograms, also?: string): string {
  return [programs.discoveredAt, ...programs.programs.map((program) => program.statusUpdatedAt), ...(also === undefined ? [] : [also])]
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

/**
 * The program directory that the app serves: tracked files only, so dev answers like the Worker (#127).
 * The crawl status is crawler state. Only catalog-service/roadmaps.ts reads it.
 */
export async function readProgramDirectory(
  university: UniversityDirectoryEntry,
  rootDir = process.cwd(),
): Promise<ProgramDirectoryResponse> {
  const programs = await readPrograms(university, rootDir);
  return {
    universityId: university.id,
    programs: programs?.programs ?? [],
    status: programs ? summarize(programs, latestUpdate(programs)) : initialStatus(university, new Date().toISOString()),
  };
}

/** Every university with its status. The crawler passes its own `readDirectory`, which adds the crawl status. */
export async function listRoadmapUniversities(
  universities: UniversityDirectoryEntry[],
  rootDir = process.cwd(),
  readDirectory = readProgramDirectory,
): Promise<UniversityRoadmapSummary[]> {
  return Promise.all(universities.map(async ({ crawl: _crawl, ...entry }) => ({
    ...entry,
    status: (await readDirectory(findUniversity(universities, entry.id), rootDir)).status,
  })));
}

export async function readReadyRoadmap(
  university: UniversityDirectoryEntry,
  programId: string,
  rootDir = process.cwd(),
): Promise<ProgramRoadmap> {
  if (!validId(programId)) throw new Error(`Unknown roadmap program: ${programId}`);
  // Tracked files only: the build ships this roadmap, and git ignores the crawl status (#127).
  const program = (await readPrograms(university, rootDir))?.programs.find((entry) => entry.id === programId);
  if (!program) throw new Error(`Unknown roadmap program: ${programId}`);
  if (program.status !== "ready") throw new Error(`Roadmap is not ready: ${programId} (${program.status})`);
  const roadmap = await readOptionalJson(path.join(universityDir(rootDir, university.id), "roadmaps", `${programId}.json`));
  validateProgramRoadmap(roadmap, university.crawl!.allowedOrigins);
  if (
    roadmap.universityId !== university.id || roadmap.university !== university.university ||
    roadmap.programId !== programId || roadmap.program !== program.name ||
    roadmap.officialUrl !== program.officialUrl || roadmap.adapter !== university.crawl!.adapter
  ) throw new Error("Roadmap does not match the discovered program");
  return roadmap;
}
