import { strict as assert } from "node:assert";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { matchesQuery } from "../components/program-picker";
import { DegreeRules } from "../components/program-summary";
import { overviewSnapshot } from "../lib/overview";
import { emptyPlan } from "../lib/plan";
import { DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { legacyDestination, legacyRedirects, parseExploreFocus, primaryNav, programRoutes } from "../lib/routes";
import type { Catalog, Course, RequirementExpression, StudentPlan } from "../lib/types";
import { validatePlan } from "../lib/requirements-v2";
import { mscsRequirements } from "./mscs-requirements";

const none: RequirementExpression = { type: "none" };
const req = (code: string): RequirementExpression => ({ type: "course", code });

function course(code: string, overrides: Partial<Course> = {}): Course {
  return {
    code,
    title: code,
    credits: 4,
    description: "",
    prerequisites: none,
    corequisites: none,
    prerequisiteText: "",
    corequisiteText: "",
    prerequisiteCodes: [],
    corequisiteCodes: [],
    unlocks: [],
    breadthCategories: [],
    requirementType: "elective",
    electiveEligible: true,
    topics: [],
    officialUrl: "https://example.test/course",
    uncertainties: [],
    ...overrides,
  };
}

function catalog(): Catalog {
  const courses = [
    course("CS 5010", { requirementType: "core", unlocks: ["CS 5500", "CS 6510"] }),
    course("CS 5011", { credits: 0, requirementType: "core" }),
    course("CS 5800", { requirementType: "core" }),
    course("CS 5500", {
      requirementType: "breadth",
      breadthCategories: ["systems"],
      prerequisites: req("CS 5010"),
      prerequisiteCodes: ["CS 5010"],
    }),
    course("CS 6510", {
      requirementType: "breadth",
      breadthCategories: ["systems"],
      prerequisites: req("CS 5010"),
      prerequisiteCodes: ["CS 5010"],
    }),
    course("CS 6100"),
  ];
  return {
    courses,
    requirements: mscsRequirements({
      core: ["CS 5010", "CS 5011", "CS 5800"],
      areas: [
        { id: "systems", name: "Systems", courses: ["CS 5500", "CS 6510"] },
        { id: "theory", name: "Theory", courses: [] },
        { id: "software", name: "Software", courses: [] },
      ],
      electives: ["CS 6100"],
    }),
    lastUpdated: "2026-09-10",
    sources: [],
    warnings: [],
  };
}

const base = `/${DEFAULT_CATALOG_KEY}`;
const routes = programRoutes(DEFAULT_CATALOG_KEY);

test("primary nav is Explore, Plan, Courses, Paths under the program path", () => {
  assert.deepEqual(
    primaryNav(routes).map((item) => item.label),
    ["Explore", "Plan", "Courses", "Paths"],
  );
  assert.deepEqual(
    primaryNav(routes).map((item) => item.href),
    [`${base}/explore`, `${base}/planner`, `${base}/courses`, `${base}/pathways`],
  );
  assert.equal(routes.overview, base);
  assert.equal(base, "/northeastern/computer-science-mscs-sea-8b0d00dbda");
  assert.equal(programRoutes("mit/eecs").course("6-1010"), "/mit/eecs/courses/6-1010");
  assert.equal(programRoutes("mit/eecs").pathway("systems"), "/mit/eecs/pathways/systems");
});

test("old top-level URLs redirect to the default program (#71); / is the picker (#72)", () => {
  assert.deepEqual(legacyRedirects, [
    { source: "/map", destination: `${base}/explore`, permanent: true },
    { source: "/explore", destination: `${base}/explore`, permanent: true },
    { source: "/planner", destination: `${base}/planner`, permanent: true },
    { source: "/courses", destination: `${base}/courses`, permanent: true },
    { source: "/pathways", destination: `${base}/pathways`, permanent: true },
    { source: "/courses/:slug", destination: `${base}/courses/:slug`, permanent: true },
    { source: "/pathways/:id", destination: `${base}/pathways/:id`, permanent: true },
  ]);
});

test("an old path with a trailing slash maps to the new path in one hop (#72)", () => {
  assert.equal(legacyDestination("/courses"), `${base}/courses`);
  assert.equal(legacyDestination("/explore"), `${base}/explore`);
  assert.equal(legacyDestination("/map"), `${base}/explore`);
  assert.equal(legacyDestination("/courses/cs-5800"), `${base}/courses/cs-5800`);
  assert.equal(legacyDestination("/pathways/systems"), `${base}/pathways/systems`);
  for (const other of ["", "/courses/cs-5800/x", "/nothing", `${base}/courses`, "/api"]) assert.equal(legacyDestination(other), null, other);
});

test("/ is the program picker: published programs with tier and catalog year, other colleges not supported yet (#72)", async () => {
  const { default: HomePage, metadata } = await import("../app/page");
  const html = renderToStaticMarkup(await HomePage());
  assert.match(html, /<h1>Pick your college and program<\/h1>/);
  // A short intro in the server HTML says what the site does (#117).
  const intro = /<p class="picker-intro">([^<]+)<\/p>/.exec(html)?.[1] ?? "";
  for (const word of ["prerequisite", "unlocks", "plan", "browser"]) assert.match(intro, new RegExp(word), `the intro does not say "${word}"`);
  assert.ok(intro.length <= 300, `the intro has ${intro.length} characters`);
  assert.match(html, new RegExp(`href="${base}"`), "the published program links to its overview");
  assert.match(html, /Northeastern University<\/h3>/);
  assert.equal(html.match(/<h3>Northeastern/g)?.length, 1, "one heading per college, for every program of that college");
  assert.match(html, /Computer Science, MSCS—Seattle/);
  assert.match(html, />Audit<\/span><span>2026-2027 catalog/);
  assert.match(html, /Colleges not supported yet/);
  assert.match(html, /MIT<\/span> <span class="badge">Not supported yet/);
  assert.doesNotMatch(html, /Northeastern<\/span> <span class="badge">Not supported yet/, "a supported college is not in the other list");
  assert.equal(metadata.alternates?.canonical, "/");
});

test("picker search matches every word of the query", () => {
  assert.equal(matchesQuery("", "MIT"), true);
  assert.equal(matchesQuery("northeastern computer", "Northeastern University Computer Science, MSCS"), true);
  assert.equal(matchesQuery("computer bs", "Northeastern University Computer Science, MSCS"), false);
});

test("program pages name the college and program; no hardcoded NEU MSCS branding (#72)", async () => {
  const { generateMetadata } = await import("../app/[universityId]/[programId]/layout");
  const params = Promise.resolve({ universityId: "northeastern", programId: "computer-science-mscs-sea-8b0d00dbda" });
  const title = (await generateMetadata({ params })).title as { default: string; template: string };
  assert.equal(title.template, "%s · NEU MSCS Seattle", "the short name from data/catalog.json (#117)");
  // The UI and metadata get college and program names from the snapshot only.
  for (const dir of ["app", "components"]) {
    for (const file of readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((name) => /\.tsx?$/.test(name))) {
      assert.doesNotMatch(readFileSync(path.join(dir, file), "utf8"), /NEU MSCS|Northeastern|MSCS Seattle/i, `${dir}/${file}`);
    }
  }
});

test("degree rules list every breadth and elective group, with the snapshot's college name (#72)", async () => {
  const data = catalog();
  const root = data.requirements.root;
  assert.equal(root.kind, "all");
  if (root.kind !== "all") return;
  const breadth = root.children.find((group) => group.kind === "choose-areas")!;
  const electives = root.children.find((group) => group.kind === "choose-credits")!;
  root.children.push({ ...breadth, id: "breadth-2", label: "Second breadth" }, { ...electives, id: "electives-2", label: "Second electives" });
  const html = renderToStaticMarkup(DegreeRules({ catalog: { ...data, university: "Example University" }, routes }));
  for (const label of ["Breadth areas", "Second breadth", "Electives", "Second electives"]) assert.match(html, new RegExp(`<h3>${label}</h3>`), label);
  assert.match(html, /Example University catalog/);
  assert.doesNotMatch(html, /Northeastern/);
});

test("target path panel is anchored on Plan", () => {
  assert.equal(routes.targetPath, `${base}/planner#target-path`);
});

test("critical path panel is anchored on Plan", () => {
  assert.equal(routes.criticalPath, `${base}/planner#critical-path`);
});

test("Courses View dependency graph deep-links into Explore focus", () => {
  assert.equal(routes.exploreFocus("CS 5500"), `${base}/explore?focus=CS%205500`);
  assert.equal(parseExploreFocus("CS5500"), "CS 5500");
});

test("slim overview reports credits, target, critical prereq, and next unlock", () => {
  const data = catalog();
  const empty = overviewSnapshot({
    catalog: data,
    plan: emptyPlan(),
    progress: validatePlan(emptyPlan(), data),
    targetName: null,
  });
  assert.equal(empty.credits.current, 0);
  assert.equal(empty.credits.required, 32);
  assert.equal(empty.targetName, null);
  assert.equal(empty.criticalPrereq, null);
  assert.equal(empty.nextUnlock?.code, "CS 5010");
  assert.deepEqual(empty.nextUnlock?.unlocks, ["CS 5500", "CS 6510"]);

  const blockedPlan: StudentPlan = {
    version: 1,
    completedCourses: [],
    waivedCourses: [],
    completedCredits: {},
    semesters: [{ id: "fall-2026", name: "Fall 2026", type: "academic", courses: [{ code: "CS 5500", credits: 4 }] }],
  };
  const blocked = overviewSnapshot({
    catalog: data,
    plan: blockedPlan,
    progress: validatePlan(blockedPlan, data),
    targetName: "Robotics",
  });
  assert.equal(blocked.targetName, "Robotics");
  assert.equal(blocked.criticalPrereq?.courseCode, "CS 5500");
  assert.match(blocked.criticalPrereq?.message ?? "", /CS 5010/);
});
