import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { getAdapter } from "../catalog-service/adapters";
import {
  validateDiscoveredPrograms,
  validateProgramRoadmap,
  validateRoadmapCrawlStatus,
} from "../lib/catalog";
import type {
  Course,
  DiscoveredPrograms,
  ProgramRoadmap,
  RoadmapCrawlStatus,
} from "../lib/types";

const timestamp = "2026-09-16T00:00:00.000Z";
const origin = "https://catalog.example.edu";
const fixture = (filePath: string) =>
  readFileSync(path.join(process.cwd(), filePath), "utf8");

function roadmapCourse(
  code: string,
  overrides: Partial<Course> = {},
): Course {
  return {
    code,
    title: `Course ${code}`,
    credits: 4,
    description: `Official description for ${code}.`,
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
    officialUrl: `${origin}/courses/${encodeURIComponent(code)}`,
    uncertainties: [],
    ...overrides,
  };
}

function validRoadmap(): ProgramRoadmap {
  return {
    universityId: "example-university",
    university: "Example University",
    programId: "computer-science-ms",
    program: "Computer Science, MS",
    adapter: "fixture-adapter",
    officialUrl: `${origin}/programs/computer-science-ms/`,
    programCourseCodes: ["6.006", "CS-UY 1114"],
    courses: [
      roadmapCourse("6.006", { unlocks: ["CS-UY 1114"] }),
      roadmapCourse("CS-UY 1114", {
        prerequisites: { type: "course", code: "6.006" },
        prerequisiteText: "6.006",
        prerequisiteCodes: ["6.006"],
      }),
    ],
    lastUpdated: timestamp,
    sources: [
      `${origin}/programs/computer-science-ms/`,
      `${origin}/courses/`,
    ],
    warnings: [],
  };
}

test("program roadmap validation accepts bounded international course IDs and complete edges", () => {
  assert.doesNotThrow(() => validateProgramRoadmap(validRoadmap()));
});

test("program roadmap validation rejects incomplete references and unlock indexes", () => {
  const missingReference = structuredClone(validRoadmap());
  missingReference.courses[1].corequisites = {
    type: "course",
    code: "COMP 1000A",
  };
  missingReference.courses[1].corequisiteText = "COMP 1000A";
  missingReference.courses[1].corequisiteCodes = ["COMP 1000A"];
  assert.throws(
    () => validateProgramRoadmap(missingReference),
    /relationship references missing metadata/,
  );

  const missingUnlock = structuredClone(validRoadmap());
  missingUnlock.courses[0].unlocks = [];
  assert.throws(
    () => validateProgramRoadmap(missingUnlock),
    /unlock indexes do not match prerequisite edges/,
  );
});

test("program roadmap validation rejects nonofficial sources and degree requirements", () => {
  const unsafe = structuredClone(validRoadmap());
  unsafe.courses[0].officialUrl = "https://example.com/course";
  assert.throws(() => validateProgramRoadmap(unsafe), /Invalid roadmap course record/);

  const fabricated = {
    ...validRoadmap(),
    requirements: { totalCredits: 32 },
  };
  assert.throws(
    () => validateProgramRoadmap(fabricated),
    /must not contain degree requirements/,
  );
});

test("discovered programs and persisted crawl status validate queue state", () => {
  const programs: DiscoveredPrograms = {
    version: 1,
    universityId: "example-university",
    university: "Example University",
    adapter: "fixture-adapter",
    sourceUrl: `${origin}/programs/`,
    discoveredAt: timestamp,
    programs: [
      {
        id: "computer-science-ms",
        universityId: "example-university",
        university: "Example University",
        name: "Computer Science, MS",
        kind: "degree",
        officialUrl: `${origin}/programs/computer-science-ms/`,
        status: "queued",
        statusUpdatedAt: timestamp,
      },
    ],
  };
  assert.doesNotThrow(() => validateDiscoveredPrograms(programs));

  const status: RoadmapCrawlStatus = {
    version: 1,
    universityId: "example-university",
    status: "queued",
    discoveryStatus: "ready",
    queue: ["computer-science-ms"],
    counts: { queued: 1, ready: 0, unsupported: 0, error: 0 },
    updatedAt: timestamp,
  };
  assert.doesNotThrow(() => validateRoadmapCrawlStatus(status));

  const duplicateQueue = structuredClone(status);
  duplicateQueue.queue.push("computer-science-ms");
  duplicateQueue.counts.queued = 2;
  assert.throws(
    () => validateRoadmapCrawlStatus(duplicateQueue),
    /duplicate program id/,
  );
});

test("Northeastern adapter discovers official program leaves from the catalog sitemap", () => {
  const adapter = getAdapter("northeastern-acalog");
  assert.ok(adapter.discoverPrograms);
  const programs = adapter.discoverPrograms(
    fixture("tests/fixtures/northeastern-programs.xml"),
    "https://catalog.northeastern.edu/sitemap.xml",
  );

  assert.deepEqual(
    programs.map((program) => program.officialUrl),
    [
      "https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/",
      "https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-phd/",
      "https://catalog.northeastern.edu/undergraduate/computer-information-science/computer-science/minor/",
    ],
  );
  assert.equal(new Set(programs.map((program) => program.id)).size, programs.length);
});

test("Northeastern adapter extracts program scope and builds a known prerequisite unlock edge", () => {
  const adapter = getAdapter("northeastern-acalog");
  assert.ok(adapter.parseProgramScope);
  assert.ok(adapter.courseSources);
  assert.ok(adapter.buildRoadmapGraph);

  const scope = adapter.parseProgramScope(
    fixture("data/raw/mscs-sea-program.html"),
    "https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/",
  );
  assert.ok(scope);
  assert.equal(scope.name, "Computer Science, MSCS (Seattle)");
  assert.equal(scope.kind, "degree");
  assert.ok(scope.programCourseCodes.includes("CS 5010"));
  assert.ok(scope.programCourseCodes.includes("CS 5500"));
  assert.equal("requirements" in scope, false);

  const courseSources = adapter.courseSources(
    scope.programCourseCodes,
    "https://catalog.northeastern.edu",
  );
  assert.deepEqual(
    courseSources.map((source) => source.key),
    ["course:DADS", "course:CY", "course:DS", "course:CS"].sort(),
  );

  const parsedCourses = ["cs", "cy", "ds", "dads"].flatMap((subject) =>
    adapter.parseCourses(
      fixture(`data/raw/${subject}.html`),
      `https://catalog.northeastern.edu/course-descriptions/${subject}/`,
    ),
  );
  const courses = adapter.buildRoadmapGraph(
    parsedCourses,
    scope.programCourseCodes,
    "https://catalog.northeastern.edu",
  );
  const byCode = new Map(courses.map((course) => [course.code, course]));

  assert.ok(byCode.get("CS 5010")?.unlocks.includes("CS 5500"));
  assert.ok(byCode.get("CS 5500")?.prerequisiteCodes.includes("CS 5010"));
  assert.equal(byCode.get("CS 5010")?.requirementType, "program");
});
