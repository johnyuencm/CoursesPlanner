import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { applyRemainingPathToPlan, emptyPlan, MAX_COURSES_PER_SEMESTER, MAX_SEMESTERS } from "../lib/plan";
import {
  earliestFeasibleTerm,
  matchCourseTarget,
  prerequisitePathToTarget,
  targetPathSnapshot,
} from "../lib/target-path";
import type { Catalog, Course, RequirementExpression, StudentPlan } from "../lib/types";

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

test("unknown target course is an explicit error, not an empty path", () => {
  const pathTo = prerequisitePathToTarget("CS 9999", seattle.courses, emptyPlan());
  assert.equal(pathTo.status, "unknown-course");
  assert.deepEqual(pathTo.nodes, []);
  assert.equal(earliestFeasibleTerm(pathTo, seattle.courses, emptyPlan()).reason, "unknown-course");
  assert.match(earliestFeasibleTerm(pathTo, seattle.courses, emptyPlan()).summary, /not in this catalog/i);
});

test("cyclic remaining prerequisites do not hang and cannot be scheduled", () => {
  const courses = [
    course("A", { prerequisites: req("B"), prerequisiteCodes: ["B"] }),
    course("B", { prerequisites: req("A"), prerequisiteCodes: ["A"] }),
  ];
  const pathTo = prerequisitePathToTarget("A", courses, emptyPlan());
  assert.equal(pathTo.status, "cyclic");
  assert.equal(pathTo.cyclic, true);
  assert.equal(earliestFeasibleTerm(pathTo, courses, emptyPlan()).reason, "cyclic");
});

test("NEU MSCS CS 6510 path uses CS 5010 over CS 5004 and reports remaining + earliest Fall 2027", () => {
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, emptyPlan());
  assert.equal(snapshot.path.status, "ok");
  assert.ok(snapshot.path.remainingCodes.includes("CS 5010"));
  assert.ok(snapshot.path.remainingCodes.includes("CS 5500"));
  assert.ok(!snapshot.path.remainingCodes.includes("CS 5004"));
  assert.ok(snapshot.path.nodes.some((node) => node.code === "CS 5010" && node.role === "remaining"));
  assert.ok(snapshot.path.nodes.some((node) => node.code === "CS 5500" && node.role === "remaining"));
  assert.equal(snapshot.path.nodes.at(-1)?.code, "CS 6510");
  assert.equal(snapshot.path.nodes.at(-1)?.role, "target");
  assert.equal(snapshot.earliest.reason, "ok");
  assert.equal(snapshot.earliest.termName, "Fall 2027");
  assert.match(snapshot.earliest.summary, /prerequisites remaining · earliest Fall 2027/);
});

test("completed CS 5010 shortens the CS 6510 remaining chain", () => {
  const withHistory = plan({ completedCourses: ["CS 5010", "CS 5011"] });
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, withHistory);
  assert.deepEqual(snapshot.path.remainingCodes, ["CS 5500"]);
  assert.ok(snapshot.path.nodes.some((node) => node.code === "CS 5010" && node.role === "completed"));
  assert.equal(snapshot.earliest.termName, "Spring 2027");
  assert.equal(snapshot.earliest.summary, "1 prerequisite remaining · earliest Spring 2027");
});

test("planned CS 5010 counts as satisfied for remaining, but delays CS 5500", () => {
  const withPlan = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2026"
        ? { ...semester, courses: [{ code: "CS 5010", credits: 4 }, { code: "CS 5011", credits: 0 }] }
        : semester,
    ),
  });
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, withPlan);
  assert.deepEqual(snapshot.path.remainingCodes, ["CS 5500"]);
  assert.ok(snapshot.path.nodes.some((node) => node.code === "CS 5010" && node.role === "planned"));
  assert.equal(snapshot.earliest.termName, "Fall 2027");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "CS 5500")?.termName, "Spring 2027");
});

