import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CourseDependencyFields } from "../components/course-card";
import {
  catalogTakeStatus,
  consumeExploreFocus,
  courseDependencyStats,
  DEFAULT_CATALOG_FILTERS,
  filterCatalogCourses,
} from "../lib/catalog-view";
import { emptyPlan } from "../lib/plan";
import { exploreFocusHref, parseExploreFocus } from "../lib/routes";
import type { Catalog, Course, Pathway, RequirementExpression, StudentPlan } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;
const pathways = JSON.parse(readFileSync(path.join(process.cwd(), "config", "pathways.json"), "utf8")) as Pathway[];
const byCode = new Map(seattle.courses.map((course) => [course.code, course] as const));

function course(code: string): Course {
  const found = byCode.get(code);
  assert.ok(found, `missing ${code}`);
  return found;
}

function plan(overrides: Partial<StudentPlan> = {}): StudentPlan {
  return { ...emptyPlan(), ...overrides };
}

const none: RequirementExpression = { type: "none" };

test("dependency stats lead with prereqs, unlocks, required-by pathways, and terms", () => {
  const stats = courseDependencyStats(
    { ...course("CS 5010"), termOfferings: ["Fall", "Spring"] },
    pathways,
  );
  assert.equal(stats.prereqCount, 0);
  assert.equal(stats.hasPrereqs, false);
  assert.equal(stats.unlockCount, 4);
  assert.equal(stats.requiredByPathwayCount, 1);
  assert.deepEqual(stats.pathwayNames, ["General Software Engineer"]);
  assert.deepEqual(stats.terms, ["Fall", "Spring"]);

  const algorithms = courseDependencyStats(course("CS 5800"), pathways);
  assert.equal(algorithms.unlockCount, 6);
  assert.equal(algorithms.requiredByPathwayCount, 2);
  assert.ok(algorithms.pathwayNames.includes("Machine Learning"));
  assert.ok(algorithms.pathwayNames.includes("Data Engineering"));
  assert.deepEqual(algorithms.terms, []);

  const software = courseDependencyStats(course("CS 5500"), pathways);
  assert.equal(software.prereqCount, 2);
  assert.equal(software.hasPrereqs, true);
  assert.equal(software.unlockCount, 1);
  assert.equal(software.requiredByPathwayCount, 2);
});

test("catalog cards render dependency fields and an Explore focus link", () => {
  const stats = courseDependencyStats(course("CS 5800"), pathways);
  const markup = renderToStaticMarkup(
    createElement(CourseDependencyFields, {
      stats,
      graphHref: exploreFocusHref("CS 5800"),
    }),
  );
  assert.match(markup, /Prereqs/);
  assert.match(markup, /Unlocks/);
  assert.match(markup, />6</);
  assert.match(markup, /Required by/);
  assert.match(markup, /2 pathways/);
  assert.match(markup, /Terms/);
  assert.match(markup, /Unknown/);
  assert.match(markup, /View dependency graph/);
  assert.match(markup, /href="\/explore\?focus=CS%205800"/);
});

