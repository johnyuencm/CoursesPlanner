import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { getAdapter } from "../catalog-service/adapters";
import { crawlRoadmaps } from "../catalog-service/roadmaps";
import {
  validateDiscoveredPrograms,
  validateProgramRoadmap,
  validateRoadmapCrawlStatus,
} from "../lib/catalog";
import type { UniversityDirectoryEntry } from "../catalog-service/source-types";
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

const discoveryXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/</loc></url>
  <url><loc>https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sea/</loc></url>
  <url><loc>https://catalog.northeastern.edu/graduate/computer-information-science/computer-science/computer-science-mscs-sjo/</loc></url>
</urlset>`;

function supportedUniversity(
  id: string,
  region: "us" | "world",
  priority: number,
): UniversityDirectoryEntry {
  return {
    id,
    university: id === "us-supported" ? "US Supported" : "World Supported",
    region,
    priority,
    catalogUrl: "https://catalog.northeastern.edu/",
    support: "supported",
    enabled: true,
    crawl: {
      adapter: "northeastern-acalog",
      discoverySource: {
        key: "programs",
        url: "https://catalog.northeastern.edu/sitemap.xml",
        fileName: "sitemap.xml",
        required: true,
        format: "xml",
      },
      requestDelayMs: 0,
      robotsUrl: "https://catalog.northeastern.edu/robots.txt",
      allowedOrigins: ["https://catalog.northeastern.edu"],
    },
  };
}

function metadataUniversity(): UniversityDirectoryEntry {
  return {
    id: "mit",
    university: "MIT",
    region: "us",
    priority: 1,
    catalogUrl: "https://catalog.mit.edu/",
    support: "unverified",
    enabled: false,
  };
}

function crawlerFetch(calls: string[], disallowGraduate = false): typeof fetch {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.endsWith("/robots.txt")) {
      return new Response(
        `User-agent: *\n${disallowGraduate ? "Disallow: /graduate/\n" : ""}`,
        { status: 200, headers: { "content-type": "text/plain" } },
      );
    }
    if (url.endsWith("/sitemap.xml")) {
      return new Response(discoveryXml, {
        status: 200,
        headers: { "content-type": "application/xml", etag: '"sitemap"' },
      });
    }
    if (url.includes("computer-science-mscs-")) {
      const html = fixture("data/raw/mscs-sea-program.html");
      return new Response(
        url.includes("-sjo/")
          ? html.replace("Computer Science, MSCS (Seattle)", "Computer Science, MSCS (San Jose)")
          : html,
        { status: 200, headers: { "content-type": "text/html", etag: '"program"' } },
      );
    }
    const subject = url.match(/\/course-descriptions\/(cs|cy|ds|dads)\//)?.[1];
    if (subject) {
      return new Response(fixture(`data/raw/${subject}.html`), {
        status: 200,
        headers: { "content-type": "text/html", etag: `"${subject}"` },
      });
    }
    throw new Error(`Unexpected roadmap fetch: ${url}`);
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

test("roadmap crawl is bounded, resumable, US-first, and reuses university course caches", { timeout: 60_000 }, async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "roadmap-crawl-"));
  const calls: string[] = [];
  const universities = [
    supportedUniversity("world-supported", "world", 1),
    metadataUniversity(),
    supportedUniversity("us-supported", "us", 20),
  ];
  const options = {
    rootDir,
    universities,
    fetchImpl: crawlerFetch(calls),
    now: () => new Date(timestamp),
  };

  try {
    const first = await crawlRoadmaps({ ...options, limit: 1 });
    assert.deepEqual(first.processed, [
      { universityId: "us-supported", type: "discovery", status: "queued" },
    ]);
    assert.equal(calls.some((url) => url.includes("catalog.mit.edu")), false);

    const programsFile = path.join(rootDir, "data", "catalogs", "us-supported", "programs.json");
    const statusFile = path.join(rootDir, "data", "catalogs", "us-supported", ".roadmap-crawl-status.json");
    const discovered = JSON.parse(await readFile(programsFile, "utf8")) as DiscoveredPrograms;
    const firstStatus = JSON.parse(await readFile(statusFile, "utf8")) as RoadmapCrawlStatus;
    assert.equal(discovered.programs.length, 2);
    assert.equal(firstStatus.counts.queued, 2);
    assert.deepEqual(firstStatus.queue, discovered.programs.map((program) => program.id));

    const second = await crawlRoadmaps({ ...options, limit: 1 });
    assert.equal(second.processed[0]?.universityId, "us-supported");
    assert.equal(second.processed[0]?.type, "program");
    assert.equal(second.processed[0]?.status, "ready");
    const firstProgramId = discovered.programs[0].id;
    assert.equal(second.processed[0]?.programId, firstProgramId);
    const roadmapFile = path.join(rootDir, "data", "catalogs", "us-supported", "roadmaps", `${firstProgramId}.json`);
    const roadmap = JSON.parse(await readFile(roadmapFile, "utf8"));
    validateProgramRoadmap(roadmap, ["https://catalog.northeastern.edu"]);
    const byCode = new Map(roadmap.courses.map((course) => [course.code, course] as const));
    assert.ok(byCode.get("CS 5010")?.unlocks.includes("CS 5500"));
    const courseFetches = calls.filter((url) => url.includes("/course-descriptions/")).length;
    assert.ok(courseFetches > 0);

    const third = await crawlRoadmaps({ ...options, limit: 1 });
    assert.equal(third.processed[0]?.universityId, "us-supported");
    assert.equal(third.processed[0]?.programId, discovered.programs[1].id);
    assert.equal(third.processed[0]?.status, "ready");
    assert.equal(
      calls.filter((url) => url.includes("/course-descriptions/")).length,
      courseFetches,
      "shared subject pages should be fetched once per university",
    );

    const fourth = await crawlRoadmaps({ ...options, limit: 1 });
    assert.deepEqual(fourth.processed, [
      { universityId: "world-supported", type: "discovery", status: "queued" },
    ]);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("roadmap crawl enforces limits, metadata skips, and robots rules", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "roadmap-safety-"));
  const calls: string[] = [];
  const supported = supportedUniversity("us-supported", "us", 20);
  try {
    await assert.rejects(
      () => crawlRoadmaps({ rootDir, universities: [supported], limit: 0 }),
      /limit must be an integer from 1 through 100/,
    );
    const metadataOnly = await crawlRoadmaps({
      rootDir,
      universities: [metadataUniversity(), supported],
      universityId: "mit",
      limit: 1,
      fetchImpl: async () => {
        throw new Error("metadata-only university must not fetch");
      },
    });
    assert.deepEqual(metadataOnly.processed, []);

    const options = {
      rootDir,
      universities: [supported],
      limit: 1,
      fetchImpl: crawlerFetch(calls, true),
      now: () => new Date(timestamp),
    };
    await crawlRoadmaps(options);
    const second = await crawlRoadmaps(options);
    assert.equal(second.processed[0]?.type, "program");
    assert.equal(second.processed[0]?.status, "error");
    assert.equal(calls.some((url) => url.includes("computer-science-mscs-sea")), false);

    const persisted = JSON.parse(
      await readFile(path.join(rootDir, "data", "catalogs", "us-supported", "programs.json"), "utf8"),
    ) as DiscoveredPrograms;
    assert.equal(persisted.programs[0].status, "error");
    assert.match(persisted.programs[0].reason ?? "", /robots\.txt disallows/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
