import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateCatalog } from "../lib/catalog";
import type { Catalog, Course } from "../lib/types";
import { getAdapter } from "./adapters";
import { createTurnWaiter, fetchOfficialHtml, loadRobots } from "./crawler";
import { defaultCatalogId, findSource, loadRegistry } from "./registry";
import type { RobotsRules } from "./robots";
import type { CatalogSourceDefinition, PageSource } from "./source-types";

export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

type FetchImplementation = typeof fetch;

export interface RefreshOptions {
  force?: boolean;
  rootDir?: string;
  fetchImpl?: FetchImplementation;
  delayMs?: number;
  now?: () => Date;
  sourceId?: string;
  sourcesDir?: string;
  checkOnly?: boolean;
}

interface CacheEntry {
  url: string;
  fetchedAt: string;
  lastCheckedAt?: string;
  etag?: string;
  lastModified?: string;
}

interface CacheMetadata {
  version: 2;
  robots?: RobotsRules;
  sources: Record<string, CacheEntry>;
}

interface LoadedSource {
  source: PageSource;
  html: string;
  fetchedAt: string;
  fromNetwork: boolean;
  changed: boolean;
  etag?: string;
  lastModified?: string;
}

export function storagePaths(definition: CatalogSourceDefinition, rootDir: string) {
  const defaults = {
    rawDir: path.join("data", "catalogs", definition.id, "raw"),
    catalogFile: path.join("data", "catalogs", definition.id, "catalog.json"),
    coursesFile: path.join("data", "catalogs", definition.id, "courses.json"),
    requirementsFile: path.join("data", "catalogs", definition.id, "requirements.json"),
  };
  return {
    rawDir: path.join(rootDir, definition.storage?.rawDir ?? defaults.rawDir),
    catalogFile: path.join(rootDir, definition.storage?.catalogFile ?? defaults.catalogFile),
    coursesFile: path.join(rootDir, definition.storage?.coursesFile ?? defaults.coursesFile),
    requirementsFile: path.join(rootDir, definition.storage?.requirementsFile ?? defaults.requirementsFile),
  };
}

async function readCacheMetadata(filePath: string): Promise<CacheMetadata> {
  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "sources" in parsed &&
      typeof parsed.sources === "object" &&
      parsed.sources !== null
    ) {
      const record = parsed as CacheMetadata;
      return { version: 2, robots: record.robots, sources: record.sources };
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      /* Malformed sidecar must not block a valid HTML cache. */
    }
  }
  return { version: 2, sources: {} };
}