test("I can take now and Blocked filters use completed/waived plan history", () => {
  const empty = plan();
  const takeNow = filterCatalogCourses(seattle.courses, empty, { ...DEFAULT_CATALOG_FILTERS, takeNow: true }).map(
    (item) => item.code,
  );
  const blocked = filterCatalogCourses(seattle.courses, empty, { ...DEFAULT_CATALOG_FILTERS, blocked: true }).map(
    (item) => item.code,
  );
  assert.ok(takeNow.includes("CS 5010"));
  assert.ok(takeNow.includes("CS 5800"));
  assert.equal(takeNow.includes("CS 5500"), false);
  assert.ok(blocked.includes("CS 5500"));
  assert.equal(blocked.includes("CS 5010"), false);
  assert.equal(catalogTakeStatus(course("CS 5500"), empty), "blocked");
  assert.equal(catalogTakeStatus(course("CS 5010"), empty), "can-take-now");

  const after5010 = plan({ completedCourses: ["CS 5010"] });
  assert.equal(catalogTakeStatus(course("CS 5010"), after5010), "recorded");
  assert.equal(catalogTakeStatus(course("CS 5500"), after5010), "can-take-now");
  const takeAfter = filterCatalogCourses(seattle.courses, after5010, { ...DEFAULT_CATALOG_FILTERS, takeNow: true }).map(
    (item) => item.code,
  );
  assert.ok(takeAfter.includes("CS 5500"));
  assert.equal(takeAfter.includes("CS 5010"), false);

  const planned5500 = plan({
    semesters: emptyPlan().semesters.map((semester, index) =>
      index === 0 ? { ...semester, courses: [{ code: "CS 5010", credits: 4 }] } : semester,
    ),
  });
  assert.equal(catalogTakeStatus(course("CS 5010"), planned5500), "recorded");
  // CS 5500 is planned here too, so it reads "recorded", not "blocked" (D3).
  assert.equal(catalogTakeStatus(course("CS 5500"), planned5500), "blocked");

  const plannedBlocked = plan({
    semesters: emptyPlan().semesters.map((semester, index) =>
      index === 0 ? { ...semester, courses: [{ code: "CS 5500", credits: 4 }] } : semester,
    ),
  });
  assert.equal(catalogTakeStatus(course("CS 5500"), plannedBlocked), "recorded");
});

test("No prereqs, Area, and Unlocks > N filters compose with plan+catalog state", () => {
  const empty = plan();
  const noPrereq = filterCatalogCourses(seattle.courses, empty, { ...DEFAULT_CATALOG_FILTERS, noPrereq: true });
  assert.ok(noPrereq.some((item) => item.code === "CS 5010"));
  assert.equal(noPrereq.some((item) => item.code === "CS 5500"), false);
  assert.ok(noPrereq.every((item) => item.prerequisites.type === "none"));

  const area = filterCatalogCourses(seattle.courses, empty, {
    ...DEFAULT_CATALOG_FILTERS,
    category: "systems-and-software",
  });
  assert.ok(area.some((item) => item.code === "CS 5500"));
  assert.ok(area.every((item) => item.breadthCategories.includes("systems-and-software")));

  const unlocks = filterCatalogCourses(seattle.courses, empty, { ...DEFAULT_CATALOG_FILTERS, minUnlocks: 3 });
  assert.ok(unlocks.some((item) => item.code === "CS 5010"));
  assert.ok(unlocks.some((item) => item.code === "CS 5800"));
  assert.ok(unlocks.every((item) => item.unlocks.length > 3));
  assert.equal(unlocks.some((item) => item.code === "CS 5500"), false);

  const takeNowAndNoPrereq = filterCatalogCourses(seattle.courses, empty, {
    ...DEFAULT_CATALOG_FILTERS,
    takeNow: true,
    noPrereq: true,
  });
  assert.ok(takeNowAndNoPrereq.some((item) => item.code === "CS 5800"));
  assert.ok(takeNowAndNoPrereq.every((item) => item.prerequisites.type === none.type && catalogTakeStatus(item, empty) === "can-take-now"));
});

test("Explore focus deep-link parses course codes and is consumed once", () => {
  assert.equal(parseExploreFocus("CS 5500"), "CS 5500");
  assert.equal(parseExploreFocus("CS5500"), "CS 5500");
  assert.equal(parseExploreFocus("cs-5500"), "CS 5500");
  assert.equal(parseExploreFocus("not-a-course"), null);
  assert.equal(exploreFocusHref("CS 5500"), "/explore?focus=CS%205500");

  const lastApplied = { current: null as string | null };
  const known = new Set(["CS 5500", "CS 5800"]);
  assert.equal(consumeExploreFocus("CS 5500", known, lastApplied), "CS 5500");
  assert.equal(consumeExploreFocus("CS 5500", known, lastApplied), null);
  assert.equal(consumeExploreFocus("CS 5800", known, lastApplied), "CS 5800");
  assert.equal(consumeExploreFocus("CS 9999", known, lastApplied), null);
});
