// The Paths page text of an Audit-tier and a Map-tier program (#138). The planner has the same check (#126).
import { strict as assert } from "node:assert";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import PathwaysPage, { generateMetadata } from "../app/[universityId]/[programId]/pathways/page";
import { AppContext, useAppContextValue } from "../components/app-provider";
import { DEFAULT_CATALOG_KEY } from "../lib/catalog-key";
import { readProgramCatalog } from "../lib/program-catalog";
import { validatePlan } from "../lib/requirements-v2";
import { MAP_KEY, pageText } from "./page-text";

/** The Paths page of `key` after its catalog has loaded, as plain text, and the page description. */
async function pathsText(key: string): Promise<string> {
  const [universityId = "", programId = ""] = key.split("/");
  const params = () => Promise.resolve({ universityId, programId });
  const catalog = await readProgramCatalog(key);
  const page = await PathwaysPage({ params: params() });
  // The provider loads the catalog in an effect, which a server render never runs. So the test hands it the catalog.
  function LoadedPaths() {
    const app = useAppContextValue(key);
    return createElement(AppContext.Provider, { value: { ...app, catalog, progress: validatePlan(app.plan, catalog) } }, page);
  }
  const { description } = await generateMetadata({ params: params() });
  return pageText(renderToStaticMarkup(createElement(LoadedPaths)), description);
}

test("the Audit-tier Paths page (MSCS Seattle) keeps its degree audit text (#138)", async () => {
  const text = await pathsText(DEFAULT_CATALOG_KEY);
  for (const kept of [
    "Recommendations never change your official core, breadth, elective, or credit audit. Confirm course fit and availability with your advisor.",
    "These recommendations do not change degree rules. Graduation status still comes only from the modeled catalog audit.",
    "Use these ideas as a starting point. Degree validation stays grounded in official catalog rules.",
  ]) assert.ok(text.includes(kept), `"${kept}" is missing`);
});

test("the Map-tier Paths page never says it gives a degree audit (#138)", async () => {
  const text = await pathsText(MAP_KEY);
  // "audit" stays only where the text says that there is none, or names the official university audit.
  assert.doesNotMatch(text.replace(/no degree audit|official university audit/gi, ""), /audit/i);
  // The same claim in other words: a Map-tier program has no degree validation either.
  assert.doesNotMatch(text, /degree validation/i);
  for (const shown of [
    "Recommendations never change your official degree requirements. Confirm course fit and availability with your advisor.",
    "These recommendations do not change degree rules. The planner gives no degree audit for this program, so graduation status comes only from your official university audit.",
    "Use these ideas as a starting point. Check degree rules in the official catalog.",
  ]) assert.ok(text.includes(shown), `"${shown}" is missing`);
});
