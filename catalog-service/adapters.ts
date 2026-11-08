import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { Course, DegreeRequirementV2, ProgramKind } from "../lib/types";
import {
  buildCourseGraph,
  buildRoadmapCourseGraph,
  parseCourses,
  parseProgramRequirements,
} from "../scraper/parser";
import type { PageSource } from "../lib/source-types";
import { type CourseCodeGrammar, courseCodeGrammar } from "../lib/course-code";
import { COURSELEAF_CONFIGS, type CourseLeafConfig, type CourseLeafLayout, courseLeafLayout } from "./courseleaf";

export interface AdapterProgramLink {
  id: string;
  officialUrl: string;
  name?: string;
  kind?: ProgramKind;
}

export interface AdapterProgramScope {
  name: string;
  kind: ProgramKind;
  programCourseCodes: string[];
  warnings: string[];
}

export interface CatalogAdapter {
  id: string;
  /** Must be `courseCodeGrammar(id)`; tests/course-code.test.ts checks this. */
  codeGrammar: CourseCodeGrammar;
  parseProgram(html: string, officialUrl: string, lastUpdated: string): DegreeRequirementV2;
  parseCourses(html: string, pageUrl: string): Course[];
  buildGraph(courses: Course[], requirements: DegreeRequirementV2): Course[];
  discoverPrograms?: (source: string, sourceUrl: string) => AdapterProgramLink[];
  parseProgramScope?: (html: string, officialUrl: string) => AdapterProgramScope | null;
  courseSources?: (programCourseCodes: string[], origin: string) => PageSource[];
  buildRoadmapGraph?: (
    courses: Course[],
    programCourseCodes: string[],
    origin: string,
  ) => Course[];
}

const normalize = (value: string) => value.replace(/ /g, " ").replace(/\s+/g, " ").trim();

function programKind(value: string): ProgramKind {
  const normalized = value.toLowerCase();
  if (/\bminor\b/.test(normalized) || normalized.endsWith("/minor/")) return "minor";
  if (/\bcertificate\b/.test(normalized)) return "certificate";
  if (/\bmajor\b/.test(normalized)) return "major";
  return "degree";
}

function programId(officialUrl: string): string {
  const url = new URL(officialUrl);
  const leaf = url.pathname.split("/").filter(Boolean).at(-1) ?? "program";
  const slug = leaf.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "program";
  const digest = createHash("sha256").update(officialUrl).digest("hex").slice(0, 10);
  return `${slug.slice(0, 60)}-${digest}`;
}

function courseLeafProgramLinks(layout: CourseLeafLayout, source: string, sourceUrl: string): AdapterProgramLink[] {
  const { programRoots } = layout.config;
  const sourceOrigin = new URL(sourceUrl).origin;
  const xml = cheerio.load(source, { xmlMode: true });
  const sitemapUrls = xml("loc")
    .map((_index, element) => normalize(xml(element).text()))
    .get();
  const html = sitemapUrls.length ? null : cheerio.load(source);
  const namedLinks = new Map<string, string>();
  const rawUrls = sitemapUrls.length
    ? sitemapUrls
    : html!(layout.config.selectors.programIndexLinks)
        .map((_index, element) => {
          const href = html!(element).attr("href");
          if (!href) return "";
          const url = new URL(href, sourceUrl).toString();
          const name = normalize(html!(element).text());
          if (name) namedLinks.set(url, name);
          return url;
        })
        .get();
  const sectionUrls = [...new Set(rawUrls)]
    .map((candidate) => {
      try {
        const url = new URL(candidate, sourceUrl);
        url.hash = "";
        url.search = "";
        return url;
      } catch {
        return null;
      }
    })
    .filter((url): url is URL =>
      Boolean(
        url &&
          url.protocol === "https:" &&
          url.origin === sourceOrigin &&
          programRoots.some((root) => url.pathname.startsWith(root)),
      ),
    );
  const paths = sectionUrls.map((url) => url.pathname);
  return sectionUrls
    .filter(
      (url) =>
        !layout.nonProgramPath.test(url.pathname) &&
        !paths.some((candidate) => candidate !== url.pathname && candidate.startsWith(url.pathname)),
    )
    .map((url) => {
      const officialUrl = url.toString();
      const name = namedLinks.get(officialUrl);
      return {
        id: programId(officialUrl),
        officialUrl,
        ...(name ? { name, kind: programKind(name) } : { kind: programKind(url.pathname) }),
      };
    })
    .sort((left, right) => left.officialUrl.localeCompare(right.officialUrl));
}

