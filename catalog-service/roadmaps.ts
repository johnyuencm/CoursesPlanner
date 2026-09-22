import { createHash } from "node:crypto";
import path from "node:path";
import {
  validateDiscoveredPrograms,
  validateProgramRoadmap,
  validateRoadmapCrawlStatus,
} from "../lib/catalog";
import type {
  DiscoveredProgram,
  DiscoveredPrograms,
  ProgramDirectoryResponse,
  ProgramRoadmap,
  RoadmapCrawlStatus,
  RoadmapStatus,
} from "../lib/types";
import { getAdapter } from "./adapters";
import { createTurnWaiter, loadRobots } from "./crawler";
import { loadUniversityDirectory, parseUniversityDirectory } from "./registry";
import { atomicWrite, CACHE_TTL_MS, json, loadCachedSource, readBoundedFile, readCacheMetadata } from "./refresh";
import type { RobotsRules } from "./robots";
import type { PageSource, UniversityDirectoryEntry, UniversityRoadmapSummary } from "./source-types";

const validId = (id: string) => /^[a-z0-9][a-z0-9-]{0,80}$/.test(id);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const reasonFor = (error: unknown) =>
  (error instanceof Error ? error.message : String(error)).replace(/\s+/g, " ").trim().slice(0, 500) || "Roadmap crawl failed.";
const crawlable = (university: UniversityDirectoryEntry) =>
  university.support === "supported" && university.enabled && university.crawl !== undefined;

function universityDir(rootDir: string, id: string): string {
  if (!validId(id)) throw new Error(`Invalid university id: ${id}`);
  return path.join(rootDir, "data", "catalogs", id);
}

