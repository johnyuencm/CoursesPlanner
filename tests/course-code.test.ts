import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import roadmap from "../data/catalogs/northeastern/roadmaps/computer-science-mscs-sea-8b0d00dbda.json";
import { getAdapter, registeredAdapters } from "../catalog-service/adapters";
import { readCatalog, validateCatalog } from "../lib/catalog";
import {
  type CourseCodeGrammar,
  KNOWN_ADAPTER_IDS,
  catalogCodeGrammar,
  courseCodeGrammar,
  northeasternCodeGrammar,
} from "../lib/course-code";
import { courseSlug } from "../lib/course-pages";
import { parsePlan } from "../lib/plan";
import { parseExploreFocus } from "../lib/routes";
import { matchCourseTarget } from "../lib/target-path";
import type { Catalog, Course } from "../lib/types";

const grammar = northeasternCodeGrammar;
// The hardcoded pattern that #68 replaces with the grammar.
const OLD_PATTERN = /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/;

test("Northeastern grammar round-trips real fixture codes: display -> canonical -> slug", () => {
  const cases: Array<[input: string, canonical: string, slug: string, subject: string]> = [
    ["CS 5800", "CS 5800", "cs-5800", "CS"],
    ["cs5800", "CS 5800", "cs-5800", "CS"],
    ["DADS 7275", "DADS 7275", "dads-7275", "DADS"],
    ["dads-7275", "DADS 7275", "dads-7275", "DADS"],
    ["CIS 200M", "CIS 200M", "cis-200m", "CIS"],
    [" cis+200m ", "CIS 200M", "cis-200m", "CIS"],
  ];
  for (const [input, canonical, slug, subject] of cases) {
    assert.equal(grammar.normalize(input), canonical, input);
    assert.ok(grammar.pattern.test(canonical), canonical);
    assert.equal(grammar.display(canonical), canonical);
    assert.equal(grammar.normalize(grammar.display(canonical)), canonical, "display text normalizes back");
    assert.equal(grammar.slug(canonical), slug);
    assert.equal(grammar.subject(canonical), subject);
  }
});

test("Northeastern grammar gives today's results for every packaged course code", async () => {
  const codes = new Set([...(await readCatalog()).courses, ...roadmap.courses].map((course) => course.code));
  assert.ok(codes.size > 100, "fixtures hold real codes");
  for (const code of codes) {
    assert.equal(grammar.pattern.test(code), OLD_PATTERN.test(code), code);
    assert.equal(grammar.normalize(code), code, code);
    assert.equal(grammar.display(code), code);
    assert.equal(grammar.slug(code), courseSlug(code), code);
    assert.equal(grammar.subject(code), code.match(/^([A-Z]{2,6}) /)?.[1] ?? null, code);
  }
});

test("Northeastern normalizer matches the explore-focus parser on loose and invalid input", () => {
  const inputs = [
    "CS 5500", "cs5500", "CS-5500", "cs+5500", "  CS   5500 ", "CS 7980A", "cis 200m", "DADS7275",
    "", "   ", "CS", "CS 5", "CS 58000", "C 5800", "CSABCDE 5800", "CS 5800ABC", "../etc", "6.1210", "15-122",
  ];
  for (const input of inputs) assert.equal(grammar.normalize(input), parseExploreFocus(input), JSON.stringify(input));
  assert.equal(grammar.pattern.test("cs 5800"), false, "canonical codes are upper case");
  assert.equal(grammar.pattern.test("CS  5800"), false, "canonical codes use one space");
  assert.equal(grammar.subject("6.1210"), null);
});

test("each adapter declares the grammar that the lookup returns", async () => {
  for (const id of registeredAdapters()) assert.equal(getAdapter(id).codeGrammar, courseCodeGrammar(id), id);
  assert.equal(courseCodeGrammar((await readCatalog()).adapter!), northeasternCodeGrammar);
  assert.throws(() => courseCodeGrammar("no-such-adapter"), /no-such-adapter/);
});

