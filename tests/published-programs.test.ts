// Map-tier Northeastern programs from the bounded crawl of 2026-11-08 (#74).
// The fixtures are the committed roadmap snapshots and parse reports in data/catalogs/northeastern/.
import { strict as assert } from "node:assert";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { roadmapReport } from "../catalog-service/roadmaps";
import { validateCatalog, validateProgramRoadmap } from "../lib/catalog";
import { CATALOGS, DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { isUnknownProgramPath, pathwaysFitCatalog, programPagePaths, publicCourses, shortestPrerequisiteChain } from "../lib/course-pages";
import { programMapCodes } from "../lib/graph";
import { readProgramCatalog } from "../lib/program-catalog";
import { emptyPlan } from "../lib/plan";
import { requirementTier, validatePlan } from "../lib/requirements-v2";
import { programPageIndex } from "../lib/snapshot-manifest";
import type { ProgramRoadmap } from "../lib/types";
import { loadUniversityDirectory } from "../lib/university-directory";
import { PUBLISHED, publishedCopy } from "./published-copy";

const PROGRAMS = [
  { key: "northeastern/computer-science-mscs-976b977119", program: "Computer Science, MSCS (Boston)", courses: 84, pages: 62, chain: ["CS 5010", "CS 5500", "CS 6510"], page: "cs-6510" },
  { key: "northeastern/computer-science-mscs-align-a4f8db6b17", program: "Computer Science, MSCS—Align (Boston)", courses: 86, pages: 64, chain: ["CS 5001", "CS 5004"], page: "cs-5004" },
  { key: "northeastern/cybersecurity-ms-429a5fa183", program: "Cybersecurity, MS (Boston)", courses: 50, pages: 43, chain: ["CY 5010", "CY 6120"], page: "cy-6120" },
  { key: "northeastern/data-science-ms-ptl-0da0db71be", program: "Data Science, MS (Portland)", courses: 71, pages: 51, chain: ["CS 5800", "CS 6140"], page: "cs-6140" },
];

for (const expected of PROGRAMS) {
  test(`${expected.program} is published at Map tier with its courses and prerequisite chain (#74)`, async () => {
    assert.ok(Object.hasOwn(CATALOGS, expected.key), "listed in CATALOGS");
    const catalog = await readProgramCatalog(expected.key);
    validateCatalog(structuredClone(catalog));
    assert.equal(catalog.program, expected.program);
    assert.equal(catalog.courses.length, expected.courses);
    assert.equal(publicCourses(catalog).length, expected.pages);
    assert.equal(requirementTier(catalog.requirements, catalog.courses), "map");
    assert.equal(catalog.requirements.catalogYear, "2026-2027");
    assert.deepEqual(shortestPrerequisiteChain(expected.chain.at(-1)!, catalog.courses), expected.chain);
    // Plan: prerequisite checks, no degree audit. The last course of the chain alone is blocked by the first.
    const plan = emptyPlan();
    plan.semesters[0]!.courses.push({ code: expected.chain.at(-1)!, credits: 4 });
    const progress = validatePlan(plan, catalog);
    assert.equal(progress.tier, "map");
    assert.equal(progress.satisfied, false);
    assert.ok(progress.issues.some((issue) => issue.courseCode === expected.chain.at(-1) && issue.message.includes(expected.chain.at(-2)!)), "prerequisite issue");
    // The explore map scope holds the program courses, though no rule group lists them.
    assert.ok(expected.chain.every((code) => programMapCodes(catalog.courses, catalog.requirements).has(code)));

    const pages = new Set(programPagePaths(expected.key, catalog));
    const program = `/${expected.key}`;
    for (const path of [program, `${program}/explore`, `${program}/planner`, `${program}/courses`, `${program}/courses/${expected.page}`]) {
      assert.equal(isUnknownProgramPath(path, pages), false, path);
    }
    assert.equal(isUnknownProgramPath(`${program}/courses/zz-9999`, pages), true);
  });

  test(`${expected.program} path pages stay out of the sitemap and get noindex until #73`, async () => {
    const { default: sitemap } = await import("../app/sitemap");
    const { generateMetadata: pathsMetadata } = await import("../app/[universityId]/[programId]/pathways/page");
    const { generateMetadata: pathMetadata } = await import("../app/[universityId]/[programId]/pathways/[id]/page");
    const [universityId = "", programId = ""] = expected.key.split("/");
    assert.equal(pathwaysFitCatalog(await readProgramCatalog(expected.key)), false);
    const program = `https://coursesplanner.johnyc.com/${expected.key}`;
    const urls = (await sitemap()).map((entry) => entry.url);
    assert.ok(urls.includes(`${program}/courses/${expected.page}`));
    assert.ok(!urls.some((url) => url.startsWith(`${program}/pathways`)), "no path page in the sitemap");
    const noindex = { index: false, follow: true };
    assert.deepEqual((await pathsMetadata({ params: Promise.resolve({ universityId, programId }) })).robots, noindex);
    assert.deepEqual((await pathMetadata({ params: Promise.resolve({ universityId, programId, id: "systems" }) })).robots, noindex);
  });

  test(`${expected.program} has a parse report that matches its snapshot (#74)`, async () => {
    const id = expected.key.split("/")[1];
    const roadmap: unknown = JSON.parse(await readFile(`data/catalogs/northeastern/roadmaps/${id}.json`, "utf8"));
    validateProgramRoadmap(roadmap, ["https://catalog.northeastern.edu"]);
    const report = JSON.parse(await readFile(`data/catalogs/northeastern/reports/${id}.json`, "utf8"));
    assert.deepEqual(report, roadmapReport(roadmap as ProgramRoadmap));
    const shortNames = (await loadUniversityDirectory()).find((entry) => entry.id === "northeastern")?.crawl?.shortNames ?? {};
    assert.equal((roadmap as ProgramRoadmap).shortName, shortNames[id!], "the crawl copies the short name from catalog-service/universities.json (#117)");
    assert.equal(report.tier, "map");
    assert.equal(report.courses, expected.courses);
  });
}

test("the default program keeps its path pages in the sitemap, with no noindex", async () => {
  const { default: sitemap } = await import("../app/sitemap");
  const { generateMetadata } = await import("../app/[universityId]/[programId]/pathways/[id]/page");
  assert.equal(pathwaysFitCatalog(await readProgramCatalog(DEFAULT_CATALOG_KEY)), true);
  const urls = (await sitemap()).map((entry) => entry.url);
  assert.ok(urls.includes(`https://coursesplanner.johnyc.com/${DEFAULT_CATALOG_KEY}/pathways/systems`));
  const params = Promise.resolve({ universityId: "northeastern", programId: "computer-science-mscs-sea-8b0d00dbda", id: "systems" });
  assert.equal((await generateMetadata({ params })).robots, undefined);
});

test("each program catalog reads only its committed roadmap, never ignored crawl output (#123, #74)", async (t) => {
  const clean = await publishedCopy();
  const dirty = await publishedCopy();
  t.after(() => Promise.all([clean, dirty].map((root) => rm(root, { recursive: true, force: true }))));
  // What a local crawl leaves behind: an invalid status file, the raw cache and an unpublished roadmap.
  const crawl = path.join(dirty, "data", "catalogs", "northeastern");
  await writeFile(path.join(crawl, ".roadmap-crawl-status.json"), JSON.stringify({ version: 1 }));
  await mkdir(path.join(crawl, "raw"), { recursive: true });
  await writeFile(path.join(crawl, "raw", "x.html"), "<html></html>");
  await writeFile(path.join(crawl, "roadmaps", "zz-extra.json"), "{ not json");
  await mkdir(path.join(dirty, "data", "catalogs", "neu-mscs-seattle"), { recursive: true });
  await writeFile(path.join(dirty, "data", "catalogs", "neu-mscs-seattle", "catalog.json"), "{}");
  assert.deepEqual(PUBLISHED.slice(1), PROGRAMS.map((program) => program.key), "every Map-tier key is pinned here");
  for (const { key, courses } of PROGRAMS) {
    const catalog = await readProgramCatalog(key, dirty);
    assert.deepEqual(catalog, await readProgramCatalog(key, clean), key);
    assert.equal(catalog.courses.length, courses, key);
  }
  assert.deepEqual(await programPageIndex(dirty), await programPageIndex(clean));
  assert.deepEqual(await programPageIndex(clean), await programPageIndex(process.cwd()), "the repo gives the tracked result");
});
