import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import CoursePage from "../app/[universityId]/[programId]/courses/[code]/page";
import pathwayConfig from "../config/pathways.json";
import { readCatalog } from "../lib/catalog";
import { CATALOGS, DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { programPageIndex } from "../lib/snapshot-manifest";
import {
  courseBySlug,
  courseSlug,
  isUnknownProgramPath,
  programPagePaths,
  needsReview,
  requirementText,
  shortestPrerequisiteChain,
  unmetRequirements,
  pathwaysFor,
  publicCourses,
  requirementLabel,
  transitiveUnlocks,
} from "../lib/course-pages";
import type { Course, Pathway } from "../lib/types";

const course = (code: string, prerequisiteCodes: string[], unlocks: string[]): Course => ({
  code, title: code, credits: 4, description: "Real text.", prerequisites: { type: "none" }, corequisites: { type: "none" },
  prerequisiteText: "", corequisiteText: "", prerequisiteCodes, corequisiteCodes: [], unlocks, breadthCategories: [],
  requirementType: "elective", electiveEligible: true, topics: [], officialUrl: "https://catalog.northeastern.edu/", uncertainties: [],
});

test("course slugs are URL-safe and round-trip through the packaged catalog", async () => {
  assert.equal(courseSlug("CS 5010"), "cs-5010");
  assert.equal(courseSlug("CS 7980A"), "cs-7980a");
  const catalog = await readCatalog();
  const pages = publicCourses(catalog);
  assert.equal(new Set(pages.map((item) => courseSlug(item.code))).size, pages.length, "two courses share a slug");
  assert.equal(courseBySlug(catalog, "cs-5010")?.code, "CS 5010");
  assert.equal(courseBySlug(catalog, "../etc"), undefined);
});

test("worker.ts decides 404 from the small build-time page index, not the catalog (#110)", async () => {
  const index = await programPageIndex(process.cwd());
  // Same pages as the prerender; a few KB in the bundle, against about 150 KB of catalog JSON.
  const published = await readCatalog(path.join(process.cwd(), "data", "catalog.json"));
  assert.deepEqual(index, Object.keys(CATALOGS).flatMap((key) => programPagePaths(key, published)));
  assert.ok(JSON.stringify(index).length < 16_000, `${JSON.stringify(index).length} bytes`);
  const worker = await readFile(path.join(process.cwd(), "worker.ts"), "utf8");
  assert.match(worker, /from "virtual:program-pages"/);
  assert.doesNotMatch(worker, /readCatalog|lib\/catalog"|await /, "a request must not read the catalog or wait for it");
});

test("unknown programs and course slugs go to the 404 route miss; real pages do not", async () => {
  const pages = new Set(await programPageIndex(process.cwd()));
  const p = `/${DEFAULT_CATALOG_KEY}`;
  for (const real of [p, `${p}/explore`, `${p}/planner`, `${p}/courses`, `${p}/pathways`, `${p}/courses/cs-5800`, `${p}/courses/cs-5010`, `${p}/pathways/systems`]) {
    assert.equal(isUnknownProgramPath(real, pages), false, real);
  }
  assert.equal(isUnknownProgramPath(`${p}/courses/zz-9999`, pages), true);
  assert.equal(isUnknownProgramPath(`${p}/courses/cis-200m`, pages), true, "placeholder course has no page");
  assert.equal(isUnknownProgramPath(`${p}/pathways/zz-9999`, pages), true);
  assert.equal(isUnknownProgramPath(`${p}/nothing`, pages), true);
  assert.equal(isUnknownProgramPath("/northeastern/no-such-program", pages), true, "unknown program");
  assert.equal(isUnknownProgramPath("/zz/yy/courses/cs-5800", pages), true, "unknown university");
  assert.equal(isUnknownProgramPath(`${p}/courses/`, pages), false, "trailing slash redirect stays with vinext");
  // Old top-level URLs redirect (next.config.ts); API routes and static files stay with vinext.
  for (const other of ["/courses/cs-5800", "/courses/zz-9999", "/pathways/systems", "/explore", "/api/catalog", "/api/roadmaps/x", "/_next/static/a.js", "/_snapshots/manifest.json", "/nothing", "/"]) {
    assert.equal(isUnknownProgramPath(other, pages), false, other);
  }
});

test("each catalog key in the manifest allowlist has program pages", async () => {
  // data/published.json lists the published programs; CATALOGS lists the catalogs that the pages can read.
  const published = (await import("../data/published.json", { with: { type: "json" } })).default as string[];
  assert.deepEqual([...published].sort(), Object.keys(CATALOGS).sort());
  const paths = programPagePaths(DEFAULT_CATALOG_KEY, await readCatalog());
  assert.equal(new Set(paths).size, paths.length, "two pages share a path");
  assert.ok(paths.every((path) => path.startsWith(`/${DEFAULT_CATALOG_KEY}`)));
});

test("placeholder courses (no catalog text) get no page", async () => {
  const catalog = await readCatalog();
  const pages = publicCourses(catalog);
  assert.ok(pages.length > 90, `only ${pages.length} course pages`);
  assert.ok(pages.every((item) => !item.description.includes("unavailable in the cached")));
  assert.equal(courseBySlug(catalog, "cis-200m"), undefined);
});

const one = (code: string) => ({ type: "course" as const, code });

test("unlocks follow links forward and stop at cycles", () => {
  const courses = [course("A", ["C"], ["B"]), course("B", ["A"], ["C"]), course("C", ["B"], ["A"])];
  assert.deepEqual(transitiveUnlocks("A", courses), ["B", "C"]);
  assert.deepEqual(transitiveUnlocks("C", [course("C", [], [])]), []);
});

test("the shortest chain takes the long branch of an 'and' and the short branch of an 'or'", () => {
  const x = course("X", [], ["Y"]);
  const y = { ...course("Y", ["X"], ["Z"]), prerequisites: one("X") };
  const w = course("W", [], ["Z"]);
  // Z needs (Y or W) and V. V is outside the catalog: one course, no known prerequisites.
  const z = { ...course("Z", ["Y", "W", "V"], []), prerequisites: { type: "all" as const, items: [{ type: "any" as const, items: [one("Y"), one("W")] }, one("V")] } };
  assert.deepEqual(shortestPrerequisiteChain("Z", [x, y, w, z]), ["W", "Z"]);
  const zAnd = { ...z, prerequisites: { type: "all" as const, items: [one("Y"), one("W")] } };
  assert.deepEqual(shortestPrerequisiteChain("Z", [x, y, w, zAnd]), ["X", "Y", "Z"]);
  const loop = { ...course("L", ["L2"], []), prerequisites: one("L2") };
  const loop2 = { ...course("L2", ["L"], []), prerequisites: one("L") };
  assert.deepEqual(shortestPrerequisiteChain("L", [loop, loop2]), ["L2", "L"], "a cycle stops");
});

test("prerequisite text keeps and/or, and unmet groups respect 'or'", async () => {
  const expr = { type: "all" as const, items: [{ type: "any" as const, items: [one("CS 5800"), one("CS 7800")] }, one("MATH 2331")] };
  assert.equal(requirementText(expr), "(CS 5800 or CS 7800) and MATH 2331");
  assert.deepEqual(unmetRequirements(expr, new Set(["CS 5800"])), [["MATH 2331"]], "CS 7800 is an alternative, not a gap");
  assert.deepEqual(unmetRequirements(expr, new Set()), [["CS 5800", "CS 7800"], ["MATH 2331"]]);
  assert.deepEqual(unmetRequirements({ type: "none" }, new Set()), []);
  // "(A and B) or C": A alone is not an option, so only C is offered.
  const andInOr = { type: "any" as const, items: [{ type: "all" as const, items: [one("A"), one("B")] }, one("C")] };
  assert.deepEqual(unmetRequirements(andInOr, new Set()), [["C"]]);
  const twoAnds = { type: "any" as const, items: [{ type: "all" as const, items: [one("A"), one("B")] }, { type: "all" as const, items: [one("C"), one("D")] }] };
  assert.deepEqual(unmetRequirements(twoAnds, new Set()), [["A"], ["B"]]);
  // Real data: CS 5500 lists CS 5010 twice (two grade floors) inside nested "or" groups.
  const cs5500 = (await readCatalog()).courses.find((item) => item.code === "CS 5500")!;
  assert.equal(requirementText(cs5500.prerequisites), "CS 5010 or CS 5004");
});

test("paths and requirement labels come from the packaged config and catalog", async () => {
  const catalog = await readCatalog();
  const used = pathwaysFor("CS 5335", pathwayConfig as Pathway[]);
  assert.ok(used.some(({ pathway, group }) => pathway.id === "robotics-software-engineer" && group === "High relevance"));
  assert.equal(requirementLabel(catalog.courses.find((item) => item.code === "CS 5010")!, catalog), "Required core course");
  const breadth = catalog.courses.find((item) => item.requirementType === "breadth")!;
  assert.match(requirementLabel(breadth, catalog), /^Breadth course: /);
  // CS 5003 is only a corequisite (of CS 5001), not a prerequisite for anything.
  assert.equal(requirementLabel(catalog.courses.find((item) => item.code === "CS 5003")!, catalog), "Outside the degree requirements");
});

test("an unknown clause is never treated as met (B3, #67)", async () => {
  const unknown = { type: "unknown" as const, text: "Graduate" };
  const andUnknown = { type: "all" as const, items: [one("A"), unknown] };
  assert.deepEqual(unmetRequirements(andUnknown, new Set(["A"])), [[needsReview("Graduate")]], "A is met, the unknown is still open");
  assert.deepEqual(unmetRequirements(andUnknown, new Set()), [["A"], [needsReview("Graduate")]]);
  // "A or <unknown>": A covers it. Without A, the unknown is only one option, not a pass.
  const orUnknown = { type: "any" as const, items: [one("A"), unknown] };
  assert.deepEqual(unmetRequirements(orUnknown, new Set(["A"])), []);
  assert.deepEqual(unmetRequirements(orUnknown, new Set()), [["A", needsReview("Graduate")]]);
  // Real data: CS 5330 is "MATH 2331 or graduate program admission".
  const cs5330 = (await readCatalog()).courses.find((item) => item.code === "CS 5330")!;
  assert.deepEqual(unmetRequirements(cs5330.prerequisites, new Set()), [["MATH 2331", needsReview("graduate program admission")]]);
});

test("course page shows the and/or structure of prerequisites (B2, #66)", async () => {
  const pageText = async (code: string) => renderToStaticMarkup(await CoursePage({ params: Promise.resolve({ universityId: "northeastern", programId: "computer-science-mscs-sea-8b0d00dbda", code }) }))
    .replace(/<[^>]+>/g, "");
  // CS 6510 needs (CS 5004 or CS 5010) and CS 5500.
  assert.match(await pageText("cs-6510"), /Take all of these:One of: CS 5004 [^,]+, CS 5010 [^,]+CS 5500 /);
  // CS 5400: "(Graduate)" is the level of a grade floor, not a clause, so nothing needs review.
  const cs5400 = await pageText("cs-5400");
  assert.match(cs5400, /One of: CS 5010 [^,]+, CS 5004 [^<]+?Catalog description/);
  assert.doesNotMatch(cs5400, /Needs review/);
  // CS 5330: "MATH 2331 or graduate program admission". The unclear option shows as needing review.
  assert.match(await pageText("cs-5330"), /One of: MATH 2331[^,]*, Needs review — graduate program admission/);
});

test("the sitemap and canonical URLs use the program paths (#71)", async () => {
  const { default: sitemap } = await import("../app/sitemap");
  const { generateMetadata } = await import("../app/[universityId]/[programId]/courses/[code]/page");
  const p = `https://coursesplanner.johnyc.com/${DEFAULT_CATALOG_KEY}`;
  const urls = (await sitemap()).map((entry) => entry.url);
  for (const url of [p, `${p}/explore`, `${p}/courses`, `${p}/pathways`, `${p}/courses/cs-5800`, `${p}/pathways/systems`]) {
    assert.ok(urls.includes(url), url);
  }
  assert.ok(!urls.includes(`${p}/planner`), "Plan has no catalog text of its own");
  assert.equal(urls[0], "https://coursesplanner.johnyc.com/", "the program picker is in the sitemap (#72)");
  const programs = Object.keys(CATALOGS).map((key) => `https://coursesplanner.johnyc.com/${key}`);
  assert.ok(urls.slice(1).every((url) => programs.some((program) => url === program || url.startsWith(`${program}/`))), "an old top-level URL is in the sitemap");
  const params = Promise.resolve({ universityId: "northeastern", programId: "computer-science-mscs-sea-8b0d00dbda", code: "cs-5800" });
  assert.equal((await generateMetadata({ params })).alternates?.canonical, `/${DEFAULT_CATALOG_KEY}/courses/cs-5800`);
});
