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

/** The HTTP status and the short public message of each kind of roadmap read error (#136). */
const ROADMAP_READ_ERRORS = {
  "unknown-university": { status: 404, message: "Unknown university." },
  "unknown-program": { status: 404, message: "Unknown roadmap program." },
  "missing-programs": { status: 404, message: "The program list (programs.json) is missing." },
  "not-ready": { status: 503, message: "Roadmap is not ready yet." },
  "invalid-programs": { status: 503, message: "The program list (programs.json) is invalid." },
} as const;

/** A roadmap read failed for a known cause. The error message keeps the detail for the CLI and the build. */
export class RoadmapReadError extends Error {
  constructor(readonly kind: keyof typeof ROADMAP_READ_ERRORS, message: string) {
    super(message);
  }
}

/** The HTTP answer to a failed roadmap read: the same on /api/roadmaps and the catalog service (#136). */
export function roadmapReadAnswer(error: unknown): { status: number; message: string } {
  // A client or data-state answer writes no log line. A lost or broken program list is a fault, so it logs too.
  // The body stays one short text per kind: only the log names the folder, and so the university (#151).
  if (error instanceof RoadmapReadError && error.kind !== "invalid-programs" && error.kind !== "missing-programs") {
    return ROADMAP_READ_ERRORS[error.kind];
  }
  const message = error instanceof Error ? error.message : "";
  // One server log line gives the cause (a file path and its error). Error path only.
  console.error(`Roadmap read failed: ${message || String(error)}`);
  return error instanceof RoadmapReadError ? ROADMAP_READ_ERRORS[error.kind] : { status: 503, message: "Roadmap data is temporarily unavailable." };
}

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
  if (!university) throw new RoadmapReadError("unknown-university", `Unknown university: ${id}`);
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

const missingPrograms = (id: string) =>
  new RoadmapReadError("missing-programs", `Program list is missing: data/catalogs/${id}/programs.json`);
const invalidPrograms = (id: string, error: unknown) =>
  new RoadmapReadError("invalid-programs", `Program list is invalid: data/catalogs/${id}/programs.json: ${(error as Error).message}`);

/** The tracked program directory (`programs.json`), validated. Undefined before discovery. Never reads the crawl status (#127). */
export async function readPrograms(university: UniversityDirectoryEntry, rootDir: string): Promise<DiscoveredPrograms | undefined> {
  if (!crawlable(university)) return undefined;
  const programs = await readOptionalJson(path.join(universityDir(rootDir, university.id), "programs.json")).catch((error: unknown) => {
    // Only the local file gives a SyntaxError: a failed read or Worker asset fetch stays a generic 503 (#151).
    throw error instanceof SyntaxError ? invalidPrograms(university.id, error) : error;
  });
  if (programs === undefined) return undefined;
  try {
    validateDiscoveredPrograms(programs, university.crawl!.allowedOrigins);
    if (
      programs.universityId !== university.id || programs.university !== university.university ||
      programs.adapter !== university.crawl!.adapter || programs.sourceUrl !== university.crawl!.discoverySource.url
    ) throw new Error("Discovered programs do not match the university registry");
  } catch (error) {
    throw invalidPrograms(university.id, error);
  }
  programs.programs.sort((a, b) => a.officialUrl.localeCompare(b.officialUrl) || a.id.localeCompare(b.id));
  return programs;
}

/**
 * True when data/published.json lists a program of this university. The build ships the program list of each one,
 * so a published university without a list lost the file (#151). Read only when the list is missing.
 * shortcut: an unpublished local crawl that loses its list still reads as queued, because only the ignored crawl
 * status knows (#127); revisit if the app may read crawl state.
 */
async function isPublished(universityId: string, rootDir: string): Promise<boolean> {
  const file = "data/published.json";
  // Each error names the file, so a broken allowlist is not a nameless 503 in the log (#151).
  const keys = await readOptionalJson(path.join(rootDir, file)).catch((error: Error) => { throw new Error(`${file}: ${error.message}`); });
  if (keys === undefined) return false; // The Worker does not ship it. There, the build shipped every published list.
  if (!Array.isArray(keys)) throw new Error(`${file} must be a JSON array of catalog keys`); // the build text too
  return keys.some((key) => typeof key === "string" && key.startsWith(`${universityId}/`));
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
  // No list is a queued crawl, unless the university is published: then the file is lost (#151).
  if (!programs && crawlable(university) && await isPublished(university.id, rootDir)) throw missingPrograms(university.id);
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
  if (!validId(programId)) throw new RoadmapReadError("unknown-program", `Unknown roadmap program: ${programId}`);
  // Tracked files only: the build ships this roadmap, and git ignores the crawl status (#127).
  const programs = await readPrograms(university, rootDir);
  // No programs.json: name the missing file, not an unknown program (#136).
  if (!programs && crawlable(university)) throw missingPrograms(university.id);
  const program = programs?.programs.find((entry) => entry.id === programId);
  if (!program) throw new RoadmapReadError("unknown-program", `Unknown roadmap program: ${programId}`);
  if (program.status !== "ready") throw new RoadmapReadError("not-ready", `Roadmap is not ready: ${programId} (${program.status})`);
  const roadmap = await readOptionalJson(path.join(universityDir(rootDir, university.id), "roadmaps", `${programId}.json`));
  validateProgramRoadmap(roadmap, university.crawl!.allowedOrigins);
  if (
    roadmap.universityId !== university.id || roadmap.university !== university.university ||
    roadmap.programId !== programId || roadmap.program !== program.name ||
    roadmap.officialUrl !== program.officialUrl || roadmap.adapter !== university.crawl!.adapter
  ) throw new Error("Roadmap does not match the discovered program");
  return roadmap;
}
