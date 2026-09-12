import { strict as assert } from "node:assert";
import test from "node:test";

import type { Catalog, Course, RequirementExpression, StudentPlan } from "../lib/types";
import {
  dependencyClosure,
  evaluateRequirement,
  expressionLabel,
  getEligibility,
  validatePlan,
} from "../lib/validation";

const none: RequirementExpression = { type: "none" };
const req = (code: string, options: { minimumGrade?: string; concurrent?: boolean } = {}): RequirementExpression => ({
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

function catalog(extraCourses: Course[] = []): Catalog {
  const courses = [
    course("CS 5010", { requirementType: "core", corequisites: req("CS 5011"), corequisiteCodes: ["CS 5011"] }),
    course("CS 5011", {
      credits: 0,
      requirementType: "core",
      corequisites: req("CS 5010"),
      corequisiteCodes: ["CS 5010"],
    }),
    course("CS 5800", { requirementType: "core" }),
    course("CS 5100", { requirementType: "breadth", breadthCategories: ["systems"] }),
    course("CS 5101", { requirementType: "breadth", breadthCategories: ["systems"] }),
    course("CS 5200", { requirementType: "breadth", breadthCategories: ["theory"] }),
    course("CS 5300", { requirementType: "breadth", breadthCategories: ["software"] }),
    course("CS 6100"),
    course("CS 6110"),
    course("CS 6120"),
    ...extraCourses,
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
          { id: "systems", name: "Systems", courses: ["CS 5100", "CS 5101"] },
          { id: "theory", name: "Theory", courses: ["CS 5200"] },
          { id: "software", name: "Software", courses: ["CS 5300"] },
        ],
      },
      electiveCredits: 12,
      eligibleElectives: [
        "CS 6100",
        "CS 6110",
        "CS 6120",
        ...extraCourses
          .filter((candidate) => candidate.requirementType !== "external" && candidate.electiveEligible)
          .map((candidate) => candidate.code),
      ],
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

function plan(overrides: Partial<StudentPlan> = {}): StudentPlan {
  return {
    version: 1,
    completedCourses: [],
    waivedCourses: [],
    completedCredits: {},
    semesters: [],
    ...overrides,
  };
}

test("OR alternatives, AND grouping, grade labels, and unknown propagation", () => {
  const expression: RequirementExpression = {
    type: "all",
    items: [
      req("CS 5000", { minimumGrade: "B" }),
      { type: "any", items: [req("CS 5001"), { type: "unknown", text: "department approval" }] },
    ],
  };
  assert.equal(evaluateRequirement(expression, new Set()).status, "locked");
  const uncertain = evaluateRequirement(expression, new Set(["CS 5000"]));
  assert.equal(uncertain.status, "uncertain");
  assert.deepEqual(uncertain.missing, ["CS 5001"]);
  assert.match(uncertain.reasons.join(" "), /CS 5001.*OR.*department approval/);
  assert.equal(evaluateRequirement(expression, new Set(["CS 5000", "CS 5001"])).status, "eligible");
  assert.match(expressionLabel(expression), /minimum grade B/);
  assert.match(expressionLabel(expression), /AND/);
  assert.match(expressionLabel(expression), /OR/);

  const anyWithTrue: RequirementExpression = {
    type: "any",
    items: [{ type: "unknown", text: "unparsed prose" }, req("CS 5001")],
  };
  assert.equal(evaluateRequirement(anyWithTrue, new Set(["CS 5001"])).status, "eligible");
});

test("ordinary prerequisites reject same-term courses but concurrency metadata permits them", () => {
  assert.equal(evaluateRequirement(req("CS 6100"), new Set(), new Set(["CS 6100"])).status, "locked");
  assert.equal(
    evaluateRequirement(req("CS 6100", { concurrent: true }), new Set(), new Set(["CS 6100"])).status,
    "eligible",
  );
});

test("getEligibility audits prerequisites only and communicates a separate corequisite note", () => {
  const target = course("CS 6200", { prerequisites: none, corequisites: req("CS 6201") });
  const eligibility = getEligibility(target, new Set());
  assert.equal(eligibility.status, "eligible");
  assert.match(eligibility.reasons.join(" "), /Corequisite audited separately/);
});

test("dependency closures are cycle safe in both directions", () => {
  const a = course("CS 7000", { prerequisites: req("CS 7001"), prerequisiteCodes: ["CS 7001"] });
  const b = course("CS 7001", { prerequisites: req("CS 7000"), prerequisiteCodes: ["CS 7000"] });
  assert.deepEqual([...dependencyClosure("CS 7000", [a, b], "upstream")], ["CS 7001"]);
  assert.deepEqual([...dependencyClosure("CS 7000", [a, b], "downstream")], ["CS 7001"]);
});

test("plan ordering enforces earlier prerequisites and accepts same-term corequisites", () => {
  const prerequisiteTarget = course("CS 6200", { prerequisites: req("CS 6100") });
  const sameTerm = validatePlan(
    plan({
      semesters: [
        {
          id: "fall-2026",
          name: "Fall 2026",
          type: "academic",
          courses: [{ code: "CS 6100" }, { code: "CS 6200" }],
        },
      ],
    }),
    catalog([prerequisiteTarget]),
  );
  assert.ok(sameTerm.issues.some((issue) => issue.kind === "prerequisite" && issue.courseCode === "CS 6200"));
  assert.equal(sameTerm.plannedCredits, 4);

  const earlier = validatePlan(
    plan({
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6100" }] },
        { id: "spring-2027", name: "Spring 2027", type: "academic", courses: [{ code: "CS 6200" }] },
      ],
    }),
    catalog([prerequisiteTarget]),
  );
  assert.equal(earlier.issues.some((issue) => issue.kind === "prerequisite"), false);
  assert.equal(earlier.plannedCredits, 8);

  const concurrentTarget = course("CS 6210", { prerequisites: req("CS 6100", { concurrent: true }) });
  const concurrentPlan = validatePlan(
    plan({
      semesters: [
        {
          id: "fall-2026",
          name: "Fall 2026",
          type: "academic",
          courses: [{ code: "CS 6100" }, { code: "CS 6210" }],
        },
      ],
    }),
    catalog([concurrentTarget]),
  );
  assert.equal(concurrentPlan.issues.some((issue) => issue.kind === "prerequisite"), false);
  assert.equal(concurrentPlan.plannedCredits, 8);

  const waivedPrerequisite = validatePlan(
    plan({
      waivedCourses: ["CS 6100"],
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6200" }] },
      ],
    }),
    catalog([prerequisiteTarget]),
  );
  assert.equal(waivedPrerequisite.issues.some((issue) => issue.kind === "prerequisite"), false);
  assert.equal(waivedPrerequisite.plannedCredits, 4);
  assert.equal(waivedPrerequisite.earnedCredits, 0);

  const reciprocalCorequisites = validatePlan(
    plan({
      semesters: [
        {
          id: "fall-2026",
          name: "Fall 2026",
          type: "academic",
          courses: [{ code: "CS 5010" }, { code: "CS 5011" }],
        },
      ],
    }),
    catalog(),
  );
  assert.equal(reciprocalCorequisites.issues.some((issue) => issue.kind === "corequisite"), false);
  assert.equal(reciprocalCorequisites.plannedCredits, 4);
  assert.equal(reciprocalCorequisites.core.find((item) => item.code === "CS 5011")?.satisfied, true);
});