async function readOptionalJson(filePath: string): Promise<unknown> {
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

function initialStatus(university: UniversityDirectoryEntry, updatedAt: string): RoadmapCrawlStatus {
  const status = crawlable(university) ? "queued" : university.support === "unsupported" ? "unsupported" : "unverified";
  return {
    version: 1, universityId: university.id, status, discoveryStatus: status,
    queue: [], counts: { queued: 0, ready: 0, unsupported: 0, error: 0 }, updatedAt,
    ...(status === "unsupported" ? { reason: "No supported roadmap adapter for this university." } : {}),
  };
}

function summarize(programs: DiscoveredPrograms, updatedAt: string): RoadmapCrawlStatus {
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

async function readState(university: UniversityDirectoryEntry, rootDir: string, now: () => Date) {
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
  return Promise.all(parseUniversityDirectory(universities, "universities").map(async ({ crawl: _crawl, ...entry }) => ({
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

export interface RoadmapCrawlOptions {
  limit: number;
  rootDir?: string;
  universities?: UniversityDirectoryEntry[];
  universityId?: string;
  retryErrors?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export interface RoadmapCrawlResult {
  processed: { universityId: string; type: "discovery" | "program"; programId?: string; status: RoadmapStatus }[];
}

export async function crawlRoadmaps(options: RoadmapCrawlOptions): Promise<RoadmapCrawlResult> {
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error("Roadmap crawl limit must be an integer from 1 through 100");
  }
  const rootDir = options.rootDir ?? process.cwd();
  const universities = options.universities
    ? parseUniversityDirectory(options.universities, "universities")
    : await loadUniversityDirectory(path.join(rootDir, "catalog-service", "universities.json"));
  const selected = options.universityId === undefined ? universities : [findUniversity(universities, options.universityId)];
  const enabled = selected.filter(crawlable);
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => new Date());
  // ponytail: one CLI writer at a time; add a cross-process lock if parallel operators are needed.
  // A shared waiter also spaces successive universities using the same host.
  const waitForTurn = createTurnWaiter(Math.max(0, ...enabled.map((entry) => entry.crawl!.requestDelayMs)));
  const processed: RoadmapCrawlResult["processed"] = [];
  for (const university of enabled) {
    if (processed.length >= options.limit) break;
    const config = university.crawl!;
    const adapter = getAdapter(config.adapter);
    let { programs, status } = await readState(university, rootDir, now);
    const directory = universityDir(rootDir, university.id);
    const persist = async () => {
      if (programs) {
        validateDiscoveredPrograms(programs, config.allowedOrigins);
        status = summarize(programs, now().toISOString());
        await atomicWrite(path.join(directory, "programs.json"), json(programs));
      }
      validateRoadmapCrawlStatus(status);
      await atomicWrite(path.join(directory, ".roadmap-crawl-status.json"), json(status));
    };
    if (!adapter.discoverPrograms || !adapter.parseProgramScope || !adapter.courseSources || !adapter.buildRoadmapGraph) {
      if (status.discoveryStatus !== "unsupported") {
        status = { ...status, status: "unsupported", discoveryStatus: "unsupported", updatedAt: now().toISOString(), reason: "Adapter does not support program roadmaps." };
        await persist();
        processed.push({ universityId: university.id, type: "discovery", status: status.status });
      }
      continue;
    }
    if (options.retryErrors && programs) {
      for (const program of programs.programs.filter((entry) => entry.status === "error")) {
        program.status = "queued";
        program.statusUpdatedAt = now().toISOString();
        delete program.reason;
      }
      await persist();
    }
    if (!programs && (status.discoveryStatus === "unsupported" || (status.discoveryStatus === "error" && !options.retryErrors))) continue;
    if (programs && !status.queue.length) continue;

    const rawDir = path.join(directory, "raw");
    const cachePath = path.join(rawDir, ".roadmap-cache.json");
    const cache = await readCacheMetadata(cachePath);
    const robotsByOrigin = new Map<string, RobotsRules>();
    const policy = {
      allowedOrigins: config.allowedOrigins,
      requestTimeoutMs: 15_000,
      userAgent: "CoursesPlanner-CatalogService/1.0 (local educational catalog cache)",
      disallowedPathPatterns: ["^/(?:search|xsearch|course-search|archive)(?:/|$)"],
      cacheTtlMs: CACHE_TTL_MS,
    };
    const robotsForUrl = async (url: URL): Promise<RobotsRules> => {
      const known = robotsByOrigin.get(url.origin);
      if (known) return known;
      const robotsFile = path.join(rawDir, `robots-${digest(url.origin)}.json`);
      const cached = await readOptionalJson(robotsFile);
      if (cached !== undefined && (
        typeof cached !== "object" || cached === null || !("fetchedAt" in cached) ||
        typeof cached.fetchedAt !== "string" || Number.isNaN(Date.parse(cached.fetchedAt)) ||
        !("disallowed" in cached) || !Array.isArray(cached.disallowed) ||
        !cached.disallowed.every((entry) => typeof entry === "string")
      )) throw new Error("Invalid cached robots rules");
      const robots = await loadRobots({
        ...policy,
        robotsUrl: config.robotsUrl && new URL(config.robotsUrl).origin === url.origin
          ? config.robotsUrl : `${url.origin}/robots.txt`,
      }, fetchImpl, waitForTurn, cached as RobotsRules | undefined, now);
      robotsByOrigin.set(url.origin, robots);
      await atomicWrite(robotsFile, json(robots));
      return robots;
    };
    const loadPage = async (page: PageSource, warnings: string[]) => {
      const source = { ...page, key: page.url, fileName: `${digest(page.url)}.${page.format ?? "html"}` };
      const loaded = await loadCachedSource(policy, source, {
        rawDir, recorded: cache.sources[source.key], fetchImpl, waitForTurn, robotsForUrl,
        now, checkOnly: options.retryErrors, allowStale: false, warnings,
      });
      if (loaded.fromNetwork) await atomicWrite(path.join(rawDir, source.fileName), loaded.html);
      cache.sources[source.key] = {
        url: source.url, fetchedAt: loaded.fetchedAt, lastCheckedAt: now().toISOString(),
        etag: loaded.etag, lastModified: loaded.lastModified,
      };
      await atomicWrite(cachePath, json(cache));
      return loaded.html;
    };

    if (!programs) {
      try {
        const html = await loadPage(config.discoverySource, []);
        const links = adapter.discoverPrograms(html, config.discoverySource.url);
        if (!links.length) throw new Error("No official program links found in the discovery source");
        const timestamp = now().toISOString();
        const discovered: DiscoveredPrograms = {
          version: 1, universityId: university.id, university: university.university, adapter: adapter.id,
          sourceUrl: config.discoverySource.url, discoveredAt: timestamp,
          programs: links.map((link): DiscoveredProgram => ({
            ...link, universityId: university.id, university: university.university,
            status: "queued", statusUpdatedAt: timestamp,
          })).sort((a, b) => a.officialUrl.localeCompare(b.officialUrl) || a.id.localeCompare(b.id)),
        };
        validateDiscoveredPrograms(discovered, config.allowedOrigins);
        programs = discovered;
      } catch (error) {
        status = { ...status, status: "error", discoveryStatus: "error", updatedAt: now().toISOString(), reason: reasonFor(error) };
      }
      await persist();
      processed.push({ universityId: university.id, type: "discovery", status: status.status });
    }
    for (const program of programs?.programs ?? []) {
      if (processed.length >= options.limit) break;
      if (program.status !== "queued" && program.status !== "unverified") continue;
      try {
        const warnings: string[] = [];
        const html = await loadPage({ key: program.id, url: program.officialUrl, fileName: `${program.id}.html`, required: true }, warnings);
        const scope = adapter.parseProgramScope(html, program.officialUrl);
        if (scope) {
          program.name = scope.name;
          program.kind = scope.kind;
        }
        if (!scope || !scope.programCourseCodes.length) {
          program.status = "unsupported";
          program.reason = "No supported course-based requirements found on the official program page.";
        } else {
          const origin = new URL(program.officialUrl).origin;
          const sources = adapter.courseSources(scope.programCourseCodes, origin);
          if (!sources.length) throw new Error("Adapter returned no approved bulk course sources");
          const parsedCourses = [];
          for (const source of sources) {
            parsedCourses.push(...adapter.parseCourses(await loadPage(source, warnings), source.url));
          }
          const courses = adapter.buildRoadmapGraph(parsedCourses, scope.programCourseCodes, origin);
          const uncertain = courses.filter((course) => course.uncertainties.length).length;
          if (uncertain) warnings.push(`${uncertain} courses have unavailable details or conservatively parsed prerequisite/corequisite clauses; inspect course uncertainties.`);
          const roadmap: ProgramRoadmap = {
            universityId: university.id, university: university.university,
            programId: program.id, program: scope.name, adapter: adapter.id, officialUrl: program.officialUrl,
            programCourseCodes: scope.programCourseCodes, courses, lastUpdated: now().toISOString(),
            sources: [...new Set([program.officialUrl, ...sources.map((source) => source.url)])],
            warnings: [...new Set([...scope.warnings, ...warnings])],
          };
          validateProgramRoadmap(roadmap, config.allowedOrigins);
          await atomicWrite(path.join(directory, "roadmaps", `${program.id}.json`), json(roadmap));
          program.status = "ready";
          delete program.reason;
        }
      } catch (error) {
        program.status = "error";
        program.reason = reasonFor(error);
      }
      program.statusUpdatedAt = now().toISOString();
      await persist();
      processed.push({ universityId: university.id, type: "program", programId: program.id, status: program.status });
    }
  }
  return { processed };
}
