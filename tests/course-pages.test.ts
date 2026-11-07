import { strict as assert } from "node:assert";
import test from "node:test";

import pathwayConfig from "../config/pathways.json";
import { readCatalog } from "../lib/catalog";
import {
  courseBySlug,
  courseSlug,
  requirementText,
  shortestPrerequisiteChain,
  unmetRequirements,
  pathwaysFor,
  publicCourses,
  requirementLabel,
  transitiveUnlocks,
} from "../lib/course-pages";
import type { Course, Pathway } from "../lib/types";

const course = (code: string, prerequisiteCodes: string[], unlocks: string[]): Course => ({
  code, title: code, credits: 4, description: "Real text.", prerequisites: { type: "none" }, corequisites: { type: "none" },
  prerequisiteText: "", corequisiteText: "", prerequisiteCodes, corequisiteCodes: [], unlocks, breadthCategories: [],
  requirementType: "elective", electiveEligible: true, topics: [], officialUrl: "https://catalog.northeastern.edu/", uncertainties: [],
});

test("course slugs are URL-safe and round-trip through the packaged catalog", () => {
  assert.equal(courseSlug("CS 5010"), "cs-5010");
  assert.equal(courseSlug("CS 7980A"), "cs-7980a");
  const catalog = readCatalog();
  const pages = publicCourses(catalog);
  assert.equal(new Set(pages.map((item) => courseSlug(item.code))).size, pages.length, "two courses share a slug");
  assert.equal(courseBySlug(catalog, "cs-5010")?.code, "CS 5010");
  assert.equal(courseBySlug(catalog, "../etc"), undefined);
});

test("placeholder courses (no catalog text) get no page", () => {
  const catalog = readCatalog();
  const pages = publicCourses(catalog);
  assert.ok(pages.length > 90, `only ${pages.length} course pages`);
  assert.ok(pages.every((item) => !item.description.includes("unavailable in the cached")));
  assert.equal(courseBySlug(catalog, "cis-200m"), undefined);
});

const one = (code: string) => ({ type: "course" as const, code });

test("unlocks follow links forward and stop at cycles", () => {
  const courses = [course("A", ["C"], ["B"]), course("B", ["A"], ["C"]), course("C", ["B"], ["A"])];
  assert.deepEqual(transitiveUnlocks("A", courses), ["B", "C"]);
  assert.deepEqual(transitiveUnlocks("C", [course("C", [], [])]), []);
});

test("the shortest chain takes the long branch of an 'and' and the short branch of an 'or'", () => {
  const x = course("X", [], ["Y"]);
  const y = { ...course("Y", ["X"], ["Z"]), prerequisites: one("X") };
  const w = course("W", [], ["Z"]);
  // Z needs (Y or W) and V. V is outside the catalog: one course, no known prerequisites.
  const z = { ...course("Z", ["Y", "W", "V"], []), prerequisites: { type: "all" as const, items: [{ type: "any" as const, items: [one("Y"), one("W")] }, one("V")] } };
  assert.deepEqual(shortestPrerequisiteChain("Z", [x, y, w, z]), ["W", "Z"]);
  const zAnd = { ...z, prerequisites: { type: "all" as const, items: [one("Y"), one("W")] } };
  assert.deepEqual(shortestPrerequisiteChain("Z", [x, y, w, zAnd]), ["X", "Y", "Z"]);
  const loop = { ...course("L", ["L2"], []), prerequisites: one("L2") };
  const loop2 = { ...course("L2", ["L"], []), prerequisites: one("L") };
  assert.deepEqual(shortestPrerequisiteChain("L", [loop, loop2]), ["L2", "L"], "a cycle stops");
});

test("prerequisite text keeps and/or, and unmet groups respect 'or'", () => {
  const expr = { type: "all" as const, items: [{ type: "any" as const, items: [one("CS 5800"), one("CS 7800")] }, one("MATH 2331")] };
  assert.equal(requirementText(expr), "(CS 5800 or CS 7800) and MATH 2331");
  assert.deepEqual(unmetRequirements(expr, new Set(["CS 5800"])), [["MATH 2331"]], "CS 7800 is an alternative, not a gap");
  assert.deepEqual(unmetRequirements(expr, new Set()), [["CS 5800", "CS 7800"], ["MATH 2331"]]);
  assert.deepEqual(unmetRequirements({ type: "none" }, new Set()), []);
  // "(A and B) or C": A alone is not an option, so only C is offered.
  const andInOr = { type: "any" as const, items: [{ type: "all" as const, items: [one("A"), one("B")] }, one("C")] };
  assert.deepEqual(unmetRequirements(andInOr, new Set()), [["C"]]);
  const twoAnds = { type: "any" as const, items: [{ type: "all" as const, items: [one("A"), one("B")] }, { type: "all" as const, items: [one("C"), one("D")] }] };
  assert.deepEqual(unmetRequirements(twoAnds, new Set()), [["A"], ["B"]]);
  // Real data: CS 5500 lists CS 5010 twice (two grade floors) inside nested "or" groups.
  const cs5500 = readCatalog().courses.find((item) => item.code === "CS 5500")!;
  assert.equal(requirementText(cs5500.prerequisites), "CS 5010 or CS 5004");
});

test("paths and requirement labels come from the packaged config and catalog", () => {
  const catalog = readCatalog();
  const used = pathwaysFor("CS 5335", pathwayConfig as Pathway[]);
  assert.ok(used.some(({ pathway, group }) => pathway.id === "robotics-software-engineer" && group === "High relevance"));
  assert.equal(requirementLabel(catalog.courses.find((item) => item.code === "CS 5010")!, catalog), "Required core course");
  const breadth = catalog.courses.find((item) => item.requirementType === "breadth")!;
  assert.match(requirementLabel(breadth, catalog), /^Breadth course: /);
  // CS 5003 is only a corequisite (of CS 5001), not a prerequisite for anything.
  assert.equal(requirementLabel(catalog.courses.find((item) => item.code === "CS 5003")!, catalog), "Outside the degree requirements");
});
