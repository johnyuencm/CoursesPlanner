import { strict as assert } from "node:assert";
import test from "node:test";

import {
  groupUniversities,
  isProgramSelectable,
  isUniversitySelectable,
  programStatusText,
  resolveGraphCourses,
  resolveProgramScope,
  roadmapFocusCourse,
  roadmapProgramLabel,
  universityStatusText,
} from "../lib/roadmaps";
import { programMapCodes } from "../lib/graph";
import type { Catalog, Course, DiscoveredProgram, ProgramRoadmap } from "../lib/types";
import type { UniversityRoadmapSummary } from "../catalog-service/source-types";

const summary = (overrides: Partial<UniversityRoadmapSummary>): UniversityRoadmapSummary => ({
  id: "example-university",
  university: "Example University",
  region: "us",
  priority: 1,
  catalogUrl: "https://catalog.example.edu/",
  support: "supported",
  enabled: true,
  status: { version: 1, universityId: "example-university", status: "queued", discoveryStatus: "ready", queue: [], counts: { queued: 0, ready: 0, unsupported: 0, error: 0 }, updatedAt: "2026-09-16T00:00:00.000Z" },
  ...overrides,
});

const program = (overrides: Partial<DiscoveredProgram>): DiscoveredProgram => ({
  id: "program-1",
  universityId: "example-university",
  university: "Example University",
  officialUrl: "https://catalog.example.edu/programs/1/",
  status: "queued",
  statusUpdatedAt: "2026-09-16T00:00:00.000Z",
  ...overrides,
});

const roadmap = (overrides: Partial<ProgramRoadmap>): ProgramRoadmap => ({
  universityId: "example-university",
  university: "Example University",
  programId: "program-1",
  program: "Example Program, MS",
  adapter: "fixture-adapter",
  officialUrl: "https://catalog.example.edu/programs/1/",
  programCourseCodes: ["CS 5010", "CS 5500"],
  courses: [],
  lastUpdated: "2026-09-16T00:00:00.000Z",
  sources: ["https://catalog.example.edu/programs/1/"],
  warnings: [],
  ...overrides,
});

test("groupUniversities splits US before world and preserves order", () => {
  const entries = [
    summary({ id: "world-1", region: "world" }),
    summary({ id: "us-1", region: "us" }),
    summary({ id: "us-2", region: "us" }),
  ];
  const { us, world } = groupUniversities(entries);
  assert.deepEqual(us.map((entry) => entry.id), ["us-1", "us-2"]);
  assert.deepEqual(world.map((entry) => entry.id), ["world-1"]);
});

test("university status text and selectability cover every registry state", () => {
  const statusOf = (status: UniversityRoadmapSummary["status"]["status"]) =>
    ({ ...summary({}).status, status });
  assert.equal(universityStatusText(summary({ support: "unverified" })), "Unverified");
  assert.equal(universityStatusText(summary({ support: "unsupported" })), "Unsupported");
  assert.equal(universityStatusText(summary({ status: statusOf("ready") })), "Ready");
  assert.equal(universityStatusText(summary({ status: statusOf("error") })), "Unavailable");
  assert.equal(isUniversitySelectable(summary({ support: "unverified" })), false);
  assert.equal(isUniversitySelectable(summary({ support: "unsupported" })), false);
  assert.equal(isUniversitySelectable(summary({ status: statusOf("error") })), false);
  assert.equal(isUniversitySelectable(summary({})), true);
});

test("program status text and selectability accept only ready programs", () => {
  assert.equal(programStatusText(program({ status: "ready" })), "Ready");
  assert.equal(programStatusText(program({ status: "error" })), "Unavailable");
  assert.equal(isProgramSelectable(program({ status: "queued" })), false);
  assert.equal(isProgramSelectable(program({ status: "ready" })), true);
});

function course(code: string): Course {
  return {
    code,
    title: code,
    credits: 4,
    description: "",
    prerequisites: { type: "none" },
    corequisites: { type: "none" },
    prerequisiteText: "",
    corequisiteText: "",
    prerequisiteCodes: [],
    corequisiteCodes: [],
    unlocks: [],
    breadthCategories: [],
    requirementType: "program",
    electiveEligible: false,
    topics: [],
    officialUrl: "https://catalog.example.edu/courses/x",
    uncertainties: [],
  };
}

function catalog(courses: Course[]): Catalog {
  return {
    courses,
    requirements: {
      name: "Example",
      catalogYear: "2026",
      totalCredits: 32,
      minimumGpa: 3,
      coreCourses: ["CS 5010"],
      breadthRequirements: { coursesRequired: 1, minCategories: 1, credits: 1, categories: [{ id: "systems", name: "Systems", courses: ["CS 5010"] }] },
      electiveCredits: 4,
      eligibleElectives: [],
      officialUrl: "https://catalog.example.edu/",
      rawRules: [],
      uncertainties: [],
      lastUpdated: "2026-09-16T00:00:00.000Z",
    },
    lastUpdated: "2026-09-16T00:00:00.000Z",
    sources: ["https://catalog.example.edu/"],
    warnings: [],
  };
}

test("roadmap overrides course data and program scope, and restores catalog defaults otherwise", () => {
  const defaultCatalog = catalog([course("CS 5010")]);
  const selected = roadmap({ courses: [course("CS 5500")] });

  assert.deepEqual(resolveGraphCourses(defaultCatalog, selected).map((entry) => entry.code), ["CS 5500"]);
  assert.deepEqual(resolveGraphCourses(defaultCatalog, null).map((entry) => entry.code), ["CS 5010"]);

  assert.deepEqual([...resolveProgramScope(defaultCatalog, selected)], ["CS 5010", "CS 5500"]);
  assert.equal(resolveProgramScope(defaultCatalog, null).has("CS 5010"), true);

  assert.equal(roadmapFocusCourse(selected), "CS 5010");
  assert.equal(roadmapProgramLabel(selected), "Example Program, MS");
  assert.equal(roadmapProgramLabel(null), "MSCS Seattle");
});

test("resolveProgramScope falls back to programMapCodes for the default catalog", () => {
  const defaultCatalog = catalog([course("CS 5010"), course("CS 5500")]);
  const scope = resolveProgramScope(defaultCatalog, null);
  const expected = programMapCodes(defaultCatalog.courses, defaultCatalog.requirements);
  assert.deepEqual([...scope].sort(), [...expected].sort());
});
