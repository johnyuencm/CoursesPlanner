/**
 * Per-college config of the generic CourseLeaf adapter (#78).
 *
 * One JSON file in catalog-service/courseleaf/ per college. The adapter id is
 * `courseleaf-<id>`; `aliases` are more adapter ids for the same config.
 * The schema is strict: an unknown key, a non-HTTPS URL or a bad selector throws at load.
 */
import * as cheerio from "cheerio";
import { CODE_GRAMMARS, type CourseCodeGrammar } from "../lib/course-code";
import northeastern from "./courseleaf/northeastern.json";

export const CREDIT_UNITS = ["semester-hours", "quarter-hours", "credits", "units"] as const;
export type CreditUnit = (typeof CREDIT_UNITS)[number];

/** The word that ends the credits text of a course title line, for example "(4 Hours)". */
const CREDIT_WORD: Record<CreditUnit, string> = {
  "semester-hours": "Hour",
  "quarter-hours": "Hour",
  credits: "Credit",
  units: "Unit",
};

const SELECTOR_KEYS = [
  "programIndexLinks",
  "programRequirements",
  "programName",
  "codeLink",
  "credits",
  "courseBlock",
  "courseTitle",
  "courseDescription",
  "courseExtra",
] as const;

export interface CourseLeafConfig {
  id: string;
  aliases: string[];
  codeGrammar: string;
  creditUnit: CreditUnit;
  /** Path prefixes of program pages, for example "/graduate/". */
  programRoots: string[];
  /** Path segments that are never program pages, for example "course-descriptions". */
  nonProgramPaths: string[];
  /** HTTPS URL of a subject's course page. `{subject}` becomes the lower-case subject. */
  courseDescriptionUrl: string;
  selectors: Record<(typeof SELECTOR_KEYS)[number], string>;
}

/** A validated config plus the values that the parser computes from it once. */
export interface CourseLeafLayout {
  config: CourseLeafConfig;
  grammar: CourseCodeGrammar;
  /** A course code at the start of the text. */
  codeAtStart: RegExp;
  /** "CODE. Title. (4 Hours)": groups are code, title, credits text. */
  titleLine: RegExp;
  nonProgramPath: RegExp;
  /** officialUrl of a placeholder course that no cached course page has. */
  placeholderUrl: string;
}

const CONFIG_KEYS = new Set([
  "id",
  "aliases",
  "codeGrammar",
  "creditUnit",
  "programRoots",
  "nonProgramPaths",
  "courseDescriptionUrl",
  "selectors",
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function rejectUnknownKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
}

function stringList(value: unknown, label: string, pattern: RegExp): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && pattern.test(item))) {
    throw new Error(`${label} must be an array of strings that match ${pattern}`);
  }
  return value as string[];
}

const probe = cheerio.load("<div><p>probe</p></div>");

export function parseCourseLeafConfig(value: unknown, label: string): CourseLeafConfig {
  if (!isRecord(value)) throw new Error(`${label} must be a JSON object`);
  rejectUnknownKeys(value, CONFIG_KEYS, label);
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(value.id)) {
    throw new Error(`${label}.id is invalid`);
  }
  const aliases = stringList(value.aliases ?? [], `${label}.aliases`, /^[a-z0-9][a-z0-9-]{0,80}$/);
  if (typeof value.codeGrammar !== "string" || !Object.hasOwn(CODE_GRAMMARS, value.codeGrammar)) {
    throw new Error(`${label}.codeGrammar must be one of: ${Object.keys(CODE_GRAMMARS).join(", ")}`);
  }
  if (!CREDIT_UNITS.includes(value.creditUnit as CreditUnit)) {
    throw new Error(`${label}.creditUnit must be one of: ${CREDIT_UNITS.join(", ")}`);
  }
  const programRoots = stringList(value.programRoots, `${label}.programRoots`, /^\/(?:[a-z0-9-]+\/)+$/);
  if (!programRoots.length) throw new Error(`${label}.programRoots must not be empty`);
  const nonProgramPaths = stringList(value.nonProgramPaths, `${label}.nonProgramPaths`, /^[a-z0-9-]+$/);

  const template = value.courseDescriptionUrl;
  if (typeof template !== "string" || template.split("{subject}").length !== 2) {
    throw new Error(`${label}.courseDescriptionUrl must contain {subject} once`);
  }
  let sample: URL;
  try {
    sample = new URL(template.replace("{subject}", "subj"));
  } catch {
    throw new Error(`${label}.courseDescriptionUrl must be an HTTPS URL`);
  }
  if (sample.protocol !== "https:" || sample.username || sample.password || sample.search || sample.hash) {
    throw new Error(`${label}.courseDescriptionUrl must be an HTTPS URL with no query or fragment`);
  }
  if (!template.startsWith(`${sample.origin}/`)) {
    throw new Error(`${label}.courseDescriptionUrl must put {subject} in the path`);
  }

  if (!isRecord(value.selectors)) throw new Error(`${label}.selectors must be an object`);
  rejectUnknownKeys(value.selectors, new Set(SELECTOR_KEYS), `${label}.selectors`);
  const selectors = {} as CourseLeafConfig["selectors"];
  for (const key of SELECTOR_KEYS) {
    const selector = value.selectors[key];
    if (typeof selector !== "string" || !selector.trim()) throw new Error(`${label}.selectors.${key} is required`);
    try {
      probe(selector);
    } catch (error) {
      throw new Error(`${label}.selectors.${key} is not a valid selector: ${error instanceof Error ? error.message : String(error)}`);
    }
    selectors[key] = selector;
  }

  return {
    id: value.id,
    aliases,
    codeGrammar: value.codeGrammar,
    creditUnit: value.creditUnit as CreditUnit,
    programRoots,
    nonProgramPaths,
    courseDescriptionUrl: template,
    selectors,
  };
}

export function courseLeafLayout(config: CourseLeafConfig): CourseLeafLayout {
  const grammar = CODE_GRAMMARS[config.codeGrammar]!;
  const code = grammar.textPattern;
  const word = CREDIT_WORD[config.creditUnit];
  return {
    config,
    grammar,
    codeAtStart: new RegExp(`^(?:${code.source})`, code.flags),
    titleLine: new RegExp(`^(${code.source})\\.\\s+(.+)\\.\\s+\\(([^()]*(?:${word}|${word}s))\\)$`, code.flags),
    nonProgramPath: config.nonProgramPaths.length
      ? new RegExp(`/(?:${config.nonProgramPaths.map(escapeRegExp).join("|")})(?:/|$)`)
      : /(?!)/,
    placeholderUrl: config.courseDescriptionUrl.slice(0, config.courseDescriptionUrl.indexOf("{subject}")),
  };
}

/**
 * Every CourseLeaf config, validated at load. To add a college, add its JSON file and one line here.
 * ponytail: static imports, because the Worker bundle cannot list a directory.
 */
export const COURSELEAF_CONFIGS: readonly CourseLeafConfig[] = [
  parseCourseLeafConfig(northeastern, "catalog-service/courseleaf/northeastern.json"),
];

export function courseLeafConfig(id: string): CourseLeafConfig {
  const config = COURSELEAF_CONFIGS.find((candidate) => candidate.id === id);
  if (!config) throw new Error(`No CourseLeaf config "${id}" in catalog-service/courseleaf/`);
  return config;
}
