import { strict as assert } from "node:assert";
import test from "node:test";

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
