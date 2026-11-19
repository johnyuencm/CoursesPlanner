// The planner text of an Audit-tier and a Map-tier program (#126), and while the catalog loads or fails (#140).
import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import PlannerPage, { generateMetadata } from "../app/[universityId]/[programId]/planner/page";
import { AppContext, chainAddedNotice, useAppContextValue } from "../components/app-provider";
import { CourseDetail, CoursePicker } from "../components/course-dialogs";
import PlannerBoard from "../components/planner-board";
import { DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { readProgramCatalog } from "../lib/program-catalog";
import { validatePlan } from "../lib/requirements-v2";
import type { StudentPlan } from "../lib/types";

/** MSCS Boston: a roadmap with no modeled degree rules, so Map tier. */
const MAP_KEY = "northeastern/computer-science-mscs-976b977119";

/**
 * One issue of every kind, so the issue rail shows its messages: CS 2100 misses its prerequisite
 * and its corequisite and is planned twice, ZZ 9999 is not in the catalog, CS 5001 has credits but is not completed.
 */
const PLAN_WITH_ISSUES: StudentPlan = {
  version: 1,
  completedCourses: [],
  waivedCourses: [],
  completedCredits: { "CS 5001": 4 },
  semesters: [{ id: "fall", name: "Fall 2026", type: "academic", courses: [{ code: "CS 2100" }, { code: "CS 2100" }, { code: "ZZ 9999" }] }],
};

/**
 * The planner page of `key` after its catalog has loaded, as plain text, and the page description.
 * The page shows once with an empty plan and once with PLAN_WITH_ISSUES.
 * Each render shows the corequisite note of a course on three surfaces:
 * the Add course dialog on CS 5004 (prerequisites not met), the course detail dialog on CS 2000,
 * and the target path card on CS 2500 (prerequisites not verified).
 */
async function plannerText(key: string): Promise<string> {
  const [universityId = "", programId = ""] = key.split("/");
  const params = () => Promise.resolve({ universityId, programId });
  const catalog = await readProgramCatalog(key);
  const page = await PlannerPage({ params: params() });
  function LoadedPlanner({ issues }: { issues: boolean }) {
    const app = useAppContextValue(key);
    const plan = issues ? PLAN_WITH_ISSUES : app.plan;
    const value = { ...app, catalog, plan, progress: validatePlan(plan, catalog), picker: { courseCode: "CS 5004" }, courseTargetCode: "CS 2500" };
    return createElement(AppContext.Provider, { value }, page, createElement(CoursePicker), createElement(CourseDetail, { code: "CS 2000" }));
  }
  // The board calls useRouter(), which needs a mounted app router. Nothing here navigates.
  const render = (issues: boolean) => renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(LoadedPlanner, { issues })));
  const html = render(false) + render(true);
  const { description } = await generateMetadata({ params: params() });
  // Attributes that a browser shows or a screen reader reads. Class names are not text.
  const attributes = [...html.matchAll(/\s(?:aria-(?:label|description|valuetext)|title|alt|placeholder)="([^"]*)"/g)].map((match) => match[1]);
  return `${html.replace(/<[^>]+>/g, " ")} ${attributes.join(" ")} ${description}`.replace(/\s+/g, " ");
}

test("the Audit-tier planner (MSCS Seattle) keeps its degree audit text (#126)", async () => {
  const text = await plannerText(DEFAULT_CATALOG_KEY);
  assert.match(text, /Requirement groups met/, "the status card shows the degree audit");
  for (const kept of [
    "Arrange semesters, test prerequisites, and see every degree requirement update as you go.",
    "Review audit",
    "What this audit cannot verify",
    "It also counts your credits against the degree rules below.",
    "You can still add this course and resolve the audit warnings.",
    "The planner checks prerequisites and degree rules, and saves the plan only in your browser.",
  ]) assert.ok(text.includes(kept), `"${kept}" is missing`);
});

