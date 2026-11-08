import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { requirementsV2FromV1, validatePlanV2 } from "../lib/requirements-v2";
import type { Catalog, Course, DegreeRequirementV2, RuleGroup, StudentPlan } from "../lib/types";
import { validatePlan } from "./v2-equivalence";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;

function course(code: string, credits = 4): Course {
  return {
    code,
    title: code,
    credits,
    description: "",
    prerequisites: { type: "none" },
    corequisites: { type: "none" },
    prerequisiteText: "",
    corequisiteText: "",
    prerequisiteCodes: [],
    corequisiteCodes: [],
    unlocks: [],
    breadthCategories: [],
    requirementType: "elective",
    electiveEligible: true,
    topics: [],
    officialUrl: "https://example.test/course",
    uncertainties: [],
  };
}

const codes = ["CS 1", "CS 2", "CS 3", "CS 4", "CS 5", "CS 6"];
const small: Catalog = {
  courses: codes.map((code) => course(code)),
  requirements: seattle.requirements,
  lastUpdated: "2026-11-07",
  sources: [],
  warnings: [],
};

function plan(completedCourses: string[], waivedCourses: string[] = []): StudentPlan {
  return { version: 1, completedCourses, waivedCourses, completedCredits: {}, semesters: [] };
}

function audit(root: RuleGroup, studentPlan: StudentPlan) {
  const requirements: DegreeRequirementV2 = {
    version: 2,
    name: "Test",
    catalogYear: "2026-2027",
    officialUrl: "https://example.test/program",
    uncertainties: [],
    lastUpdated: "2026-11-07",
    root,
  };
  return validatePlanV2(studentPlan, small, requirements);
}

const base = { label: "", rawText: "" };

test("MSCS Seattle v2 form comes from the same parsed v1 data and keeps catalog text", () => {
  const v1 = seattle.requirements;
  const v2 = requirementsV2FromV1(v1);
  assert.equal(v2.root.kind, "all");
  if (v2.root.kind !== "all") return;
  assert.deepEqual(v2.root.children.map((group) => `${group.id}:${group.kind}`), [
    "core:choose-courses",
    "breadth:choose-areas",
    "electives:choose-credits",
    "total:total-credits",
  ]);
  const [core, breadth, electives, total] = v2.root.children;
  assert.ok(core.kind === "choose-courses" && core.count === v1.coreCourses.length);
  assert.ok(breadth.kind === "choose-areas" && breadth.areas === v1.breadthRequirements.categories);
  assert.ok(electives.kind === "choose-credits" && electives.credits === v1.electiveCredits);
  assert.ok(total.kind === "total-credits" && total.credits === v1.totalCredits);
  assert.match(v2.root.rawText, /Complete all courses/);
  assert.match(breadth.rawText, /three courses from at least two/);
  assert.match(electives.rawText, /12 semester hours/);
  assert.match(total.rawText, /32 total semester hours/);
});

test("v1 and v2 agree on 300 seeded random plans over the real MSCS Seattle catalog", () => {
  let seed = 63;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)];
  const pool = [...seattle.courses.map((item) => item.code), "CS 9999"];
  for (let run = 0; run < 300; run += 1) {
    const take = (count: number) => Array.from({ length: count }, () => pick(pool));
    validatePlan(
      {
        version: 1,
        completedCourses: take(Math.floor(random() * 10)),
        waivedCourses: take(Math.floor(random() * 2)),
        completedCredits: {},
        semesters: ["fall", "spring", "summer"].map((id) => ({
          id,
          name: id,
          type: "academic" as const,
          courses: take(Math.floor(random() * 4)).map((code) => ({ code })),
        })),
      },
      seattle,
    );
  }
});

test("choose-courses counts completed and waived slots, and waived courses earn no credit", () => {
  const group: RuleGroup = { ...base, kind: "choose-courses", id: "core", count: 2, courses: ["CS 1", "CS 2", "CS 3"] };
  const partial = audit(group, plan(["CS 3"]));
  assert.equal(partial.root.satisfied, false);
  const done = audit(group, plan(["CS 3"], ["CS 1"]));
  assert.equal(done.root.satisfied, true);
  assert.deepEqual(done.root.courses, ["CS 3"]);
  assert.deepEqual(done.root.waived, ["CS 1"]);
  assert.equal(done.root.credits, 4);
});

