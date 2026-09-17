import { createHash } from "node:crypto";
import * as cheerio from "cheerio";
import type { Course, DegreeRequirement, ProgramKind } from "../lib/types";
import {
  buildCourseGraph,
  buildRoadmapCourseGraph,
  parseCourses,
  parseProgramRequirements,
} from "../scraper/parser";
import type { PageSource } from "./source-types";

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
  parseProgram(html: string, officialUrl: string, lastUpdated: string): DegreeRequirement;
  parseCourses(html: string, pageUrl: string): Course[];
  buildGraph(courses: Course[], requirements: DegreeRequirement): Course[];
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

const PROGRAM_ROOTS = ["/undergraduate/", "/graduate/", "/professional-studies/"];
const NON_PROGRAM_PATH = /\/(?:academic-policies-procedures|admissions?|course-descriptions|faculty|general-information|student-resources)(?:\/|$)/;

function northeasternProgramLinks(source: string, sourceUrl: string): AdapterProgramLink[] {
  const sourceOrigin = new URL(sourceUrl).origin;
  const xml = cheerio.load(source, { xmlMode: true });
  const sitemapUrls = xml("loc")
    .map((_index, element) => normalize(xml(element).text()))
    .get();
  const html = sitemapUrls.length ? null : cheerio.load(source);
  const namedLinks = new Map<string, string>();
  const rawUrls = sitemapUrls.length
    ? sitemapUrls
    : html!("#azindex a[href], .azindex a[href], .programs a[href], [data-program][href]")
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
          PROGRAM_ROOTS.some((root) => url.pathname.startsWith(root)),
      ),
    );
  const paths = sectionUrls.map((url) => url.pathname);
  return sectionUrls
    .filter(
      (url) =>
        !NON_PROGRAM_PATH.test(url.pathname) &&
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

function northeasternProgramScope(html: string, _officialUrl: string): AdapterProgramScope | null {
  const $ = cheerio.load(html);
  const root = $("#programrequirementstextcontainer");
  if (!root.length) return null;
  const name = normalize($("h1").first().text());
  if (!name) return null;
  const programCourseCodes = [
    ...new Set(
      root
        .find("a.code")
        .map((_index, element) => normalize($(element).text()).toUpperCase())
        .get()
        .filter((code) => /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/.test(code)),
    ),
  ].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (!programCourseCodes.length) return null;
  return { name, kind: programKind(name), programCourseCodes, warnings: [] };
}

function northeasternCourseSources(programCourseCodes: string[], origin: string): PageSource[] {
  const parsedOrigin = new URL(origin);
  if (parsedOrigin.protocol !== "https:" || parsedOrigin.origin !== origin) {
    throw new Error(`Northeastern course source origin must be HTTPS: ${origin}`);
  }
  const subjects = [
    ...new Set(
      programCourseCodes
        .map((code) => code.match(/^([A-Z]{2,6}) /)?.[1])
        .filter((subject): subject is string => Boolean(subject)),
    ),
  ].sort();
  return subjects.map((subject) => ({
    key: `course:${subject}`,
    url: `${origin}/course-descriptions/${subject.toLowerCase()}/`,
    fileName: `courses-${subject.toLowerCase()}.html`,
    required: true,
  }));
}

const northeasternAcalog: CatalogAdapter = {
  id: "northeastern-acalog",
  parseProgram: parseProgramRequirements,
  parseCourses,
  buildGraph: buildCourseGraph,
  discoverPrograms: northeasternProgramLinks,
  parseProgramScope: northeasternProgramScope,
  courseSources: northeasternCourseSources,
  buildRoadmapGraph: buildRoadmapCourseGraph,
};

const adapters: Record<string, CatalogAdapter> = {
  [northeasternAcalog.id]: northeasternAcalog,
};

export function getAdapter(id: string): CatalogAdapter {
  const adapter = adapters[id];
  if (!adapter) {
    throw new Error(
      `No catalog adapter registered for "${id}". Add an adapter in catalog-service/adapters.ts, then point a source JSON file at it.`,
    );
  }
  return adapter;
}

export function registeredAdapters(): string[] {
  return Object.keys(adapters);
}
