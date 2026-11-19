// The planner text of an Audit-tier and a Map-tier program (#126).
import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import PlannerPage, { generateMetadata } from "../app/[universityId]/[programId]/planner/page";
import { AppContext, useAppContextValue } from "../components/app-provider";
import { CourseDetail, CoursePicker } from "../components/course-dialogs";
import { DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { readProgramCatalog } from "../lib/program-catalog";
import { validatePlan } from "../lib/requirements-v2";

/** MSCS Boston: a roadmap with no modeled degree rules, so Map tier. */
const MAP_KEY = "northeastern/computer-science-mscs-976b977119";

/**
 * The planner page of `key` after its catalog has loaded, as plain text, and the page description.
 * Each surface below shows the corequisite note of a course with an empty plan:
 * the Add course dialog on CS 5004 (prerequisites not met), the course detail dialog on CS 2000,
 * and the target path card on CS 2500 (prerequisites not verified).
 */
async function plannerText(key: string): Promise<string> {
  const [universityId = "", programId = ""] = key.split("/");
  const params = () => Promise.resolve({ universityId, programId });
  const catalog = await readProgramCatalog(key);
  const page = await PlannerPage({ params: params() });
  function LoadedPlanner() {
    const app = useAppContextValue(key);
    const value = { ...app, catalog, progress: validatePlan(app.plan, catalog), picker: { courseCode: "CS 5004" }, courseTargetCode: "CS 2500" };
    return createElement(AppContext.Provider, { value }, page, createElement(CoursePicker), createElement(CourseDetail, { code: "CS 2000" }));
  }
  // The board calls useRouter(), which needs a mounted app router. Nothing here navigates.
  const html = renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {} as never }, createElement(LoadedPlanner)));
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
    "Review plan checks",
    "What the plan checks cannot verify",
    "You can still add this course and resolve the plan check warnings.",
    "The planner checks prerequisites and term order, and saves the plan only in your browser.",
    // One corequisite note per surface, so the "audit" check above sees them (#126 review H1).
    "Corequisite checked separately: CS 5005.",
    "Corequisite checked separately: CS 2001.",
    "Corequisite checked separately: unverified requirement: Course details for CS 2500",
  ]) assert.ok(text.includes(shown), `"${shown}" is missing`);
});
