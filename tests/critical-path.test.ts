import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  analyzeCriticalPath,
  analyzeResolvedCriticalPath,
  delayImpactCopy,
  isBottleneckEdge,
  longestSequentialChain,
  pathwayCourseCodes,
  resolveTargetSet,
} from "../lib/critical-path";
import { emptyPlan } from "../lib/plan";
import { prerequisitePathToTarget } from "../lib/target-path";
import type { Catalog, Course, Pathway, RequirementExpression, StudentPlan } from "../lib/types";

const none: RequirementExpression = { type: "none" };
const req = (code: string, options: { concurrent?: boolean } = {}): RequirementExpression => ({
  type: "course",
  code,
  ...options,
});

function course(code: string, overrides: Partial<Course> = {}): Course {
  return {
    code,
    title: code,
    credits: 4,
    description: "",
    prerequisites: none,
    corequisites: none,
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
    ...overrides,
  };
}

function plan(overrides: Partial<StudentPlan> = {}): StudentPlan {
  return { ...emptyPlan(), ...overrides };
}

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;
const pathways = JSON.parse(readFileSync(path.join(process.cwd(), "config", "pathways.json"), "utf8")) as Pathway[];

test("delayImpactCopy matches the product sentence shape", () => {
  assert.equal(
    delayImpactCopy("CS 5800", "CS 7180", "Fall 2027", "Spring 2028"),
    "delaying CS 5800 moves earliest CS 7180 from Fall 2027 → Spring 2028",
  );
});

test("synthetic CS 5800 → CS 7180 delay matches the ticket copy", () => {
  const courses = [
    course("CS 5800"),
    course("CS 6140", { prerequisites: req("CS 5800"), prerequisiteCodes: ["CS 5800"] }),
    course("CS 7180", { prerequisites: req("CS 6140"), prerequisiteCodes: ["CS 6140"] }),
  ];
  const analysis = analyzeCriticalPath(["CS 7180"], courses, emptyPlan());
  assert.equal(analysis.status, "ok");
  assert.deepEqual(analysis.bottleneck, ["CS 5800", "CS 6140", "CS 7180"]);
  assert.equal(analysis.earliestTermName, "Fall 2027");
  assert.equal(analysis.headline, "delaying CS 5800 moves earliest CS 7180 from Fall 2027 → Spring 2028");
  assert.ok(analysis.delayImpacts.some((item) => item.delayedCode === "CS 6140" && item.toTerm === "Spring 2028"));
});

test("NEU MSCS CS 6510 bottleneck is CS 5010 → CS 5500 → CS 6510 and delaying CS 5010 slips a term", () => {
  const analysis = analyzeCriticalPath(["CS 6510"], seattle.courses, emptyPlan());
  assert.equal(analysis.status, "ok");
  assert.deepEqual(analysis.bottleneck, ["CS 5010", "CS 5500", "CS 6510"]);
  assert.equal(analysis.controllingTarget, "CS 6510");
  assert.equal(analysis.earliestTermName, "Fall 2027");
  assert.equal(analysis.headline, "delaying CS 5010 moves earliest CS 6510 from Fall 2027 → Spring 2028");
  assert.equal(analysis.delayImpacts[0]?.delayedCode, "CS 5010");
  assert.ok(analysis.delayImpacts.some((item) => item.delayedCode === "CS 5500" && item.toTerm === "Spring 2028"));
  const path = prerequisitePathToTarget("CS 6510", seattle.courses, emptyPlan());
  assert.deepEqual(longestSequentialChain(path), ["CS 5010", "CS 5500", "CS 6510"]);
});

test("General Software Engineer pathway uses the CS 6510 chain as the multi-course bottleneck", () => {
  const pathway = pathways.find((item) => item.id === "general-software-engineer");
  assert.ok(pathway);
  const resolved = resolveTargetSet(null, pathway.id, pathways);
  assert.equal(resolved.source, "pathway");
  assert.ok(resolved.codes.includes("CS 5500"));
  assert.ok(resolved.codes.includes("CS 6510"));
  const analysis = analyzeCriticalPath(resolved.codes, seattle.courses, emptyPlan(), resolved);
  assert.equal(analysis.status, "ok");
  assert.equal(analysis.source, "pathway");
  assert.equal(analysis.controllingTarget, "CS 6510");
  assert.deepEqual(analysis.bottleneck, ["CS 5010", "CS 5500", "CS 6510"]);
  assert.equal(analysis.headline, "delaying CS 5010 moves earliest CS 6510 from Fall 2027 → Spring 2028");
});

