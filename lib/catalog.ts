import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Catalog, RequirementExpression } from "./types";

const TOPICS = new Set([
  "Robotics",
  "AI / ML",
  "Systems",
  "Software Engineering",
  "Data",
  "Networks / Security",
]);
const COURSE_CODE = /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/;

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

function validExpression(value: unknown): value is RequirementExpression {
  if (!isRecord(value) || typeof value.type !== "string") return false;
  if (value.type === "none") return true;
  if (value.type === "unknown") return typeof value.text === "string" && value.text.length > 0;
  if (value.type === "course") {
    return (
      typeof value.code === "string" &&
      COURSE_CODE.test(value.code) &&
      (value.minimumGrade === undefined || typeof value.minimumGrade === "string") &&
      (value.concurrent === undefined || typeof value.concurrent === "boolean")
    );
  }
  return (
    (value.type === "all" || value.type === "any") &&
    Array.isArray(value.items) &&
    value.items.length >= 2 &&
    value.items.every(validExpression)
  );
}

function expressionCodes(expression: RequirementExpression): string[] {
  if (expression.type === "course") return [expression.code];
  if (expression.type === "all" || expression.type === "any") {
    return [...new Set(expression.items.flatMap(expressionCodes))].sort();
  }
  return [];
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

  const codes = new Set<string>();
  for (const rawCourse of value.courses) {
    if (!isRecord(rawCourse)) throw new Error("Catalog contains an invalid course");
    const code = rawCourse.code;
    if (typeof code !== "string" || !COURSE_CODE.test(code)) {
      throw new Error(`Invalid course code: ${String(code)}`);
    }
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
      !validExpression(rawCourse.prerequisites) ||
      !validExpression(rawCourse.corequisites) ||
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
      !["core", "breadth", "elective", "external"].includes(String(rawCourse.requirementType)) ||
      !isOfficialUrl(rawCourse.officialUrl, officialHosts)
    ) {
      throw new Error(`Invalid course record: ${code}`);
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
  if (!value.courses.length) throw new Error("Catalog contains no courses");
  for (const rawCourse of value.courses) {
    if (!isRecord(rawCourse) || !validExpression(rawCourse.prerequisites) || !validExpression(rawCourse.corequisites)) continue;
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
    const references = [...prerequisiteCodes, ...corequisiteCodes, ...(isStringArray(rawCourse.unlocks) ? rawCourse.unlocks : [])];
    if (references.some((code) => !codes.has(code))) {
      throw new Error(`Course relationship references missing metadata: ${String(rawCourse.code)}`);
    }
  }

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

export function defaultCatalogFilePath(): string {
  if (process.env.CATALOG_DATA_PATH) return process.env.CATALOG_DATA_PATH;
  const id = process.env.CATALOG_ID ?? "neu-mscs-seattle";
  const perId = path.join(process.cwd(), "data", "catalogs", id, "catalog.json");
  if (existsSync(perId)) return perId;
  return path.join(process.cwd(), "data", "catalog.json");
}

export function readCatalog(filePath = defaultCatalogFilePath()): Catalog {
  const value: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  validateCatalog(value);
  return value;
}