// Test-only grammars for code shapes that other colleges use.
const mitLike: CourseCodeGrammar = {
  pattern: /^\d{1,2}\.\d{2,4}[A-Z]?$/,
  textPattern: /\b\d{1,2}\.\d{2,4}[A-Z]?\b/i,
  subjectPattern: /^\d{1,2}$/,
  normalize(input) {
    const code = input.trim().toUpperCase().replace(/\s+/g, "");
    return this.pattern.test(code) ? code : null;
  },
  display: (code) => code,
  slug: (code) => code.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  subject: (code) => code.split(".")[0] ?? null,
};

const cmuLike: CourseCodeGrammar = {
  pattern: /^\d{2}-\d{3}$/,
  textPattern: /\b\d{2}-\d{3}\b/i,
  subjectPattern: /^\d{2}$/,
  normalize(input) {
    const match = input.trim().match(/^(\d{2})\s*-?\s*(\d{3})$/);
    return match ? `${match[1]}-${match[2]}` : null;
  },
  display: (code) => code,
  slug: (code) => code,
  subject: (code) => code.slice(0, 2),
};

test("dotted and dashed codes work through the grammar interface", () => {
  const cases: Array<[CourseCodeGrammar, string, string, string, string]> = [
    [mitLike, " 6.1210 ", "6.1210", "6-1210", "6"],
    [mitLike, "18.06", "18.06", "18-06", "18"],
    [cmuLike, "15-122", "15-122", "15-122", "15"],
    [cmuLike, "15122", "15-122", "15-122", "15"],
  ];
  for (const [codeGrammar, input, canonical, slug, subject] of cases) {
    assert.equal(codeGrammar.normalize(input), canonical, input);
    assert.ok(codeGrammar.pattern.test(canonical));
    assert.equal(codeGrammar.normalize(codeGrammar.display(canonical)), canonical);
    assert.equal(codeGrammar.slug(canonical), slug);
    assert.equal(codeGrammar.subject(canonical), subject);
  }
  assert.equal(mitLike.normalize("CS 5800"), null);
  assert.equal(cmuLike.normalize("6.1210"), null);
  assert.equal(grammar.normalize("15-122"), null);
});

/** Smallest valid catalog: `second` requires `first`. */
function twoCourseCatalog(first: string, second: string, adapter?: string): Catalog {
  const url = "https://catalog.example.edu/courses/";
  const course = (code: string, prerequisites: string[]): Course => ({
    code,
    title: `Course ${code}`,
    credits: 4,
    description: "Real catalog text.",
    prerequisites: prerequisites.length ? { type: "course", code: prerequisites[0]! } : { type: "none" },
    corequisites: { type: "none" },
    prerequisiteText: prerequisites.join(" and "),
    corequisiteText: "",
    prerequisiteCodes: prerequisites,
    corequisiteCodes: [],
    unlocks: prerequisites.length ? [] : [second],
    breadthCategories: prerequisites.length ? ["area"] : [],
    topics: [],
    uncertainties: [],
    electiveEligible: prerequisites.length > 0,
    requirementType: prerequisites.length ? "breadth" : "core",
    officialUrl: url,
  });
  return {
    ...(adapter ? { adapter } : {}),
    courses: [course(first, []), course(second, [first])],
    requirements: {
      name: "Test program",
      catalogYear: "2026-2027",
      totalCredits: 8,
      minimumGpa: 3,
      coreCourses: [first],
      breadthRequirements: { coursesRequired: 1, minCategories: 1, credits: 4, categories: [{ id: "area", name: "Area", courses: [second] }] },
      electiveCredits: 4,
      eligibleElectives: [second],
      officialUrl: url,
      rawRules: [],
      uncertainties: [],
      lastUpdated: "2026-11-08T00:00:00.000Z",
    },
    lastUpdated: "2026-11-08T00:00:00.000Z",
    sources: [url],
    warnings: [],
  } as Catalog;
}

test("catalog trust boundary uses the catalog's grammar: 6.1210 and 15-122 pass with a matching grammar", () => {
  const mit = twoCourseCatalog("6.1010", "6.1210");
  const cmu = twoCourseCatalog("15-112", "15-122");
  assert.doesNotThrow(() => validateCatalog(mit, mitLike));
  assert.doesNotThrow(() => validateCatalog(cmu, cmuLike));
  assert.throws(() => validateCatalog(mit), /Invalid course code: 6\.1010/, "no adapter: Northeastern grammar");
  assert.throws(() => validateCatalog(cmu, mitLike), /Invalid course code: 15-112/);
  assert.doesNotThrow(() => validateCatalog(twoCourseCatalog("CS 5010", "CS 5800", "northeastern-acalog")));
  assert.throws(() => validateCatalog(twoCourseCatalog("CS 5010", "CS 5800", "no-such-adapter")), /no-such-adapter/);
});

