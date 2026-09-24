import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { GraphInspectorActions, graphStatus, graphStudentFacts } from "../components/course-graph";
import { RoadmapSelectorView, type RoadmapSelectorViewProps } from "../components/roadmap-selector";
import type { UniversityRoadmapSummary } from "../catalog-service/source-types";
import { earliestTakeTerm, prerequisiteChecks, programMapCodes } from "../lib/graph";
import { emptyPlan } from "../lib/plan";
import {
  groupUniversities,
  isProgramSelectable,
  isUniversitySelectable,
  programDisplayName,
  programStatusText,
  resolveGraphCourses,
  resolveProgramScope,
  roadmapFocusCourse,
  roadmapProgramLabel,
  sortPrograms,
  universityStatusText,
} from "../lib/roadmaps";
import type { Catalog, Course, DiscoveredProgram, ProgramRoadmap, StudentPlan } from "../lib/types";
import { getEligibility } from "../lib/validation";

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

test("program labels remove generated suffixes and ready programs sort first", () => {
  const unnamed = program({ id: "global-doctoral-research-a4e438d122", name: undefined, status: "queued" });
  const ready = program({ id: "ready-program", name: " Ready Program ", status: "ready" });
  assert.equal(programDisplayName(unnamed), "Global Doctoral Research");
  assert.equal(programDisplayName(ready), "Ready Program");
  assert.deepEqual(sortPrograms([unnamed, ready]).map((entry) => entry.id), ["ready-program", "global-doctoral-research-a4e438d122"]);
});

const selectorViewProps = (overrides: Partial<RoadmapSelectorViewProps> = {}): RoadmapSelectorViewProps => ({
  universities: [],
  loading: false,
  error: null,
  universityId: "",
  programs: [],
  programsLoading: false,
  programsError: null,
  programId: "",
  roadmapLoading: false,
  roadmapError: null,
  onUniversityChange: () => {},
  onProgramChange: () => {},
  onReset: () => {},
  onRetryUniversities: () => {},
  onRetryPrograms: () => {},
  onRetryRoadmap: () => {},
  ...overrides,
});

test("selector render groups universities, prioritizes ready programs, and exposes status guidance", () => {
  const readyUniversity = summary({
    id: "us-ready",
    university: "Ready US University",
    status: { ...summary({}).status, status: "ready" },
  });
  const blockedUniversity = summary({
    id: "us-blocked",
    university: "Blocked US University",
    support: "unverified",
  });
  const worldUniversity = summary({ id: "world-queued", university: "Queued World University", region: "world" });
  const markup = renderToStaticMarkup(createElement(RoadmapSelectorView, selectorViewProps({
    universities: [worldUniversity, blockedUniversity, readyUniversity],
    universityId: "us-ready",
    programs: [
      program({ id: "queued-program-a4e438d122", name: undefined, status: "queued" }),
      program({ id: "ready-program", name: "Ready Program, MS", status: "ready" }),
    ],
  })));

  const usGroup = markup.indexOf('<optgroup label="United States">');
  const worldGroup = markup.indexOf('<optgroup label="World">');
  assert.ok(usGroup >= 0 && worldGroup > usGroup);
  const blockedOption = markup.slice(markup.indexOf('value="us-blocked"'), markup.indexOf('value="us-blocked"') + 120);
  assert.match(blockedOption, /disabled/);
  assert.ok(markup.indexOf('value="ready-program"') < markup.indexOf('value="queued-program-a4e438d122"'));
  assert.match(markup, /Global|Ready Program, MS/);
  assert.match(markup, /Status guide/);
  assert.match(markup, /Queued.*waiting for crawl/);
  assert.match(markup, /Unverified.*needs review/);

  const errorMarkup = renderToStaticMarkup(createElement(RoadmapSelectorView, selectorViewProps({ error: "temporary failure" })));
  assert.match(errorMarkup, /Retry loading universities/);
});

