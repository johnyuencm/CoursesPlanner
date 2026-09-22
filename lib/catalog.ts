import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type {
  Catalog,
  Course,
  DiscoveredPrograms,
  ProgramRoadmap,
  RequirementExpression,
  RoadmapCrawlStatus,
  RoadmapStatus,
} from "./types";

const TOPICS = new Set([
  "Robotics",
  "AI / ML",
  "Systems",
  "Software Engineering",
  "Data",
  "Networks / Security",
]);
const COURSE_CODE = /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/;
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,80}$/;
const ROADMAP_STATUSES = new Set<RoadmapStatus>([
  "unverified",
  "queued",
  "ready",
  "unsupported",
  "error",
]);
const PROGRAM_KINDS = new Set(["degree", "major", "minor", "certificate", "other"]);

export function isRoadmapCourseCode(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 32 &&
    value === value.trim() &&
    !value.includes("..") &&
    !/\s{2,}/.test(value) &&
    /\d/u.test(value) &&
    /^[\p{L}\p{N}](?:[\p{L}\p{N} ._+&/-]*[\p{L}\p{N}])?$/u.test(value)
  );
}

export function officialHostsFromSources(sources: string[]): Set<string> {
  const hosts = new Set<string>();
  for (const source of sources) {
    const url = new URL(source);
    if (url.protocol !== "https:") throw new Error(`Unexpected catalog source: ${source}`);
    hosts.add(url.hostname);
  }
  return hosts;
}

export function isOfficialUrl(value: unknown, hosts: Set<string>): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.has(url.hostname);
  } catch {
    return false;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function validExpression(
  value: unknown,
  validCode: (code: unknown) => code is string = (code): code is string =>
    typeof code === "string" && COURSE_CODE.test(code),
): value is RequirementExpression {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "none") return true;
  if (value.type === "unknown") return typeof value.text === "string" && value.text.length > 0;
  if (value.type === "course") {
    return (
      validCode(value.code) &&
      (value.minimumGrade === undefined || typeof value.minimumGrade === "string") &&
      (value.concurrent === undefined || typeof value.concurrent === "boolean")
    );
  }
  return (
    (value.type === "all" || value.type === "any") &&
    Array.isArray(value.items) &&
    value.items.length >= 2 &&
    value.items.every((item) => validExpression(item, validCode))
  );
}

function expressionCodes(expression: RequirementExpression): string[] {
  if (expression.type === "course") return [expression.code];
  if (expression.type === "all" || expression.type === "any") {
    return [...new Set(expression.items.flatMap(expressionCodes))].sort();
  }
  return [];
}