function courseLeafProgramScope(layout: CourseLeafLayout, html: string): AdapterProgramScope | null {
  const { selectors } = layout.config;
  const $ = cheerio.load(html);
  const root = $(selectors.programRequirements);
  if (!root.length) return null;
  const name = normalize($(selectors.programName).first().text());
  if (!name) return null;
  const programCourseCodes = [
    ...new Set(
      root
        .find(selectors.codeLink)
        .map((_index, element) => normalize($(element).text()).toUpperCase())
        .get()
        .filter((code) => layout.grammar.pattern.test(code)),
    ),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!programCourseCodes.length) return null;
  return { name, kind: programKind(name), programCourseCodes, warnings: [] };
}

function courseLeafCourseSources(layout: CourseLeafLayout, programCourseCodes: string[], origin: string): PageSource[] {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" || parsedOrigin.origin !== origin) {
    throw new Error(`CourseLeaf course source origin must be HTTPS: ${origin}`);
  }
  const subjects = [
    ...new Set(
      programCourseCodes
        .map((code) => layout.grammar.subject(code))
        .filter((subject): subject is string => Boolean(subject)),
    ),
  ].sort();
  return subjects.map((subject) => ({
    key: `course:${subject}`,
    url: layout.config.courseDescriptionUrl.replace("{subject}", subject.toLowerCase()),
    fileName: `courses-${subject.toLowerCase()}.html`,
    required: true,
  }));
}

/** The generic CourseLeaf adapter for one college config. `id` is `courseleaf-<config id>` or an alias. */
function courseLeafAdapter(id: string, config: CourseLeafConfig): CatalogAdapter {
  const layout = courseLeafLayout(config);
  if (courseCodeGrammar(id) !== layout.grammar) {
    throw new Error(`Adapter "${id}" has a different grammar in lib/course-code.ts than codeGrammar "${config.codeGrammar}"`);
  }
  return {
    id,
    codeGrammar: layout.grammar,
    parseProgram: (html, officialUrl, lastUpdated) => parseProgramRequirements(html, officialUrl, lastUpdated, layout),
    parseCourses: (html, pageUrl) => parseCourses(html, pageUrl, layout),
    buildGraph: (courses, requirements) => buildCourseGraph(courses, requirements, layout),
    discoverPrograms: (source, sourceUrl) => courseLeafProgramLinks(layout, source, sourceUrl),
    parseProgramScope: (html) => courseLeafProgramScope(layout, html),
    courseSources: (programCourseCodes, origin) => courseLeafCourseSources(layout, programCourseCodes, origin),
    buildRoadmapGraph: (courses, programCourseCodes) => buildRoadmapCourseGraph(courses, programCourseCodes, layout),
  };
}

const adapters: Record<string, CatalogAdapter> = {};
for (const config of COURSELEAF_CONFIGS) {
  // An alias keeps its own id, so snapshots that name it stay byte-identical.
  for (const id of [`courseleaf-${config.id}`, ...config.aliases]) {
    if (Object.hasOwn(adapters, id)) throw new Error(`Duplicate catalog adapter id: ${id}`);
    adapters[id] = courseLeafAdapter(id, config);
  }
}

export function getAdapter(id: string): CatalogAdapter {
  const adapter = Object.hasOwn(adapters, id) ? adapters[id] : undefined;
  if (!adapter) {
    throw new Error(
      `No catalog adapter registered for "${id}". Add a CourseLeaf config in catalog-service/courseleaf/ or an adapter in catalog-service/adapters.ts, then point a source JSON file at it.`,
    );
  }
  return adapter;
}

export function registeredAdapters(): string[] {
  return Object.keys(adapters);
}