test("a course with no prerequisites is feasible in the first academic term", () => {
  const snapshot = targetPathSnapshot("CS 7180", seattle.courses, emptyPlan());
  assert.deepEqual(snapshot.path.remainingCodes, []);
  assert.equal(snapshot.earliest.termName, "Fall 2026");
  assert.equal(snapshot.earliest.summary, "0 prerequisites remaining · earliest Fall 2026");
});

test("already completed target does not invent a remaining chain", () => {
  const snapshot = targetPathSnapshot("CS 7180", seattle.courses, plan({ completedCourses: ["CS 7180"] }));
  assert.equal(snapshot.earliest.reason, "already-recorded");
  assert.match(snapshot.earliest.summary, /Already completed/);
  assert.deepEqual(snapshot.earliest.placements, []);
});

test("completed CS 6510 target stays empty even though it has catalog prerequisites", () => {
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, plan({ completedCourses: ["CS 6510"] }));
  assert.deepEqual(snapshot.path.remainingCodes, []);
  assert.equal(snapshot.earliest.reason, "already-recorded");
  assert.deepEqual(snapshot.earliest.placements, []);
});

test("planned CS 6510 still expands remaining prerequisites so Add missing chain can backfill", () => {
  const withTarget = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2027" ? { ...semester, courses: [{ code: "CS 6510", credits: 4 }] } : semester,
    ),
  });
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, withTarget);
  assert.equal(snapshot.path.status, "ok");
  assert.ok(snapshot.path.remainingCodes.includes("CS 5010"));
  assert.ok(snapshot.path.remainingCodes.includes("CS 5500"));
  assert.notEqual(snapshot.earliest.reason, "already-recorded");
  assert.equal(snapshot.earliest.reason, "ok");
  assert.equal(snapshot.earliest.termName, "Fall 2027");
  assert.equal(snapshot.earliest.summary, "3 prerequisites remaining · earliest Fall 2027");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "CS 5010")?.termName, "Fall 2026");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "CS 5500")?.termName, "Spring 2027");
  assert.ok(!snapshot.earliest.placements.some((item) => item.code === "CS 6510"));
  const applied = applyRemainingPathToPlan(withTarget, seattle.courses, snapshot.earliest.placements);
  assert.equal(applied.ok, true);
  assert.ok(applied.added.includes("CS 5010"));
  assert.ok(applied.added.includes("CS 5500"));
  assert.ok(
    applied.plan.semesters.some(
      (semester) => semester.id === "fall-2027" && semester.courses.some((item) => item.code === "CS 6510"),
    ),
  );
});

test("planned CS 6510 in Spring 2027 does not place CS 5500 in the same term", () => {
  const withTarget = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "spring-2027" ? { ...semester, courses: [{ code: "CS 6510", credits: 4 }] } : semester,
    ),
  });
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, withTarget);
  assert.ok(snapshot.path.remainingCodes.includes("CS 5500"));
  assert.equal(snapshot.earliest.reason, "cannot-place-before-target");
  assert.equal(snapshot.earliest.summary, "3 prerequisites remaining · cannot fit before Spring 2027");
  assert.equal(
    snapshot.earliest.placements.filter((item) => item.code === "CS 5500" && item.termName === "Spring 2027").length,
    0,
  );
  assert.equal(snapshot.earliest.placements.length, 0);
});

test("waived prerequisite is labeled waived, not completed", () => {
  const snapshot = targetPathSnapshot("CS 6510", seattle.courses, plan({ waivedCourses: ["CS 5010"] }));
  assert.ok(snapshot.path.nodes.some((node) => node.code === "CS 5010" && node.role === "waived"));
  assert.ok(!snapshot.path.nodes.some((node) => node.code === "CS 5010" && node.role === "completed"));
  assert.ok(snapshot.path.remainingCodes.includes("CS 5500"));
  assert.ok(!snapshot.path.remainingCodes.includes("CS 5010"));
});