function validateCourses(
  value: unknown,
  options: {
    validCode: (code: unknown) => code is string;
    isOfficial: (url: unknown) => url is string;
    requirementTypes: Set<Course["requirementType"]>;
    recordLabel: string;
    emptyMessage: string;
  },
): Course[] {
  if (!Array.isArray(value)) throw new Error(`${options.recordLabel} courses are missing`);
  const codes = new Set<string>();
  for (const rawCourse of value) {
    if (!isRecord(rawCourse)) throw new Error(`${options.recordLabel} contains an invalid course`);
    const code = rawCourse.code;
    if (!options.validCode(code)) throw new Error(`Invalid course code: ${String(code)}`);
    if (codes.has(code)) throw new Error(`Duplicate course code: ${code}`);
    codes.add(code);
    if (
      typeof rawCourse.title !== "string" ||
      typeof rawCourse.description !== "string" ||
      typeof rawCourse.credits !== "number" ||
      !Number.isFinite(rawCourse.credits) ||
      rawCourse.credits < 0 ||
      (rawCourse.maxCredits !== undefined &&
        (typeof rawCourse.maxCredits !== "number" ||
          !Number.isFinite(rawCourse.maxCredits) ||
          rawCourse.maxCredits < rawCourse.credits)) ||
      !validExpression(rawCourse.prerequisites, options.validCode) ||
      !validExpression(rawCourse.corequisites, options.validCode) ||
      typeof rawCourse.prerequisiteText !== "string" ||
      typeof rawCourse.corequisiteText !== "string" ||
      !isStringArray(rawCourse.prerequisiteCodes) ||
      !isStringArray(rawCourse.corequisiteCodes) ||
      !isStringArray(rawCourse.unlocks) ||
      !isStringArray(rawCourse.breadthCategories) ||
      !isStringArray(rawCourse.topics) ||
      !rawCourse.topics.every((topic) => TOPICS.has(topic)) ||
      !isStringArray(rawCourse.uncertainties) ||
      typeof rawCourse.electiveEligible !== "boolean" ||
      !options.requirementTypes.has(rawCourse.requirementType as Course["requirementType"]) ||
      !options.isOfficial(rawCourse.officialUrl) ||
      (rawCourse.termOfferings !== undefined && !isStringArray(rawCourse.termOfferings))
    ) {
      throw new Error(
        `${options.recordLabel === "Catalog" ? "Invalid course record" : `Invalid ${options.recordLabel.toLowerCase()} course record`}: ${code}`,
      );
    }
    if (
      rawCourse.requirementType === "external" &&
      rawCourse.credits === 0 &&
      rawCourse.title === `External course (${code})` &&
      !rawCourse.uncertainties.some((warning) => warning.includes("Credits are unknown"))
    ) {
      throw new Error(`External placeholder does not flag unknown credits: ${code}`);
    }
  }
  if (!value.length) throw new Error(options.emptyMessage);
  for (const rawCourse of value) {
    if (
      !isRecord(rawCourse) ||
      !validExpression(rawCourse.prerequisites, options.validCode) ||
      !validExpression(rawCourse.corequisites, options.validCode)
    ) {
      continue;
    }
    const prerequisiteCodes = expressionCodes(rawCourse.prerequisites);
    const corequisiteCodes = expressionCodes(rawCourse.corequisites);
    if (
      !isStringArray(rawCourse.prerequisiteCodes) ||
      !isStringArray(rawCourse.corequisiteCodes) ||
      prerequisiteCodes.join("|") !== [...rawCourse.prerequisiteCodes].sort().join("|") ||
      corequisiteCodes.join("|") !== [...rawCourse.corequisiteCodes].sort().join("|")
    ) {
      throw new Error(`Requirement code indexes do not match parsed expressions: ${String(rawCourse.code)}`);
    }
    const references = [
      ...prerequisiteCodes,
      ...corequisiteCodes,
      ...(isStringArray(rawCourse.unlocks) ? rawCourse.unlocks : []),
    ];
    if (references.some((code) => !codes.has(code))) {
      throw new Error(`Course relationship references missing metadata: ${String(rawCourse.code)}`);
    }
  }
  return value as Course[];
}