test("plan validation, explore focus and target matching take the active grammar", () => {
  const plan = { version: 1, completedCourses: ["6.1210"], waivedCourses: [], completedCredits: { "6.1210": 4 }, semesters: [] };
  assert.deepEqual(parsePlan(plan, mitLike).completedCourses, ["6.1210"]);
  assert.throws(() => parsePlan(plan), /course code/, "the default (stored plan) grammar is Northeastern");
  assert.equal(parseExploreFocus("15122", cmuLike), "15-122");
  assert.equal(parseExploreFocus("6.1210", mitLike), "6.1210");
  assert.equal(parseExploreFocus("6.1210"), null);
  const mitCourses = twoCourseCatalog("6.1010", "6.1210").courses;
  assert.equal(matchCourseTarget("6.1210", mitCourses, mitLike), "6.1210");
  assert.equal(matchCourseTarget("6.9999", mitCourses, mitLike), "6.9999");
  assert.equal(matchCourseTarget("15-122", [], cmuLike), "15-122");
  assert.equal(matchCourseTarget("6.9999", mitCourses), null);
});

test("target matching strictness: codes outside the catalog must be canonical after case and space cleanup", async () => {
  const courses = (await readCatalog()).courses;
  assert.equal(matchCourseTarget("cs5800", courses), "CS 5800", "catalog match ignores case and spaces");
  assert.equal(matchCourseTarget("cs  9999", courses), "CS 9999");
  assert.equal(matchCourseTarget("CS9999", courses), null, "no normalize() widening outside the catalog");
  assert.equal(matchCourseTarget("cs-9999", courses), null);
});

test("textPattern finds codes in free text and subjectPattern checks subject keys", () => {
  const text = "Prerequisite(s): CS 5010 with a minimum grade of C- or cs  5004; DS 4400 (may be taken concurrently). See MATH1341.";
  const find = new RegExp(grammar.textPattern.source, `${grammar.textPattern.flags}g`);
  assert.deepEqual([...text.matchAll(find)].map((match) => grammar.normalize(match[0])), ["CS 5010", "CS 5004", "DS 4400"]);
  const mitFind = new RegExp(mitLike.textPattern.source, "gi");
  assert.deepEqual([..."Take 6.1010 then 6.1210.".matchAll(mitFind)].map((match) => match[0]), ["6.1010", "6.1210"]);
  for (const key of ["CS", "DADS", "EECE"]) assert.ok(grammar.subjectPattern.test(key), key);
  for (const key of ["cs", "C", "ABCDEFG", "CS1"]) assert.equal(grammar.subjectPattern.test(key), false, key);
});

test("grammar lookup ignores inherited keys, and the adapter id list has one source", () => {
  for (const id of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
    assert.throws(() => courseCodeGrammar(id), /No course-code grammar/, id);
  }
  assert.deepEqual([...KNOWN_ADAPTER_IDS].sort(), registeredAdapters().sort());
  assert.equal(catalogCodeGrammar(null), northeasternCodeGrammar);
  assert.equal(catalogCodeGrammar({}), northeasternCodeGrammar);
});

test("no hardcoded course-code pattern outside lib/course-code.ts", () => {
  const root = process.cwd();
  const files = ["app", "components", "lib", "catalog-service", "scraper"].flatMap((dir) =>
    readdirSync(path.join(root, dir), { recursive: true, encoding: "utf8" }).map((file) => path.join(dir, file)),
  );
  const offenders = [...files, "worker.ts"]
    .filter((file) => /\.(ts|tsx)$/.test(file) && path.normalize(file) !== path.normalize("lib/course-code.ts"))
    .filter((file) => /\[A-Z\]\{2,/.test(readFileSync(path.join(root, file), "utf8")));
  assert.deepEqual(offenders, []);
});
