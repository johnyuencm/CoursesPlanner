import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleRoadmapsRequest } from "../app/api/roadmaps/route";
import { validateProgramRoadmap } from "../lib/catalog";
import { findUniversity, readProgramDirectory, readReadyRoadmap } from "../lib/roadmap-reader";
import { isUniversitySelectable } from "../lib/roadmaps";
import { loadUniversityDirectory } from "../lib/university-directory";

const ROOT = process.cwd();
const UNIVERSITY_ID = "northeastern";
const PROGRAM_ID = "computer-science-mscs-sea-8b0d00dbda";
// The tracked cache (.catalog-cache.json) fetched the program page on this date.
const SOURCE_DATE = "2026-09-12T01:09:37.140Z";

async function northeastern() {
  const universities = await loadUniversityDirectory(
    path.join(ROOT, "catalog-service", "universities.json"),
  );
  return findUniversity(universities, UNIVERSITY_ID);
}

test("the committed snapshot ships a ready Northeastern program", async () => {
  const university = await northeastern();
  const directory = await readProgramDirectory(university, ROOT);
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
  const roadmap = await readReadyRoadmap(university, PROGRAM_ID, ROOT);
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
    ROOT,
  );
  assert.equal(directory.status, 200);
  const body = await directory.json();
  assert.ok(body.programs.some((program: { id: string; status: string }) => program.id === PROGRAM_ID && program.status === "ready"));

  const roadmap = await handleRoadmapsRequest(
    new NextRequest(`http://localhost:3000/api/roadmaps?university=${UNIVERSITY_ID}&program=${PROGRAM_ID}`),
    ROOT,
  );
  assert.equal(roadmap.status, 200);
  assert.equal((await roadmap.json()).programId, PROGRAM_ID);
});

test("the serverless trace ships both snapshot files and no crawler", () => {
  const config = readFileSync(path.join(ROOT, "next.config.ts"), "utf8");
  for (const file of [
    "catalog-service/universities.json",
    "data/catalogs/northeastern/programs.json",
    `data/catalogs/northeastern/roadmaps/${PROGRAM_ID}.json`,
  ]) {
    assert.match(config, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  const route = readFileSync(path.join(ROOT, "app/api/roadmaps/route.ts"), "utf8");
  assert.doesNotMatch(route, /cheerio|catalog-service\/(adapters|crawler|refresh|roadmaps)/);
});
