// When the board lands, a keyboard user keeps focus on the backup button (#147). React's client renderer runs the real provider and the planner board.
import { strict as assert } from "node:assert";
import test from "node:test";
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { AppProvider, useApp } from "../components/app-provider";
import PlannerBoard from "../components/planner-board";
import { readProgramCatalog } from "../lib/program-catalog";
import { createFakeDom, type FakeElement } from "./fake-dom";

test("focus on Download backup stays on Download backup when the board lands, also in the first painted frame (#147)", async (t) => {
  const catalog = await readProgramCatalog("northeastern/computer-science-mscs-976b977119");
  const { document, window } = createFakeDom();
  // fetch is the system boundary. The catalog request stays open until the test answers it.
  let answer: () => void = () => {};
  const response = { ok: true, headers: { get: () => null }, json: async () => catalog };
  const globals = globalThis as Record<string, unknown>;
  const saved = { window: globals.window, self: globals.self, document: globals.document, fetch: globals.fetch, IS_REACT_ACT_ENVIRONMENT: globals.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globals, { window, self: window, document, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => new Promise((resolve) => { answer = () => resolve(response); }) });
  t.after(() => Object.assign(globals, saved));

  // React runs layout effects in the commit, before the browser can paint. This probe comes after the board, so it sees the focus of the first painted frame.
  const painted: FakeElement[] = [];
  function FirstPaint() {
    const { catalog } = useApp();
    useLayoutEffect(() => { if (catalog) painted.push(document.activeElement); }, [catalog]);
    return null;
  }

  const root = createRoot(document.body.appendChild(document.createElement("div")) as unknown as Element);
  // The board calls useRouter(), which needs a mounted app router. Nothing here navigates.
  const page = createElement(AppProvider, { catalogKey: "test/load-focus", children: createElement("main", null, createElement(PlannerBoard), createElement(FirstPaint)) });
  await act(async () => root.render(createElement(AppRouterContext.Provider, { value: {} as never }, page)));

  const download = () => [...document.elements()].find((element) => element.nodeName === "BUTTON" && element.textContent.includes("Download backup"));
  const whileLoading = download();
  assert.ok(document.body.textContent.includes("Loading the course map"), "the catalog loads");
  assert.ok(whileLoading, "the backup panel offers Download backup while the catalog loads");
  whileLoading.focus(); // A keyboard user tabs to Download backup while the catalog loads.
  assert.ok(document.activeElement === whileLoading, "Download backup takes focus while the catalog loads");

  await act(async () => answer());
  assert.ok([...document.elements()].some((element) => element.getAttribute("class") === "semester-board"), "the board lands");
  // Compare nodes with ===: a failed assert prints its values, and a node holds the whole tree.
  const afterLoad = download();
  assert.ok(afterLoad && document.activeElement === afterLoad, `focus stays on Download backup, not on ${document.activeElement.nodeName}`);
  assert.ok(painted[0] === afterLoad, `focus is on Download backup when the board first paints, not on ${painted[0]?.nodeName}`);
  await act(async () => root.unmount());
});