test("Machine Learning pathway bottleneck is CS 5800 unlocking CS 6140", () => {
  const analysis = analyzeResolvedCriticalPath(null, "machine-learning", pathways, seattle.courses, emptyPlan());
  assert.equal(analysis.status, "ok");
  assert.equal(analysis.source, "pathway");
  assert.ok(analysis.bottleneck[0] === "CS 5800" || analysis.bottleneck[0] === "CS 7800");
  assert.ok(analysis.bottleneck.includes("CS 6140") || analysis.bottleneck.includes("CS 6220"));
  assert.match(analysis.headline ?? "", /delaying CS 5800 moves earliest CS 6140 from Spring 2027 → Fall 2027|delaying CS 5800 moves earliest CS 6220 from Spring 2027 → Fall 2027/);
});

test("a course target wins over a career pathway when both are set", () => {
  const resolved = resolveTargetSet("CS 6140", "general-software-engineer", pathways);
  assert.deepEqual(resolved, { codes: ["CS 6140"], label: "CS 6140", source: "course" });
  const analysis = analyzeResolvedCriticalPath("CS 6140", "general-software-engineer", pathways, seattle.courses, emptyPlan());
  assert.deepEqual(analysis.bottleneck, ["CS 5800", "CS 6140"]);
  assert.equal(analysis.headline, "delaying CS 5800 moves earliest CS 6140 from Spring 2027 → Fall 2027");
});

test("completed CS 5010 shortens the CS 6510 bottleneck", () => {
  const withHistory = plan({ completedCourses: ["CS 5010", "CS 5011"] });
  const analysis = analyzeCriticalPath(["CS 6510"], seattle.courses, withHistory);
  assert.deepEqual(analysis.bottleneck, ["CS 5500", "CS 6510"]);
  assert.equal(analysis.earliestTermName, "Spring 2027");
  assert.equal(analysis.headline, "delaying CS 5500 moves earliest CS 6510 from Spring 2027 → Fall 2027");
  assert.ok(!analysis.delayImpacts.some((item) => item.delayedCode === "CS 5010"));
});

test("planned CS 5010 stays on the bottleneck because delaying it still slips CS 6510", () => {
  const withPlan = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2026"
        ? { ...semester, courses: [{ code: "CS 5010", credits: 4 }, { code: "CS 5011", credits: 0 }] }
        : semester,
    ),
  });
  const analysis = analyzeCriticalPath(["CS 6510"], seattle.courses, withPlan);
  assert.ok(analysis.bottleneck.includes("CS 5010"));
  assert.ok(analysis.bottleneck.includes("CS 5500"));
  assert.equal(analysis.bottleneck.at(-1), "CS 6510");
  assert.equal(analysis.headline, "delaying CS 5010 moves earliest CS 6510 from Fall 2027 → Spring 2028");
});

test("no target set is an explicit empty state", () => {
  const analysis = analyzeResolvedCriticalPath(null, null, pathways, seattle.courses, emptyPlan());
  assert.equal(analysis.status, "no-target");
  assert.deepEqual(analysis.bottleneck, []);
  assert.equal(analysis.headline, null);
  assert.match(analysis.earliestSummary, /target course or career direction/i);
});

test("unknown target course does not invent a bottleneck", () => {
  const analysis = analyzeCriticalPath(["CS 9999"], seattle.courses, emptyPlan());
  assert.equal(analysis.status, "unknown-course");
  assert.deepEqual(analysis.bottleneck, []);
});

test("a course with no remaining prerequisites has a one-node chain and no delay copy", () => {
  const analysis = analyzeCriticalPath(["CS 7180"], seattle.courses, emptyPlan());
  assert.equal(analysis.status, "ok");
  assert.deepEqual(analysis.bottleneck, ["CS 7180"]);
  assert.equal(analysis.headline, null);
  assert.deepEqual(analysis.delayImpacts, []);
  assert.equal(analysis.earliestTermName, "Fall 2026");
});

test("already completed target is already-recorded, not a delay scenario", () => {
  const analysis = analyzeCriticalPath(["CS 6510"], seattle.courses, plan({ completedCourses: ["CS 6510"] }));
  assert.equal(analysis.status, "already-recorded");
  assert.equal(analysis.headline, null);
});

test("pathwayCourseCodes keeps first-seen group order without duplicates", () => {
  const codes = pathwayCourseCodes({
    groups: [
      { label: "A", courses: ["CS 5010", "CS 5500"] },
      { label: "B", courses: ["CS 5500", "CS 6510"] },
    ],
  });
  assert.deepEqual(codes, ["CS 5010", "CS 5500", "CS 6510"]);
});

test("isBottleneckEdge is true only for consecutive chain pairs", () => {
  const chain = ["CS 5010", "CS 5500", "CS 6510"];
  assert.equal(isBottleneckEdge("CS 5010", "CS 5500", chain), true);
  assert.equal(isBottleneckEdge("CS 5500", "CS 6510", chain), true);
  assert.equal(isBottleneckEdge("CS 5010", "CS 6510", chain), false);
  assert.equal(isBottleneckEdge("CS 5500", "CS 5010", chain), false);
});