test("usedOfferings is path-local, not catalog-global", () => {
  const courses = [
    course("A"),
    course("B", { prerequisites: req("A"), prerequisiteCodes: ["A"] }),
    course("Z", { termOfferings: ["Fall"] }),
  ];
  const snapshot = targetPathSnapshot("B", courses, emptyPlan());
  assert.equal(snapshot.earliest.usedOfferings, false);
  assert.equal(snapshot.earliest.reason, "ok");
});

test("catalog term offerings skip terms that do not match", () => {
  const courses = [
    course("A"),
    course("B", { prerequisites: req("A"), prerequisiteCodes: ["A"], termOfferings: ["Fall"] }),
  ];
  const snapshot = targetPathSnapshot("B", courses, emptyPlan());
  assert.deepEqual(snapshot.path.remainingCodes, ["A"]);
  assert.equal(snapshot.earliest.termName, "Fall 2027");
  assert.equal(snapshot.earliest.usedOfferings, true);
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "A")?.termName, "Fall 2026");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "B")?.termName, "Fall 2027");
});

test("OR alternatives prefer an already completed branch", () => {
  const courses = [
    course("X"),
    course("Y"),
    course("Z", {
      prerequisites: { type: "any", items: [req("X"), req("Y")] },
      prerequisiteCodes: ["X", "Y"],
    }),
  ];
  const snapshot = targetPathSnapshot("Z", courses, plan({ completedCourses: ["Y"] }));
  assert.deepEqual(snapshot.path.remainingCodes, []);
  assert.ok(snapshot.path.nodes.some((node) => node.code === "Y" && node.role === "completed"));
  assert.ok(!snapshot.path.nodes.some((node) => node.code === "X"));
  assert.equal(snapshot.earliest.termName, "Fall 2026");
});

test("no academic terms is an explicit empty state", () => {
  const snapshot = targetPathSnapshot("CS 5800", seattle.courses, plan({ semesters: [] }));
  assert.equal(snapshot.earliest.reason, "no-academic-term");
  assert.match(snapshot.earliest.summary, /academic term/i);
});

test("applyRemainingPathToPlan inserts remaining courses by earliest term", () => {
  const snapshot = targetPathSnapshot("CS 5500", seattle.courses, emptyPlan());
  const applied = applyRemainingPathToPlan(emptyPlan(), seattle.courses, snapshot.earliest.placements);
  assert.equal(applied.ok, true);
  assert.ok(applied.added.includes("CS 5010"));
  assert.ok(applied.added.includes("CS 5500"));
  const fall = applied.plan.semesters.find((semester) => semester.id === "fall-2026");
  const spring = applied.plan.semesters.find((semester) => semester.id === "spring-2027");
  assert.ok(fall?.courses.some((item) => item.code === "CS 5010"));
  assert.ok(spring?.courses.some((item) => item.code === "CS 5500"));
});

test("applyRemainingPathToPlan fails closed when a term is at capacity", () => {
  const snapshot = targetPathSnapshot("CS 5500", seattle.courses, emptyPlan());
  const fullFall = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2026"
        ? {
            ...semester,
            courses: Array.from({ length: MAX_COURSES_PER_SEMESTER }, (_, index) => ({
              code: `CS ${1100 + index}`,
            })),
          }
        : semester,
    ),
  });
  const applied = applyRemainingPathToPlan(fullFall, seattle.courses, snapshot.earliest.placements);
  assert.equal(applied.ok, false);
  if (applied.ok) throw new Error("expected capacity failure");
  assert.equal(applied.reason, "capacity");
  assert.deepEqual(applied.added, []);
  assert.deepEqual(applied.plan, fullFall);
  assert.equal(
    applied.plan.semesters.find((semester) => semester.id === "spring-2027")?.courses.length,
    0,
  );
});

