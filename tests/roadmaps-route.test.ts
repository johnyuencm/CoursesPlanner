import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { handleCatalogRequest } from "../catalog-service/server";
import type { UniversityDirectoryEntry } from "../lib/source-types";
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

test("each roadmap read error has one status and one short text, on the route and the catalog service (#136)", async (t) => {
  await withFixture(async (rootDir) => {
    const context = {
      sources: [],
      universities: buildDirectory(),
      rootDir,
      refresh: async () => { throw new Error("A roadmap read never refreshes a catalog."); },
      statuses: () => ({}),
    };
    // The route answer. The catalog service must give the same status and body.
    const answer = async (universityId: string, programId?: string) => {
      const response = await request(rootDir, `?university=${universityId}${programId ? `&program=${programId}` : ""}`);
      const route = { status: response.status, body: await response.json() };
      const servicePath = `/universities/${universityId}/${programId ? `roadmaps/${programId}` : "programs"}`;
      const service = await handleCatalogRequest("GET", new URL(`http://127.0.0.1${servicePath}`), Buffer.alloc(0), context);
      assert.deepEqual({ status: service.status, body: JSON.parse(service.body) }, route, servicePath);
      return route;
    };
    assert.deepEqual(await answer("does-not-exist"), { status: 404, body: { error: "Unknown university." } });
    assert.deepEqual(await answer("does-not-exist", READY_PROGRAM_ID), { status: 404, body: { error: "Unknown university." } });
    assert.deepEqual(await answer(TEST_ID, "does-not-exist"), { status: 404, body: { error: "Unknown roadmap program." } });
    assert.deepEqual(await answer(TEST_ID, QUEUED_PROGRAM_ID), { status: 503, body: { error: "Roadmap is not ready yet." } });
    // An error with no kind: the same generic 503, and each one logs the cause.
    const log = t.mock.method(console, "error", () => {});
    await writeFile(path.join(rootDir, "data", "catalogs", TEST_ID, "roadmaps", `${READY_PROGRAM_ID}.json`), JSON.stringify({ programId: "x" }));
    assert.deepEqual(await answer(TEST_ID, READY_PROGRAM_ID), { status: 503, body: { error: "Roadmap data is temporarily unavailable." } });
    assert.deepEqual(log.mock.calls.map((call) => /Program roadmap/.test(String(call.arguments[0]))), [true, true]);
    // A corrupt program list has its own kind. It is a fault, so each adapter also logs the file and the cause (#151).
    const programsFile = path.join(rootDir, "data", "catalogs", TEST_ID, "programs.json");
    const valid = JSON.parse(await readFile(programsFile, "utf8"));
    const invalid = { status: 503, body: { error: "The program list (programs.json) is invalid." } };
    const logged = () => log.mock.calls.map((call) =>
      /^Roadmap read failed: Program list is invalid: data\/catalogs\/test-university\/programs\.json: /.test(String(call.arguments[0])));
    // Not JSON, not a program list, and a list of another university.
    for (const content of ["{ not json", JSON.stringify({ version: 1 }), JSON.stringify({ ...valid, university: "Other University" })]) {
      log.mock.resetCalls();
      await writeFile(programsFile, content);
      assert.deepEqual(await answer(TEST_ID), invalid, content);
      assert.deepEqual(await answer(TEST_ID, READY_PROGRAM_ID), invalid, content);
      assert.deepEqual(logged(), [true, true, true, true], content);
    }
    // A lost program list is a fault too. The body names no folder; each adapter logs the path (#151).
    log.mock.resetCalls();
    await rm(programsFile);
    assert.deepEqual(
      await answer(TEST_ID, READY_PROGRAM_ID),
      { status: 404, body: { error: "The program list (programs.json) is missing." } },
    );
    assert.deepEqual(
      log.mock.calls.map((call) => call.arguments[0]),
      Array(2).fill("Roadmap read failed: Program list is missing: data/catalogs/test-university/programs.json"),
    );
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

test("roadmap storage failures return a safe public error", async (t) => {
  await withFixture(async (rootDir) => {
    await rm(path.join(rootDir, "catalog-service", "universities.json"));
    const log = t.mock.method(console, "error", () => {});
    const response = await request(rootDir);
    assert.equal(response.status, 503);
    const data = await response.json();
    assert.equal(data.error, "Roadmap data is temporarily unavailable.");
    assert.doesNotMatch(data.error, /ENOENT|universities\.json/);
    // Only the server log names the file.
    assert.equal(log.mock.callCount(), 1);
    assert.match(String(log.mock.calls[0]!.arguments[0]), /universities\.json/);
  });
});