export function validateCatalog(value: unknown): asserts value is Catalog {
  if (!isRecord(value)) throw new Error("Catalog must be an object");
  if (!Array.isArray(value.courses) || !isRecord(value.requirements)) {
    throw new Error("Catalog courses or requirements are missing");
  }
  if (!isStringArray(value.sources) || !isStringArray(value.warnings)) {
    throw new Error("Catalog sources or warnings are invalid");
  }
  if (typeof value.lastUpdated !== "string" || Number.isNaN(Date.parse(value.lastUpdated))) {
    throw new Error("Catalog lastUpdated is invalid");
  }
  for (const field of ["id", "university", "program", "adapter"] as const) {
    if (value[field] !== undefined && (typeof value[field] !== "string" || value[field].length === 0)) {
      throw new Error(`Catalog ${field} is invalid`);
    }
  }
  if (typeof value.id === "string" && !/^[a-z0-9][a-z0-9-]{0,80}$/.test(value.id)) {
    throw new Error("Catalog id is invalid");
  }
  const officialHosts = officialHostsFromSources(value.sources);
  const courses = validateCourses(value.courses, {
    validCode: (code): code is string => typeof code === "string" && COURSE_CODE.test(code),
    isOfficial: (url): url is string => isOfficialUrl(url, officialHosts),
    requirementTypes: new Set(["core", "breadth", "elective", "external"]),
    recordLabel: "Catalog",
    emptyMessage: "Catalog contains no courses",
  });
  const codes = new Set(courses.map((course) => course.code));

  const requirements = value.requirements;
  if (
    typeof requirements.name !== "string" ||
    requirements.name.length === 0 ||
    typeof requirements.catalogYear !== "string" ||
    typeof requirements.totalCredits !== "number" ||
    !Number.isFinite(requirements.totalCredits) ||
    requirements.totalCredits <= 0 ||
    typeof requirements.minimumGpa !== "number" ||
    !Number.isFinite(requirements.minimumGpa) ||
    requirements.minimumGpa <= 0 ||
    !isStringArray(requirements.coreCourses) ||
    !isRecord(requirements.breadthRequirements) ||
    typeof requirements.electiveCredits !== "number" ||
    !Number.isFinite(requirements.electiveCredits) ||
    requirements.electiveCredits <= 0 ||
    !isStringArray(requirements.eligibleElectives) ||
    !isOfficialUrl(requirements.officialUrl, officialHosts) ||
    !isStringArray(requirements.rawRules) ||
    !isStringArray(requirements.uncertainties) ||
    typeof requirements.lastUpdated !== "string" ||
    Number.isNaN(Date.parse(requirements.lastUpdated))
  ) {
    throw new Error("Degree requirements are invalid");
  }
  if (!requirements.coreCourses.length || requirements.coreCourses.some((code) => !codes.has(code))) {
    throw new Error("Core course mapping is incomplete");
  }
  if (requirements.eligibleElectives.some((code) => !codes.has(code))) {
    throw new Error("Elective course mapping is incomplete");
  }

  const breadth = requirements.breadthRequirements;
  if (
    typeof breadth.coursesRequired !== "number" ||
    !Number.isInteger(breadth.coursesRequired) ||
    breadth.coursesRequired <= 0 ||
    typeof breadth.minCategories !== "number" ||
    !Number.isInteger(breadth.minCategories) ||
    breadth.minCategories <= 0 ||
    typeof breadth.credits !== "number" ||
    !Number.isFinite(breadth.credits) ||
    breadth.credits <= 0 ||
    !Array.isArray(breadth.categories) ||
    !breadth.categories.length ||
    breadth.minCategories > breadth.categories.length
  ) {
    throw new Error("Breadth requirement is invalid");
  }
  const categoryIds = new Set<string>();
  for (const rawCategory of breadth.categories) {
    if (
      !isRecord(rawCategory) ||
      typeof rawCategory.id !== "string" ||
      !rawCategory.id ||
      categoryIds.has(rawCategory.id) ||
      typeof rawCategory.name !== "string" ||
      !isStringArray(rawCategory.courses) ||
      !rawCategory.courses.length ||
      rawCategory.courses.some((code) => !codes.has(code))
    ) {
      throw new Error("Breadth category mapping is invalid");
    }
    categoryIds.add(rawCategory.id);
  }
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function httpsOrigin(value: unknown, label: string): string {
  if (typeof value !== "string") throw new Error(`${label} must be an HTTPS URL`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an HTTPS URL`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${label} must be an HTTPS URL`);
  }
  return url.origin;
}

function roadmapOrigins(
  officialUrl: unknown,
  allowedOrigins?: readonly string[],
): Set<string> {
  const officialOrigin = httpsOrigin(officialUrl, "Roadmap officialUrl");
  if (!allowedOrigins) return new Set([officialOrigin]);
  const origins = new Set(
    allowedOrigins.map((origin, index) => {
      const parsed = new URL(origin);
      if (
        parsed.protocol !== "https:" ||
        parsed.username ||
        parsed.password ||
        parsed.origin !== origin
      ) {
        throw new Error(`Roadmap allowedOrigins[${index}] must be an HTTPS origin`);
      }
      return origin;
    }),
  );
  if (!origins.has(officialOrigin)) {
    throw new Error("Roadmap officialUrl is outside allowed origins");
  }
  return origins;
}

function isUrlFromOrigins(value: unknown, origins: Set<string>): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      origins.has(url.origin)
    );
  } catch {
    return false;
  }
}