test("roadmap override hides Northeastern inspector actions", () => {
  const selected = course("CS 5500");
  const props = {
    selected,
    recorded: false,
    onAddToPlan: () => {},
    onOpenCourse: () => {},
  };
  const defaultMarkup = renderToStaticMarkup(createElement(GraphInspectorActions, { ...props, overrideActive: false }));
  assert.match(defaultMarkup, /Add to Plan/);
  assert.match(defaultMarkup, /Full course details/);
  assert.equal(renderToStaticMarkup(createElement(GraphInspectorActions, { ...props, overrideActive: true })), "");
});

test("foreign roadmap does not reuse NEU plan status for overlapping course codes", () => {
  const neuPlan: StudentPlan = {
    ...emptyPlan(),
    completedCourses: ["CS 5010"],
    waivedCourses: ["CS 5500"],
  };
  neuPlan.semesters[0]!.courses.push({ code: "CS 5800" });
  const overlapping = course("CS 5010");
  const waivedTwin = course("CS 5500");
  const dependent: Course = {
    ...course("CS 5800"),
    prerequisites: { type: "course", code: "CS 5010" },
    prerequisiteCodes: ["CS 5010"],
  };
  const foreignRoadmap = roadmap({
    universityId: "example-university",
    university: "Example University",
    programCourseCodes: ["CS 5010", "CS 5500", "CS 5800"],
    courses: [overlapping, waivedTwin, dependent],
  });

  const neu = graphStudentFacts(false, neuPlan);
  const foreign = graphStudentFacts(foreignRoadmap !== null, neuPlan);

  assert.equal(graphStatus(overlapping, "CS 5010", neu).id, "completed");
  assert.equal(graphStatus(overlapping, "CS 5010", foreign).id, "available");
  assert.equal(graphStatus(waivedTwin, "CS 5500", neu).id, "completed");
  assert.notEqual(graphStatus(waivedTwin, "CS 5500", foreign).id, "completed");
  assert.equal(graphStatus(dependent, "CS 5800", neu).id, "in-progress");
  assert.equal(graphStatus(dependent, "CS 5800", foreign).id, "blocked");

  assert.equal(getEligibility(dependent, neu.history).status, "eligible");
  assert.equal(getEligibility(dependent, foreign.history).status, "locked");
  assert.deepEqual(prerequisiteChecks(["CS 5010"], neu.history), [{ code: "CS 5010", met: true }]);
  assert.deepEqual(prerequisiteChecks(["CS 5010"], foreign.history), [{ code: "CS 5010", met: false }]);

  const neuTake = earliestTakeTerm({
    completed: neu.completed.has("CS 5010"),
    waived: neu.waived.has("CS 5010"),
    plannedTermName: neu.plannedByCode.get("CS 5010")?.name ?? null,
    eligibility: getEligibility(overlapping, neu.history).status,
    missing: getEligibility(overlapping, neu.history).missing,
    firstAcademicTermName: neu.firstAcademicTermName,
  });
  const foreignTake = earliestTakeTerm({
    completed: foreign.completed.has("CS 5010"),
    waived: foreign.waived.has("CS 5010"),
    plannedTermName: foreign.plannedByCode.get("CS 5010")?.name ?? null,
    eligibility: getEligibility(overlapping, foreign.history).status,
    missing: getEligibility(overlapping, foreign.history).missing,
    firstAcademicTermName: foreign.firstAcademicTermName,
  });
  assert.equal(neuTake.label, "Already completed");
  assert.notEqual(foreignTake.label, "Already completed");
  assert.equal(foreign.completed.size, 0);
  assert.equal(foreign.waived.size, 0);
  assert.equal(foreign.planned.size, 0);
  assert.equal(foreign.history.size, 0);
  assert.equal(foreign.recorded.size, 0);
  assert.equal(foreign.plannedByCode.size, 0);
  assert.equal(foreign.currentTermId, null);
  assert.equal(foreign.firstAcademicTermName, null);
});