test("choose-credits sums every eligible unused course", () => {
  const group: RuleGroup = { ...base, kind: "choose-credits", id: "electives", credits: 8, courses: ["CS 1", "CS 2", "CS 3"] };
  assert.equal(audit(group, plan(["CS 1", "CS 4"])).root.satisfied, false);
  const result = audit(group, plan(["CS 1", "CS 2", "CS 3"])).root;
  assert.equal(result.satisfied, true);
  assert.equal(result.credits, 12);
});

test("choose-areas needs N courses across M areas", () => {
  const group: RuleGroup = {
    ...base,
    kind: "choose-areas",
    id: "breadth",
    count: 2,
    minAreas: 2,
    credits: 8,
    areas: [
      { id: "a", name: "A", courses: ["CS 1", "CS 2"] },
      { id: "b", name: "B", courses: ["CS 3"] },
    ],
  };
  assert.equal(audit(group, plan(["CS 1", "CS 2"])).root.satisfied, false);
  const result = audit(group, plan(["CS 1", "CS 2", "CS 3"])).root;
  assert.equal(result.satisfied, true);
  assert.equal(result.courses.length, 2);
  assert.deepEqual([...result.areas].sort(), ["a", "b"]);
});

test("total-credits counts degree courses only", () => {
  const root: RuleGroup = {
    ...base,
    kind: "all",
    id: "program",
    children: [
      { ...base, kind: "choose-credits", id: "electives", credits: 0, courses: ["CS 1", "CS 2"] },
      { ...base, kind: "total-credits", id: "total", credits: 8 },
    ],
  };
  assert.equal(audit(root, plan(["CS 1", "CS 5"])).root.satisfied, false);
  const result = audit(root, plan(["CS 1", "CS 2", "CS 5"]));
  assert.equal(result.root.children[1].credits, 8);
  assert.equal(result.root.satisfied, true);
  assert.equal(result.satisfied, true);
});

test("all needs every child, and an unmodeled group is never satisfied", () => {
  const unmodeled: RuleGroup = { ...base, kind: "unmodeled", id: "thesis", rawText: "Thesis approved by the committee." };
  const lone = audit(unmodeled, plan(codes));
  assert.equal(lone.root.satisfied, false);
  assert.equal(lone.satisfied, false);
  assert.equal(lone.root.rawText, "Thesis approved by the committee.");

  const core: RuleGroup = { ...base, kind: "choose-courses", id: "core", count: 1, courses: ["CS 1"] };
  const result = audit({ ...base, kind: "all", id: "program", children: [core, unmodeled] }, plan(codes));
  assert.equal(result.root.children[0].satisfied, true);
  assert.equal(result.root.satisfied, false);
  assert.equal(audit({ ...base, kind: "all", id: "program", children: [core] }, plan(codes)).root.satisfied, true);
});

test("one course counts toward one group unless the group allows double counting", () => {
  const first: RuleGroup = { ...base, kind: "choose-courses", id: "first", count: 1, courses: ["CS 1"] };
  const second: RuleGroup = { ...base, kind: "choose-credits", id: "second", credits: 4, courses: ["CS 1"] };
  const exclusive = audit({ ...base, kind: "all", id: "program", children: [first, second] }, plan(["CS 1"]));
  assert.deepEqual(exclusive.root.children.map((child) => child.satisfied), [true, false]);

  const shared = audit(
    { ...base, kind: "all", id: "program", children: [{ ...first, shareCourses: true }, second] },
    plan(["CS 1"]),
  );
  assert.deepEqual(shared.root.children.map((child) => child.satisfied), [true, true]);
  assert.deepEqual(shared.root.courses, ["CS 1"]);
  assert.equal(shared.root.credits, 4);
});

test("allocation is deterministic for any input order", () => {
  const root: RuleGroup = {
    ...base,
    kind: "all",
    id: "program",
    children: [
      {
        ...base,
        kind: "choose-areas",
        id: "breadth",
        count: 2,
        minAreas: 1,
        credits: 8,
        areas: [{ id: "a", name: "A", courses: ["CS 1", "CS 2", "CS 3", "CS 4"] }],
      },
      { ...base, kind: "choose-credits", id: "electives", credits: 4, courses: ["CS 1", "CS 2", "CS 3", "CS 4"] },
    ],
  };
  const forward = audit(root, plan(["CS 1", "CS 2", "CS 3", "CS 4"])).root;
  const backward = audit(root, plan(["CS 4", "CS 3", "CS 2", "CS 1"])).root;
  assert.deepEqual(forward.children[0].courses, ["CS 1", "CS 2"]);
  assert.deepEqual(backward.children[0].courses, forward.children[0].courses);
  assert.deepEqual([...backward.children[1].courses].sort(), [...forward.children[1].courses].sort());
});
