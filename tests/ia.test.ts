import { strict as assert } from "node:assert";
import test from "node:test";

import { overviewSnapshot } from "../lib/overview";
import { emptyPlan } from "../lib/plan";
import { DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { legacyRedirects, parseExploreFocus, primaryNav, programRoutes } from "../lib/routes";
import type { Catalog, Course, RequirementExpression, StudentPlan } from "../lib/types";
import { validatePlan } from "../lib/requirements-v2";
import { mscsRequirements } from "./mscs-requirements";

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
    requirements: mscsRequirements({
      core: ["CS 5010", "CS 5011", "CS 5800"],
      areas: [
        { id: "systems", name: "Systems", courses: ["CS 5500", "CS 6510"] },
        { id: "theory", name: "Theory", courses: [] },
        { id: "software", name: "Software", courses: [] },
      ],
      electives: ["CS 6100"],
    }),
    lastUpdated: "2026-09-10",
    sources: [],
    warnings: [],
  };
}

const base = `/${DEFAULT_CATALOG_KEY}`;
const routes = programRoutes(DEFAULT_CATALOG_KEY);

test("primary nav is Explore, Plan, Courses, Paths under the program path", () => {
  assert.deepEqual(
    primaryNav(routes).map((item) => item.label),
    ["Explore", "Plan", "Courses", "Paths"],
  );
  assert.deepEqual(
    primaryNav(routes).map((item) => item.href),
    [`${base}/explore`, `${base}/planner`, `${base}/courses`, `${base}/pathways`],
  );
  assert.equal(routes.overview, base);
  assert.equal(base, "/northeastern/computer-science-mscs-sea-8b0d00dbda");
  assert.equal(programRoutes("mit/eecs").course("6-1010"), "/mit/eecs/courses/6-1010");
  assert.equal(programRoutes("mit/eecs").pathway("systems"), "/mit/eecs/pathways/systems");
});

test("old top-level URLs redirect to the default program (#71)", () => {
  assert.deepEqual(legacyRedirects, [
    { source: "/", destination: base, permanent: false }, // T8 (#72) makes / the program picker
    { source: "/map", destination: `${base}/explore`, permanent: true },
    { source: "/explore", destination: `${base}/explore`, permanent: true },
    { source: "/planner", destination: `${base}/planner`, permanent: true },
    { source: "/courses", destination: `${base}/courses`, permanent: true },
    { source: "/pathways", destination: `${base}/pathways`, permanent: true },
    { source: "/courses/:slug", destination: `${base}/courses/:slug`, permanent: true },
    { source: "/pathways/:id", destination: `${base}/pathways/:id`, permanent: true },
  ]);
});

test("target path panel is anchored on Plan", () => {
  assert.equal(routes.targetPath, `${base}/planner#target-path`);
});

test("critical path panel is anchored on Plan", () => {
  assert.equal(routes.criticalPath, `${base}/planner#critical-path`);
});

test("Courses View dependency graph deep-links into Explore focus", () => {
  assert.equal(routes.exploreFocus("CS 5500"), `${base}/explore?focus=CS%205500`);
  assert.equal(parseExploreFocus("CS5500"), "CS 5500");
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
