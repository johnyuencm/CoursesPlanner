import { strict as assert } from "node:assert";
import test from "node:test";

import { overviewSnapshot } from "../lib/overview";
import { emptyPlan } from "../lib/plan";
import { legacyRedirects, primaryNav, routes, targetPathHref } from "../lib/routes";
import type { Catalog, Course, RequirementExpression, StudentPlan } from "../lib/types";
import { validatePlan } from "../lib/validation";

const none: RequirementExpression = { type: "none" };
const req = (code: string): RequirementExpression => ({ type: "course", code });

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

function catalog(): Catalog {
  const courses = [
    course("CS 5010", { requirementType: "core", unlocks: ["CS 5500", "CS 6510"] }),
    course("CS 5011", { credits: 0, requirementType: "core" }),
    course("CS 5800", { requirementType: "core" }),
    course("CS 5500", {
      requirementType: "breadth",
      breadthCategories: ["systems"],
      prerequisites: req("CS 5010"),
      prerequisiteCodes: ["CS 5010"],
    }),
    course("CS 6510", {
      requirementType: "breadth",
      breadthCategories: ["systems"],
      prerequisites: req("CS 5010"),
      prerequisiteCodes: ["CS 5010"],
    }),
    course("CS 6100"),
  ];
  return {
    courses,
    requirements: {
      name: "MSCS",
      catalogYear: "2026-2027",
      totalCredits: 32,
      minimumGpa: 3,
      coreCourses: ["CS 5010", "CS 5011", "CS 5800"],
      breadthRequirements: {
        coursesRequired: 3,
        minCategories: 2,
        credits: 12,
        categories: [
          { id: "systems", name: "Systems", courses: ["CS 5500", "CS 6510"] },
          { id: "theory", name: "Theory", courses: [] },
          { id: "software", name: "Software", courses: [] },
        ],
      },
      electiveCredits: 12,
      eligibleElectives: ["CS 6100"],
      officialUrl: "https://example.test/program",
      rawRules: [],
      uncertainties: [],
      lastUpdated: "2026-09-10",
    },
    lastUpdated: "2026-09-10",
    sources: [],
    warnings: [],
  };
}

test("primary nav is Explore, Plan, Courses, Paths", () => {
  assert.deepEqual(
    primaryNav.map((item) => item.label),
    ["Explore", "Plan", "Courses", "Paths"],
  );
  assert.deepEqual(
    primaryNav.map((item) => item.href),
    [routes.explore, routes.plan, routes.courses, routes.paths],
  );
  assert.equal(routes.explore, "/explore");
  assert.equal(routes.overview, "/");
});

test("legacy /map bookmark redirects to Explore", () => {
  assert.deepEqual([...legacyRedirects], [{ source: "/map", destination: "/explore", permanent: true }]);
});

test("target path panel is anchored on Plan", () => {
  assert.equal(targetPathHref, "/planner#target-path");
});

test("slim overview reports credits, target, critical prereq, and next unlock", () => {
  const data = catalog();
  const empty = overviewSnapshot({
    catalog: data,
    plan: emptyPlan(),
    progress: validatePlan(emptyPlan(), data),
    targetName: null,
  });
  assert.equal(empty.credits.current, 0);
  assert.equal(empty.credits.required, 32);
  assert.equal(empty.targetName, null);
  assert.equal(empty.criticalPrereq, null);
  assert.equal(empty.nextUnlock?.code, "CS 5010");
  assert.deepEqual(empty.nextUnlock?.unlocks, ["CS 5500", "CS 6510"]);

  const blockedPlan: StudentPlan = {
    version: 1,
    completedCourses: [],
    waivedCourses: [],
    completedCredits: {},
    semesters: [{ id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 5500", credits: 4 }] }],
  };
  const blocked = overviewSnapshot({
    catalog: data,
    plan: blockedPlan,
    progress: validatePlan(blockedPlan, data),
    targetName: "Robotics",
  });
  assert.equal(blocked.targetName, "Robotics");
  assert.equal(blocked.criticalPrereq?.courseCode, "CS 5500");
  assert.match(blocked.criticalPrereq?.message ?? "", /CS 5010/);
});