export function validateProgramRoadmap(
  value: unknown,
  allowedOrigins?: readonly string[],
): asserts value is ProgramRoadmap {
  if (!isRecord(value)) throw new Error("Program roadmap must be an object");
  if ("requirements" in value) {
    throw new Error("Program roadmap must not contain degree requirements");
  }
  for (const [field, fieldValue] of [
    ["universityId", value.universityId],
    ["programId", value.programId],
  ] as const) {
    if (typeof fieldValue !== "string" || !SAFE_ID.test(fieldValue)) {
      throw new Error(`Program roadmap ${field} is invalid`);
    }
  }
  for (const [field, fieldValue] of [
    ["university", value.university],
    ["program", value.program],
    ["adapter", value.adapter],
  ] as const) {
    if (typeof fieldValue !== "string" || !fieldValue.trim()) {
      throw new Error(`Program roadmap ${field} is invalid`);
    }
  }
  if (!validTimestamp(value.lastUpdated)) {
    throw new Error("Program roadmap lastUpdated is invalid");
  }
  if (!isStringArray(value.sources) || value.sources.length === 0) {
    throw new Error("Program roadmap sources are invalid");
  }
  if (new Set(value.sources).size !== value.sources.length) {
    throw new Error("Program roadmap sources contain duplicates");
  }
  if (!isStringArray(value.warnings)) {
    throw new Error("Program roadmap warnings are invalid");
  }
  const origins = roadmapOrigins(value.officialUrl, allowedOrigins);
  if (
    !isUrlFromOrigins(value.officialUrl, origins) ||
    !value.sources.includes(value.officialUrl) ||
    value.sources.some((source) => !isUrlFromOrigins(source, origins))
  ) {
    throw new Error("Program roadmap official sources are invalid");
  }
  const courses = validateCourses(value.courses, {
    validCode: isRoadmapCourseCode,
    isOfficial: (url): url is string => isUrlFromOrigins(url, origins),
    requirementTypes: new Set(["program", "external"]),
    recordLabel: "Roadmap",
    emptyMessage: "Program roadmap contains no courses",
  });
  if (!isStringArray(value.programCourseCodes) || value.programCourseCodes.length === 0) {
    throw new Error("Program roadmap course scope is missing");
  }
  if (
    value.programCourseCodes.some((code) => !isRoadmapCourseCode(code)) ||
    new Set(value.programCourseCodes).size !== value.programCourseCodes.length
  ) {
    throw new Error("Program roadmap course scope is invalid");
  }
  const programCodes = new Set(value.programCourseCodes);
  const courseByCode = new Map(courses.map((course) => [course.code, course] as const));
  if (value.programCourseCodes.some((code) => !courseByCode.has(code))) {
    throw new Error("Program roadmap course scope is missing metadata");
  }
  for (const course of courses) {
    const expectedType = programCodes.has(course.code) ? "program" : "external";
    if (
      course.requirementType !== expectedType ||
      course.electiveEligible ||
      course.breadthCategories.length > 0
    ) {
      throw new Error(`Program roadmap fabricates degree classification: ${course.code}`);
    }
  }
  const expectedUnlocks = new Map<string, string[]>();
  for (const course of courses) {
    for (const prerequisite of course.prerequisiteCodes) {
      expectedUnlocks.set(prerequisite, [
        ...(expectedUnlocks.get(prerequisite) ?? []),
        course.code,
      ]);
    }
  }
  for (const course of courses) {
    const expected = [...new Set(expectedUnlocks.get(course.code) ?? [])].sort();
    const actual = [...new Set(course.unlocks)].sort();
    if (
      actual.length !== course.unlocks.length ||
      actual.join("|") !== expected.join("|")
    ) {
      throw new Error(
        `Program roadmap unlock indexes do not match prerequisite edges: ${course.code}`,
      );
    }
  }
}

