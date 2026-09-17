import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import type { UniversityDirectoryEntry } from "../catalog-service/source-types";
import type { Course, DiscoveredPrograms, ProgramRoadmap } from "../lib/types";

const timestamp = "2026-09-16T00:00:00.000Z";
const ORIGIN = "https://catalog.northeastern.edu";
const ADAPTER = "northeastern-acalog";
const TEST_ID = "test-university";
const TEST_NAME = "Test University";
const DISCOVERY_URL = `${ORIGIN}/sitemap.xml`;
const READY_PROGRAM_ID = "ready-ms";
const READY_PROGRAM_URL = `${ORIGIN}/graduate/ready-ms/`;
const QUEUED_PROGRAM_ID = "queued-ms";

function roadmapCourse(code: string): Course {
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
    officialUrl: `${ORIGIN}/courses/${encodeURIComponent(code)}`,
    uncertainties: [],
  };
}

function buildDirectory(): UniversityDirectoryEntry[] {
  const entries: UniversityDirectoryEntry[] = [];
  for (const region of ["us", "world"] as const) {
    for (let priority = 1; priority <= 20; priority++) {
      entries.push({
        id: `${region}-${priority}`,
        university: `${region === "us" ? "US" : "World"} University ${priority}`,
        region,
        priority,
        catalogUrl: `${ORIGIN}/`,
        support: "unverified",
        enabled: false,
      });
    }
  }
  entries[0] = {
    id: TEST_ID,
    university: TEST_NAME,
    region: "us",
    priority: 1,
    catalogUrl: `${ORIGIN}/`,
    support: "supported",
    enabled: true,
    crawl: {
      adapter: ADAPTER,
      discoverySource: { key: "programs", url: DISCOVERY_URL, fileName: "sitemap.xml", required: true, format: "xml" },
      requestDelayMs: 0,
      robotsUrl: `${ORIGIN}/robots.txt`,
      allowedOrigins: [ORIGIN],
    },
  };
  return entries;
}

async function writeFixture(rootDir: string): Promise<void> {
  await mkdir(path.join(rootDir, "catalog-service"), { recursive: true });
  await mkdir(path.join(rootDir, "data", "catalogs", TEST_ID, "roadmaps"), { recursive: true });
  await writeFile(
    path.join(rootDir, "catalog-service", "universities.json"),
    JSON.stringify(buildDirectory()),
  );
  const programs: DiscoveredPrograms = {
    version: 1,
    universityId: TEST_ID,
    university: TEST_NAME,
    adapter: ADAPTER,
    sourceUrl: DISCOVERY_URL,
    discoveredAt: timestamp,
    programs: [
      {
        id: READY_PROGRAM_ID,
        universityId: TEST_ID,
        university: TEST_NAME,
        name: "Ready Program, MS",
        kind: "degree",
        officialUrl: READY_PROGRAM_URL,
        status: "ready",
        statusUpdatedAt: timestamp,
      },
      {
        id: QUEUED_PROGRAM_ID,
        universityId: TEST_ID,
        university: TEST_NAME,
        name: "Queued Program, MS",
        kind: "degree",
        officialUrl: `${ORIGIN}/graduate/queued-ms/`,
        status: "queued",
        statusUpdatedAt: timestamp,
      },
    ],
  };
  await writeFile(
    path.join(rootDir, "data", "catalogs", TEST_ID, "programs.json"),
    JSON.stringify(programs),
  );
  const roadmap: ProgramRoadmap = {
    universityId: TEST_ID,
    university: TEST_NAME,
    programId: READY_PROGRAM_ID,
    program: "Ready Program, MS",
    adapter: ADAPTER,
    officialUrl: READY_PROGRAM_URL,
    programCourseCodes: ["CS 5010"],
    courses: [roadmapCourse("CS 5010")],
    lastUpdated: timestamp,
    sources: [READY_PROGRAM_URL, `${ORIGIN}/courses/CS%205010`],
    warnings: [],
  };
  await writeFile(
    path.join(rootDir, "data", "catalogs", TEST_ID, "roadmaps", `${READY_PROGRAM_ID}.json`),
    JSON.stringify(roadmap),
  );
}

function request(rootDir: string, query = "") {
  return handleRoadmapsRequest(
    new NextRequest(`http://localhost:3000/api/roadmaps${query}`),
    rootDir,
  );
}

async function withFixture(run: (rootDir: string) => Promise<void>) {
  const rootDir = await mkdtemp(path.join(tmpdir(), "roadmaps-route-"));
  try {
    await writeFixture(rootDir);
    await run(rootDir);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

test("GET /api/roadmaps lists universities US-first with per-university status", async () => {
  await withFixture(async (rootDir) => {
    const response = await request(rootDir);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const data = await response.json();
    assert.equal(data.universities.length, 40);
    assert.ok(data.universities.slice(0, 20).every((entry: { region: string }) => entry.region === "us"));
    assert.ok(data.universities.slice(20).every((entry: { region: string }) => entry.region === "world"));
    const testEntry = data.universities.find((entry: { id: string }) => entry.id === TEST_ID);
    assert.ok(testEntry);
    assert.equal(testEntry.status.status, "queued");
  });
});

test("GET /api/roadmaps?university=<id> returns discovered programs", async () => {
  await withFixture(async (rootDir) => {
    const response = await request(rootDir, `?university=${TEST_ID}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.programs.length, 2);
    const ready = data.programs.find((program: { id: string }) => program.id === READY_PROGRAM_ID);
    assert.equal(ready.status, "ready");
  });
});

test("GET /api/roadmaps?university=<id>&program=<id> returns a validated ready roadmap", async () => {
  await withFixture(async (rootDir) => {
    const response = await request(rootDir, `?university=${TEST_ID}&program=${READY_PROGRAM_ID}`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.programId, READY_PROGRAM_ID);
    assert.deepEqual(data.programCourseCodes, ["CS 5010"]);
    assert.equal(data.courses.length, 1);
  });
});

test("unknown university and program ids are 404, not-ready programs are 503", async () => {
  await withFixture(async (rootDir) => {
    const unknownUniversity = await request(rootDir, "?university=does-not-exist");
    assert.equal(unknownUniversity.status, 404);

    const unknownProgram = await request(rootDir, `?university=${TEST_ID}&program=does-not-exist`);
    assert.equal(unknownProgram.status, 404);

    const notReady = await request(rootDir, `?university=${TEST_ID}&program=${QUEUED_PROGRAM_ID}`);
    assert.equal(notReady.status, 503);
    assert.match((await notReady.json()).error, /not ready/);
  });
});

test("malformed and traversal-shaped ids are 400 before any lookup", async () => {
  await withFixture(async (rootDir) => {
    for (const query of [
      "?university=..%2F..%2Fetc",
      "?university=a%2Fb",
      "?university=Test",
      "?university=",
      `?university=${TEST_ID}&program=..%2Fetc`,
      `?university=${TEST_ID}&program=Ready%20Program`,
    ]) {
      const response = await request(rootDir, query);
      assert.equal(response.status, 400, `expected 400 for ${query}`);
    }
  });
});

test("a program id without a university id is 400", async () => {
  await withFixture(async (rootDir) => {
    const response = await request(rootDir, `?program=${READY_PROGRAM_ID}`);
    assert.equal(response.status, 400);
  });
});

test("roadmap storage failures return a safe public error", async () => {
  await withFixture(async (rootDir) => {
    await rm(path.join(rootDir, "catalog-service", "universities.json"));
    const response = await request(rootDir);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.error, "Roadmap data is temporarily unavailable.");
    assert.doesNotMatch(data.error, /ENOENT|universities\.json/);
  });
});
