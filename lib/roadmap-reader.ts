import path from "node:path";
import {
  validateDiscoveredPrograms,
  validateProgramRoadmap,
  validateRoadmapCrawlStatus,
} from "./catalog";
import type {
  DiscoveredPrograms,
  ProgramDirectoryResponse,
  ProgramRoadmap,
  RoadmapCrawlStatus,
} from "./types";
import type { UniversityDirectoryEntry, UniversityRoadmapSummary } from "./source-types";
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
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
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

export async function readState(university: UniversityDirectoryEntry, rootDir: string, now: () => Date) {
  let status = initialStatus(university, now().toISOString());
  if (!crawlable(university)) return { programs: undefined, status };
  const directory = universityDir(rootDir, university.id);
  const persistedStatus = await readOptionalJson(path.join(directory, ".roadmap-crawl-status.json"));
  if (persistedStatus !== undefined) {
    validateRoadmapCrawlStatus(persistedStatus);
    if (persistedStatus.universityId !== university.id) throw new Error("Roadmap crawl status university mismatch");
    status = persistedStatus;
  }
  const programs = await readOptionalJson(path.join(directory, "programs.json"));
  if (programs === undefined) {
    if (status.discoveryStatus === "ready") throw new Error("Completed discovery is missing its program directory");
    return { programs: undefined, status };
  }
  validateDiscoveredPrograms(programs, university.crawl!.allowedOrigins);
  if (
    programs.universityId !== university.id || programs.university !== university.university ||
    programs.adapter !== university.crawl!.adapter || programs.sourceUrl !== university.crawl!.discoverySource.url
  ) throw new Error("Discovered programs do not match the university registry");
  programs.programs.sort((a, b) => a.officialUrl.localeCompare(b.officialUrl) || a.id.localeCompare(b.id));
  // programs.json is the commit point; rebuild a sidecar left behind by an interrupted write.
  const updatedAt = [programs.discoveredAt, ...programs.programs.map((program) => program.statusUpdatedAt),
    ...(persistedStatus === undefined ? [] : [status.updatedAt])]
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
  return { programs, status: summarize(programs, updatedAt) };
}

export async function readProgramDirectory(
  university: UniversityDirectoryEntry,
  rootDir = process.cwd(),
): Promise<ProgramDirectoryResponse> {
  const { programs, status } = await readState(university, rootDir, () => new Date());
  return { universityId: university.id, programs: programs?.programs ?? [], status };
}

export async function listRoadmapUniversities(
  universities: UniversityDirectoryEntry[],
  rootDir = process.cwd(),
): Promise<UniversityRoadmapSummary[]> {
  return Promise.all(universities.map(async ({ crawl: _crawl, ...entry }) => ({
    ...entry,
    status: (await readProgramDirectory(findUniversity(universities, entry.id), rootDir)).status,
  })));
}

export async function readReadyRoadmap(
  university: UniversityDirectoryEntry,
  programId: string,
  rootDir = process.cwd(),
): Promise<ProgramRoadmap> {
  if (!validId(programId)) throw new Error(`Unknown roadmap program: ${programId}`);
  const directory = await readProgramDirectory(university, rootDir);
  const program = directory.programs.find((entry) => entry.id === programId);
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