export function validateDiscoveredPrograms(
  value: unknown,
  allowedOrigins?: readonly string[],
): asserts value is DiscoveredPrograms {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Discovered programs must be a version 1 object");
  }
  if (typeof value.universityId !== "string" || !SAFE_ID.test(value.universityId)) {
    throw new Error("Discovered programs universityId is invalid");
  }
  if (
    typeof value.university !== "string" ||
    !value.university.trim() ||
    typeof value.adapter !== "string" ||
    !value.adapter.trim() ||
    !validTimestamp(value.discoveredAt)
  ) {
    throw new Error("Discovered programs metadata is invalid");
  }
  const sourceOrigin = httpsOrigin(value.sourceUrl, "Discovered programs sourceUrl");
  const origins = allowedOrigins
    ? roadmapOrigins(value.sourceUrl, allowedOrigins)
    : new Set([sourceOrigin]);
  if (!isUrlFromOrigins(value.sourceUrl, origins) || !Array.isArray(value.programs)) {
    throw new Error("Discovered programs source or entries are invalid");
  }
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const program of value.programs) {
    if (
      !isRecord(program) ||
      typeof program.id !== "string" ||
      !SAFE_ID.test(program.id) ||
      ids.has(program.id)
    ) {
      throw new Error(`Discovered programs contain a duplicate or invalid program id: ${String(isRecord(program) ? program.id : program)}`);
    }
    ids.add(program.id);
    if (
      program.universityId !== value.universityId ||
      program.university !== value.university ||
      (program.name !== undefined &&
        (typeof program.name !== "string" || !program.name.trim())) ||
      (program.kind !== undefined &&
        (typeof program.kind !== "string" || !PROGRAM_KINDS.has(program.kind))) ||
      typeof program.status !== "string" ||
      !ROADMAP_STATUSES.has(program.status as RoadmapStatus) ||
      !validTimestamp(program.statusUpdatedAt) ||
      !isUrlFromOrigins(program.officialUrl, origins) ||
      urls.has(program.officialUrl)
    ) {
      throw new Error(`Discovered program is invalid: ${program.id}`);
    }
    urls.add(program.officialUrl);
    if (program.status === "ready" && typeof program.name !== "string") {
      throw new Error(`Ready program is missing its official name: ${program.id}`);
    }
    if (
      (program.reason !== undefined &&
        (typeof program.reason !== "string" ||
          !program.reason.trim() ||
          program.reason.length > 500)) ||
      ((program.status === "unsupported" || program.status === "error") &&
        typeof program.reason !== "string")
    ) {
      throw new Error(`Discovered program reason is invalid: ${program.id}`);
    }
  }
}

export function validateRoadmapCrawlStatus(
  value: unknown,
): asserts value is RoadmapCrawlStatus {
  if (!isRecord(value) || value.version !== 1) {
    throw new Error("Roadmap crawl status must be a version 1 object");
  }
  if (typeof value.universityId !== "string" || !SAFE_ID.test(value.universityId)) {
    throw new Error("Roadmap crawl status universityId is invalid");
  }
  if (
    typeof value.status !== "string" ||
    !ROADMAP_STATUSES.has(value.status as RoadmapStatus) ||
    typeof value.discoveryStatus !== "string" ||
    !ROADMAP_STATUSES.has(value.discoveryStatus as RoadmapStatus) ||
    !validTimestamp(value.updatedAt)
  ) {
    throw new Error("Roadmap crawl status metadata is invalid");
  }
  if (!isStringArray(value.queue)) {
    throw new Error("Roadmap crawl status queue is invalid");
  }
  const queue = new Set<string>();
  for (const id of value.queue) {
    if (!SAFE_ID.test(id)) throw new Error(`Roadmap queue program id is invalid: ${id}`);
    if (queue.has(id)) throw new Error(`Roadmap queue contains duplicate program id: ${id}`);
    queue.add(id);
  }
  if (!isRecord(value.counts)) throw new Error("Roadmap crawl status counts are invalid");
  for (const field of ["queued", "ready", "unsupported", "error"] as const) {
    if (!Number.isInteger(value.counts[field]) || Number(value.counts[field]) < 0) {
      throw new Error(`Roadmap crawl status count is invalid: ${field}`);
    }
  }
  if (value.counts.queued !== value.queue.length) {
    throw new Error("Roadmap crawl status queue count does not match queue");
  }
  if (
    value.reason !== undefined &&
    (typeof value.reason !== "string" || !value.reason.trim() || value.reason.length > 500)
  ) {
    throw new Error("Roadmap crawl status reason is invalid");
  }
}

export function defaultCatalogFilePath(): string {
  if (process.env.CATALOG_DATA_PATH) return process.env.CATALOG_DATA_PATH;
  const id = process.env.CATALOG_ID ?? "neu-mscs-seattle";
  const perId = path.join(process.cwd(), "data", "catalogs", id, "catalog.json");
  if (existsSync(perId)) return perId;
  return path.join(process.cwd(), "data", "catalog.json");
}

let catalogDiskCache: { filePath: string; mtimeMs: number; catalog: Catalog } | null = null;

export function readCatalog(filePath = defaultCatalogFilePath()): Catalog {
  const details = statSync(filePath);
  if (catalogDiskCache && catalogDiskCache.filePath === filePath && catalogDiskCache.mtimeMs === details.mtimeMs) {
    return catalogDiskCache.catalog;
  }
  const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  validateCatalog(value);
  catalogDiskCache = { filePath, mtimeMs: details.mtimeMs, catalog: value };
  return value;
}