test("breadth allocation uses three unique courses across category ids and leaves extra breadth for electives", () => {
  const progress = validatePlan(
    plan({
      completedCourses: [
        "CS 5010",
        "CS 5011",
        "CS 5800",
        "CS 5100",
        "CS 5101",
        "CS 5200",
        "CS 5300",
        "CS 6100",
        "CS 6110",
      ],
    }),
    catalog(),
  );
  assert.equal(progress.earnedCredits, 32);
  assert.equal(progress.breadth.assignedCourses.length, 3);
  assert.equal(new Set(progress.breadth.assignedCourses).size, 3);
  assert.ok(progress.breadth.categoriesSatisfied.length >= 2);
  assert.equal(progress.breadth.satisfied, true);
  assert.equal(progress.electiveCredits, 12);
  assert.equal(progress.satisfied, true);
});

test("breadth diversity cannot count one course twice", () => {
  const narrowCatalog = catalog();
  narrowCatalog.requirements.breadthRequirements.categories = [
    { id: "systems", name: "Systems", courses: ["CS 5100", "CS 5101", "CS 5200"] },
    { id: "theory", name: "Theory", courses: [] },
  ];
  const progress = validatePlan(
    plan({ completedCourses: ["CS 5100", "CS 5101", "CS 5200"] }),
    narrowCatalog,
  );
  assert.equal(progress.breadth.assignedCourses.length, 3);
  assert.deepEqual(progress.breadth.categoriesSatisfied, ["systems"]);
  assert.equal(progress.breadth.satisfied, false);
});