test("the Map-tier planner shows plan checks and never says it gives a degree audit (#126)", async () => {
  const text = await plannerText(MAP_KEY);
  assert.match(text, /Requirements \(map tier\) No degree audit/, "the status card shows Map tier");
  // "audit" stays only where the text says that there is none, or names the official university audit.
  assert.doesNotMatch(text.replace(/no degree audit|official university audit/gi, ""), /audit/i);
  assert.doesNotMatch(text, /degree requirement update|credits against the degree rules|checks prerequisites and degree rules/);
  for (const shown of [
    "Arrange semesters. The planner checks prerequisites and term order as you go.",
    "Plan checks prerequisites and term order only.",
    "Review plan checks",
    "What the plan checks cannot verify",
    "You can still add this course and resolve the plan check warnings.",
    "The planner checks prerequisites and term order, and saves the plan only in your browser.",
    // One corequisite note per surface, so the "audit" check above sees them (#126 review H1).
    "Corequisite checked separately: CS 5005.",
    "Corequisite checked separately: CS 2001.",
    "Corequisite checked separately: unverified requirement: Course details for CS 2500",
    // The issue rail shows one issue of every kind, so the "audit" check above also reads the issue text.
    "Plan checks that need attention.",
    "CS 2100: prerequisite",
    "CS 2100: corequisite",
    "CS 2100: duplicate",
    "ZZ 9999: unknown",
    "CS 5001: credits",
  ]) assert.ok(text.includes(shown), `"${shown}" is missing`);
});

test("the prerequisite chain toast points to the live audit only on an Audit-tier program (#126)", async () => {
  const [audit, map] = await Promise.all([readProgramCatalog(DEFAULT_CATALOG_KEY), readProgramCatalog(MAP_KEY)]);
  assert.equal(
    chainAddedNotice(audit, ["CS 5001", "CS 5002"], "CS 5004", []),
    "CS 5001, CS 5002 added along the path to CS 5004. Check the live audit for prerequisites and corequisites.",
  );
  assert.equal(
    chainAddedNotice(map, ["CS 5001", "CS 5002"], "CS 5004", ["Fall 2026"]),
    "CS 5001, CS 5002 added along the path to CS 5004. Created Fall 2026. Review the plan checks for prerequisites and corequisites.",
  );
});

/** The planner board without a catalog, as HTML. `state` changes the catalog load state of the provider's first state. */
function boardWithoutCatalog(state: Partial<ReturnType<typeof useAppContextValue>> = {}): string {
  function Board() {
    return createElement(AppContext.Provider, { value: { ...useAppContextValue(DEFAULT_CATALOG_KEY), ...state } }, createElement(PlannerBoard));
  }
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(Board)));
}

/** The text that says the catalog failed (#140). */
const CATALOG_FAILED = ["while the catalog is unavailable", "The catalog is unavailable", "The course catalog did not load"];

test("while the catalog loads, the planner shows a loading status, not the unavailable text (#140)", () => {
  // The provider's first state is the server render. `hydrated` is the state after the plan loads from browser storage.
  for (const html of [boardWithoutCatalog(), boardWithoutCatalog({ hydrated: true })]) {
    assert.match(html, /<(\w+)[^>]*role="status"[^>]*>(?:(?!<\/\1>)[^])*Loading the course map/, "a status element shows the loading state");
    for (const failed of CATALOG_FAILED) assert.ok(!html.includes(failed), `"${failed}" shows while the catalog loads`);
  }
});

test("the planner says the catalog is unavailable only after the catalog request fails (#140)", () => {
  const html = boardWithoutCatalog({ hydrated: true, catalogBusy: false, catalogError: "The catalog could not be loaded." });
  for (const failed of CATALOG_FAILED) assert.ok(html.includes(failed), `"${failed}" is missing after the request fails`);
  assert.ok(html.includes("Try again"), "the failure offers a retry");
  assert.ok(!html.includes("Loading the course map"), "no loading state shows after the request fails");
});
