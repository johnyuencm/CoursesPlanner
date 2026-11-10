import { strict as assert } from "node:assert";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { after, before } from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { defaultCatalogFilePath, validateProgramRoadmap } from "../lib/catalog";
import { findUniversity, readProgramDirectory, readReadyRoadmap } from "../lib/roadmap-reader";
import { isUniversitySelectable } from "../lib/roadmaps";
import { loadUniversityDirectory } from "../lib/university-directory";
import { publishedCopy } from "./published-copy";

const ROOT = process.cwd();
const UNIVERSITY_ID = "northeastern";
const PROGRAM_ID = "computer-science-mscs-sea-8b0d00dbda";
// The tracked cache (.catalog-cache.json) fetched the program page on this date.
const SOURCE_DATE = "2026-09-12T01:09:37.140Z";
// Roadmap reads go through a copy of the tracked files, so ignored crawl output cannot leak in (#123).
let SNAPSHOT = "";
before(async () => { SNAPSHOT = await publishedCopy(); });
after(() => rmSync(SNAPSHOT, { recursive: true, force: true }));

async function northeastern() {
  const universities = await loadUniversityDirectory(
    path.join(ROOT, "catalog-service", "universities.json"),
  );
  return findUniversity(universities, UNIVERSITY_ID);
}

test("the committed snapshot ships a ready Northeastern program", async () => {
  const university = await northeastern();
  const directory = await readProgramDirectory(university, SNAPSHOT);
  const program = directory.programs.find((entry) => entry.id === PROGRAM_ID);
  assert.ok(program, "committed programs.json must contain the MSCS Seattle program");
  assert.equal(program.status, "ready");
  assert.equal(program.name, "Computer Science, MSCS (Seattle)");
  assert.equal(
    isUniversitySelectable({ ...university, status: directory.status }),
    true,
    "a ready program must make the university selectable",
  );
});

test("the committed roadmap validates and preserves the cached source date", async () => {
  const university = await northeastern();
  const roadmap = await readReadyRoadmap(university, PROGRAM_ID, SNAPSHOT);
  validateProgramRoadmap(roadmap, university.crawl!.allowedOrigins);

  assert.equal(roadmap.programId, PROGRAM_ID);
  assert.equal(roadmap.lastUpdated, SOURCE_DATE, "cached September data must not be labelled fresh");
  assert.ok(roadmap.programCourseCodes.includes("CS 5010"));
  assert.ok(roadmap.programCourseCodes.includes("CS 5500"));

  // No fabricated degree requirements: a ProgramRoadmap carries no requirements
  // and every program code has real or explicit-placeholder course metadata.
  assert.equal("requirements" in roadmap, false);
  const byCode = new Map(roadmap.courses.map((course) => [course.code, course] as const));
  for (const code of roadmap.programCourseCodes) assert.ok(byCode.has(code), `missing metadata for ${code}`);
  const byCode5010 = byCode.get("CS 5010");
  assert.ok(byCode5010?.unlocks.includes("CS 5500"), "real parsed prerequisite edge must survive");
  assert.equal(byCode5010?.requirementType, "program");
  assert.equal(byCode.get("CS 5500")?.electiveEligible, false);
  assert.ok(
    roadmap.warnings.some((warning) => /offline from the tracked 2026-09-12 catalog cache/i.test(warning)),
    "provenance warning must record the offline regeneration",
  );
});

test("the route serves the committed directory and roadmap with 200", async () => {
  const directory = await handleRoadmapsRequest(
    new NextRequest(`http://localhost:3000/api/roadmaps?university=${UNIVERSITY_ID}`),
    SNAPSHOT,
  );
  assert.equal(directory.status, 200);
  const body = await directory.json();
  assert.ok(body.programs.some((program: { id: string; status: string }) => program.id === PROGRAM_ID && program.status === "ready"));

  const roadmap = await handleRoadmapsRequest(
    new NextRequest(`http://localhost:3000/api/roadmaps?university=${UNIVERSITY_ID}&program=${PROGRAM_ID}`),
    SNAPSHOT,
  );
  assert.equal(roadmap.status, 200);
  assert.equal((await roadmap.json()).programId, PROGRAM_ID);
});

test("the committed program is published to the Worker, and the route has no crawler", () => {
  const published = JSON.parse(readFileSync(path.join(ROOT, "data/published.json"), "utf8"));
  assert.ok(published.includes(`${UNIVERSITY_ID}/${PROGRAM_ID}`));
  const route = readFileSync(path.join(ROOT, "app/api/roadmaps/route.ts"), "utf8");
  assert.doesNotMatch(route, /cheerio|catalog-service\/(adapters|crawler|refresh|roadmaps)/);
});

test("the default catalog is the tracked data/catalog.json, never an ignored local refresh copy (#123)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "catalog-path-"));
  const saved = process.env.CATALOG_DATA_PATH;
  delete process.env.CATALOG_DATA_PATH;
  try {
    // A catalog-service refresh leaves this ignored mirror; a stale one must not shadow the snapshot.
    mkdirSync(path.join(root, "data", "catalogs", "neu-mscs-seattle"), { recursive: true });
    writeFileSync(path.join(root, "data", "catalogs", "neu-mscs-seattle", "catalog.json"), "{}");
    process.chdir(root);
    assert.equal(path.relative(process.cwd(), defaultCatalogFilePath()), path.join("data", "catalog.json"));
  } finally {
    process.chdir(ROOT);
    if (saved !== undefined) process.env.CATALOG_DATA_PATH = saved;
    rmSync(root, { recursive: true, force: true });
  }
});