test("waived core grants no credit while zero-credit recitation remains satisfied", () => {
  const progress = validatePlan(
    plan({
      waivedCourses: ["CS 5010"],
      completedCourses: [
        "CS 5011",
        "CS 5800",
        "CS 5100",
        "CS 5101",
        "CS 5200",
        "CS 5300",
        "CS 6100",
        "CS 6110",
        "CS 6120",
      ],
    }),
    catalog(),
  );
  assert.equal(progress.earnedCredits, 32);
  assert.deepEqual(progress.core.find((item) => item.code === "CS 5010"), {
    code: "CS 5010",
    satisfied: true,
    waived: true,
  });
  assert.equal(progress.core.find((item) => item.code === "CS 5011")?.satisfied, true);
  assert.equal(progress.satisfied, true);
});

test("duplicate completed/planned courses count once and fixed overrides cannot inflate credits", () => {
  const progress = validatePlan(
    plan({
      completedCourses: ["CS 6100", "CS 6100"],
      completedCredits: { "CS 6100": 20 },
      semesters: [
        {
          id: "fall-2026",
          name: "Fall 2026",
          type: "academic",
          courses: [{ code: "CS 6100", credits: 20 }, { code: "CS 6110", credits: 20 }],
        },
      ],
    }),
    catalog(),
  );
  assert.equal(progress.earnedCredits, 4);
  assert.equal(progress.plannedCredits, 4);
  assert.ok(progress.issues.some((issue) => issue.kind === "duplicate"));
  assert.ok(progress.issues.some((issue) => issue.kind === "credits" && issue.courseCode === "CS 6110"));
  assert.equal(progress.satisfied, false);
});

test("known external and unknown completed prerequisites unlock without earning degree credit", () => {
  const external = course("MATH 5000", { credits: 0, requirementType: "external", electiveEligible: false });
  const target = course("CS 6200", { prerequisites: req("MATH 5000") });
  const known = validatePlan(
    plan({
      completedCourses: ["MATH 5000"],
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6200" }] },
      ],
    }),
    catalog([external, target]),
  );
  assert.equal(known.earnedCredits, 0);
  assert.equal(known.plannedCredits, 4);
  assert.equal(known.issues.some((issue) => issue.kind === "prerequisite"), false);

  const unknownTarget = course("CS 6210", { prerequisites: req("MATH 5999") });
  const unknown = validatePlan(
    plan({
      completedCourses: ["MATH 5999"],
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6210" }] },
      ],
    }),
    catalog([unknownTarget]),
  );
  assert.equal(unknown.earnedCredits, 0);
  assert.equal(unknown.plannedCredits, 4);
  assert.ok(unknown.issues.some((issue) => issue.kind === "unknown" && issue.courseCode === "MATH 5999"));
  assert.equal(unknown.satisfied, false);
});

test("variable credits require explicit bounded selections for completed and planned courses", () => {
  const variable = course("CS 6200", { credits: 1, maxCredits: 4 });
  const missing = validatePlan(plan({ completedCourses: ["CS 6200"] }), catalog([variable]));
  assert.equal(missing.earnedCredits, 0);
  assert.ok(missing.issues.some((issue) => issue.kind === "credits"));

  const selected = validatePlan(
    plan({
      completedCourses: ["CS 6200"],
      completedCredits: { "CS 6200": 3 },
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6120" }] },
      ],
    }),
    catalog([variable]),
  );
  assert.equal(selected.earnedCredits, 3);
  assert.equal(selected.plannedCredits, 4);

  const outOfRange = validatePlan(
    plan({
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6200", credits: 5 }] },
      ],
    }),
    catalog([variable]),
  );
  assert.equal(outOfRange.plannedCredits, 0);
  assert.ok(outOfRange.issues.some((issue) => issue.kind === "credits"));
});

test("unknown requirement syntax remains an audit blocker", () => {
  const uncertainCourse = course("CS 6200", { prerequisites: { type: "unknown", text: "permission wording" } });
  const progress = validatePlan(
    plan({
      semesters: [
        { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 6200" }] },
      ],
    }),
    catalog([uncertainCourse]),
  );
  assert.equal(progress.plannedCredits, 0);
  assert.ok(progress.issues.some((issue) => issue.kind === "prerequisite" && issue.severity === "warning"));
  assert.equal(progress.satisfied, false);
  assert.ok(progress.notes.some((note) => /GPA.*official university audit/i.test(note)));
  assert.ok(progress.notes.some((note) => /offerings.*unknown/i.test(note)));
});