test("applyRemainingPathToPlan creates a missing academic term", () => {
  const applied = applyRemainingPathToPlan(emptyPlan(), seattle.courses, [
    { code: "CS 5010", termName: "Fall 2028", semesterId: null },
  ]);
  assert.equal(applied.ok, true);
  assert.deepEqual(applied.createdTerms, ["Fall 2028"]);
  assert.ok(applied.added.includes("CS 5010"));
  const created = applied.plan.semesters.find((semester) => semester.name === "Fall 2028");
  assert.equal(created?.type, "academic");
  assert.ok(created?.courses.some((item) => item.code === "CS 5010"));
  assert.equal(applied.plan.semesters.length, emptyPlan().semesters.length + 1);
});

test("applyRemainingPathToPlan fails closed when creating a term would exceed MAX_SEMESTERS", () => {
  const full = plan({
    semesters: Array.from({ length: MAX_SEMESTERS }, (_, index) => ({
      id: `term-${index}`,
      name: `Term ${index}`,
      type: "academic" as const,
      courses: [],
    })),
  });
  const applied = applyRemainingPathToPlan(full, seattle.courses, [
    { code: "CS 5010", termName: "Fall 2099", semesterId: null },
  ]);
  assert.equal(applied.ok, false);
  if (applied.ok) throw new Error("expected semester-limit failure");
  assert.equal(applied.reason, "semester-limit");
  assert.deepEqual(applied.added, []);
  assert.deepEqual(applied.createdTerms, []);
  assert.deepEqual(applied.plan, full);
  assert.equal(applied.plan.semesters.length, MAX_SEMESTERS);
});

test("concurrent prerequisite waits for non-concurrent dependencies and stays in the same term", () => {
  const courses = [
    course("A"),
    course("B", { prerequisites: req("A"), prerequisiteCodes: ["A"] }),
    course("C", { prerequisites: req("B", { concurrent: true }), prerequisiteCodes: ["B"] }),
  ];
  const snapshot = targetPathSnapshot("C", courses, emptyPlan());
  assert.deepEqual(snapshot.path.remainingCodes, ["A", "B"]);
  assert.equal(snapshot.earliest.reason, "ok");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "A")?.termName, "Fall 2026");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "B")?.termName, "Spring 2027");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "C")?.termName, "Spring 2027");
  assert.equal(snapshot.earliest.termName, "Spring 2027");
});

test("concurrent remaining of a planned target may share that term", () => {
  const courses = [
    course("B"),
    course("C", { prerequisites: req("B", { concurrent: true }), prerequisiteCodes: ["B"] }),
  ];
  const withTarget = plan({
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2026" ? { ...semester, courses: [{ code: "C", credits: 4 }] } : semester,
    ),
  });
  const snapshot = targetPathSnapshot("C", courses, withTarget);
  assert.equal(snapshot.earliest.reason, "ok");
  assert.equal(snapshot.earliest.termName, "Fall 2026");
  assert.equal(snapshot.earliest.summary, "1 prerequisite remaining · earliest Fall 2026");
  assert.equal(snapshot.earliest.placements.find((item) => item.code === "B")?.termName, "Fall 2026");
});

test("concurrent partners with disjoint offerings fail closed instead of splitting terms", () => {
  const courses = [
    course("B", { termOfferings: ["Fall"] }),
    course("C", {
      prerequisites: req("B", { concurrent: true }),
      prerequisiteCodes: ["B"],
      termOfferings: ["Spring"],
    }),
  ];
  const snapshot = targetPathSnapshot("C", courses, emptyPlan());
  assert.equal(snapshot.earliest.reason, "no-matching-offering");
  assert.deepEqual(snapshot.earliest.placements, []);
  assert.equal(snapshot.earliest.usedOfferings, true);
});

test("matchCourseTarget accepts compact and spaced codes", () => {
  assert.equal(matchCourseTarget("cs5500", seattle.courses), "CS 5500");
  assert.equal(matchCourseTarget("CS 6510", seattle.courses), "CS 6510");
  assert.equal(matchCourseTarget("CS 9999", seattle.courses), "CS 9999");
  assert.equal(matchCourseTarget("  ", seattle.courses), null);
});