async function readBoundedFile(filePath: string): Promise<string> {
  const details = await stat(filePath);
  if (details.size > 5 * 1024 * 1024) throw new Error(`Cached response exceeds 5 MB: ${filePath}`);
  return readFile(filePath, "utf8");
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, filePath);
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export async function refreshSource(
  definition: CatalogSourceDefinition,
  options: RefreshOptions = {},
): Promise<{ catalog: Catalog; changed: boolean }> {
  const force = options.force ?? false;
  const checkOnly = options.checkOnly ?? false;
  const rootDir = options.rootDir ?? process.cwd();
  const fetchImpl = options.fetchImpl ?? fetch;
  const delayMs = options.delayMs ?? definition.requestDelayMs;
  const now = options.now ?? (() => new Date());
  const adapter = getAdapter(definition.adapter);
  const paths = storagePaths(definition, rootDir);
  const metadataPath = path.join(paths.rawDir, ".catalog-cache.json");
  const metadata = await readCacheMetadata(metadataPath);
  const warnings: string[] = [];
  const waitForTurn = createTurnWaiter(delayMs);
  let robots = metadata.robots;
  try {
    robots = await loadRobots(definition, fetchImpl, waitForTurn, robots, now);
  } catch (error) {
    warnings.push(
      `Could not refresh robots.txt; using local disallow patterns only: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const loadSource = async (source: PageSource): Promise<LoadedSource> => {
    const cachePath = path.join(paths.rawDir, source.fileName);
    let cachedHtml: string | undefined;
    let cacheTimestamp: string | undefined;
    const recorded = metadata.sources[source.key];
    try {
      const details = await stat(cachePath);
      cachedHtml = await readBoundedFile(cachePath);
      cacheTimestamp =
        recorded?.url === source.url && !Number.isNaN(Date.parse(recorded.fetchedAt))
          ? recorded.fetchedAt
          : details.mtime.toISOString();
      const fresh = now().getTime() - Date.parse(cacheTimestamp) <= definition.cacheTtlMs;
      if (!force && !checkOnly && fresh) {
        return {
          source,
          html: cachedHtml,
          fetchedAt: cacheTimestamp,
          fromNetwork: false,
          changed: false,
          etag: recorded?.etag,
          lastModified: recorded?.lastModified,
        };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    try {
      const fetched = await fetchOfficialHtml(definition, source, fetchImpl, waitForTurn, {
        etag: recorded?.etag,
        lastModified: recorded?.lastModified,
        robots,
        now,
      });
      if (fetched.notModified) {
        if (!cachedHtml || !cacheTimestamp) throw new Error(`304 from ${source.url} but no local cache exists`);
        return {
          source,
          html: cachedHtml,
          fetchedAt: cacheTimestamp,
          fromNetwork: false,
          changed: false,
          etag: fetched.etag,
          lastModified: fetched.lastModified,
        };
      }
      return {
        source,
        html: fetched.html,
        fetchedAt: fetched.fetchedAt,
        fromNetwork: true,
        changed: !cachedHtml || cachedHtml !== fetched.html,
        etag: fetched.etag,
        lastModified: fetched.lastModified,
      };
    } catch (error) {
      if (cachedHtml && cacheTimestamp) {
        warnings.push(
          `Using stale cache for ${source.url}: ${error instanceof Error ? error.message : String(error)}`,
        );
        return {
          source,
          html: cachedHtml,
          fetchedAt: cacheTimestamp,
          fromNetwork: false,
          changed: false,
          etag: recorded?.etag,
          lastModified: recorded?.lastModified,
        };
      }
      throw error;
    }
  };

  const loaded: LoadedSource[] = [];
  const programSource = await loadSource(definition.programSource);
  loaded.push(programSource);
  const builtAt = now().toISOString();
  const requirements = adapter.parseProgram(programSource.html, definition.programSource.url, builtAt);

  const listedCodes = [
    ...requirements.coreCourses,
    ...requirements.eligibleElectives,
    ...requirements.breadthRequirements.categories.flatMap((category) => category.courses),
  ];
  const subjects = [...new Set(listedCodes.map((code) => code.split(" ")[0]))];
  for (const subject of subjects) {
    const source = definition.subjectSources[subject];
    if (!source) throw new Error(`No approved bulk catalog source configured for subject ${subject} in ${definition.id}`);
    try {
      loaded.push(await loadSource(source));
    } catch (error) {
      if (source.required) throw error;
      warnings.push(
        `Could not load optional ${subject} bulk catalog; listed courses remain uncertain placeholders: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const anyChange = force || loaded.some((entry) => entry.changed) || !(await fileExists(paths.catalogFile));
  let catalog: Catalog;
  let publishedCourses: Course[] | undefined;
  if (!anyChange) {
    catalog = JSON.parse(await readFile(paths.catalogFile, "utf8")) as Catalog;
    validateCatalog(catalog);
  } else {
    const parsedCourses = loaded
      .filter((entry) => entry.source.key !== definition.programSource.key)
      .flatMap((entry) => adapter.parseCourses(entry.html, entry.source.url));
    publishedCourses = adapter.buildGraph(parsedCourses, requirements);
    catalog = assembleCatalog(definition, publishedCourses, requirements, loaded, builtAt, warnings);
    validateCatalog(catalog);
    await atomicWrite(paths.coursesFile, json(publishedCourses));
    await atomicWrite(paths.requirementsFile, json(requirements));
    await atomicWrite(paths.catalogFile, json(catalog));
  }
  await publishSnapshots(definition, rootDir, catalog, publishedCourses, anyChange ? requirements : undefined);

  for (const entry of loaded.filter(({ fromNetwork }) => fromNetwork)) {
    await atomicWrite(path.join(paths.rawDir, entry.source.fileName), entry.html);
  }
  const nextMetadata: CacheMetadata = {
    version: 2,
    robots,
    sources: Object.fromEntries(
      loaded.map(({ source, fetchedAt, etag, lastModified }) => [
        source.key,
        {
          url: source.url,
          fetchedAt,
          lastCheckedAt: now().toISOString(),
          etag,
          lastModified,
        },
      ]),
    ),
  };
  await atomicWrite(metadataPath, json(nextMetadata));
  return { catalog, changed: anyChange };
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function assembleCatalog(
  definition: CatalogSourceDefinition,
  courses: Course[],
  requirements: Catalog["requirements"],
  loaded: LoadedSource[],
  builtAt: string,
  warnings: string[],
): Catalog {
  const placeholderCount = courses.filter((course) => course.title.startsWith("External course (")).length;
  const uncertainCourseCount = courses.filter((course) => course.uncertainties.length > 0).length;
  if (placeholderCount) {
    warnings.push(`${placeholderCount} external dependency or unavailable department courses have placeholder details.`);
  }
  if (uncertainCourseCount) {
    warnings.push(`${uncertainCourseCount} courses contain unavailable or conservatively parsed catalog clauses.`);
  }
  warnings.push("Topic labels are keyword-based recommendations, not official catalog rules.");
  return {
    id: definition.id,
    university: definition.university,
    program: definition.program,
    adapter: definition.adapter,
    courses,
    requirements,
    lastUpdated: builtAt,
    sources: loaded.map(({ source }) => source.url),
    warnings: [...new Set([...requirements.uncertainties, ...warnings])],
  };
}

async function publishSnapshots(
  definition: CatalogSourceDefinition,
  rootDir: string,
  catalog: Catalog,
  courses?: Course[],
  requirements?: Catalog["requirements"],
): Promise<void> {
  const paths = storagePaths(definition, rootDir);
  const idDir = path.join(rootDir, "data", "catalogs", definition.id);
  const idCatalog = path.join(idDir, "catalog.json");
  if (path.resolve(paths.catalogFile) !== path.resolve(idCatalog)) {
    await atomicWrite(idCatalog, json(catalog));
    if (courses) await atomicWrite(path.join(idDir, "courses.json"), json(courses));
    if (requirements) await atomicWrite(path.join(idDir, "requirements.json"), json(requirements));
  }
  const legacyCatalog = path.join(rootDir, "data", "catalog.json");
  if (definition.id === defaultCatalogId() && path.resolve(paths.catalogFile) !== path.resolve(legacyCatalog)) {
    await atomicWrite(legacyCatalog, json(catalog));
    if (courses) await atomicWrite(path.join(rootDir, "data", "courses.json"), json(courses));
    if (requirements) await atomicWrite(path.join(rootDir, "data", "requirements.json"), json(requirements));
  }
}

export async function refreshCatalog(options: RefreshOptions = {}): Promise<Catalog> {
  const sources = await loadRegistry(options.sourcesDir);
  const sourceId = options.sourceId ?? defaultCatalogId();
  const { catalog } = await refreshSource(findSource(sources, sourceId), options);
  return catalog;
}

export async function refreshEnabledSources(options: RefreshOptions = {}): Promise<Catalog[]> {
  const sources = await loadRegistry(options.sourcesDir);
  const catalogs: Catalog[] = [];
  for (const source of sources.filter((item) => item.enabled)) {
    catalogs.push((await refreshSource(source, options)).catalog);
  }
  return catalogs;
}
