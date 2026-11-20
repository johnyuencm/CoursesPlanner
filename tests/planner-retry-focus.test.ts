// After Try again, keyboard focus has a sensible place to go (#145). React's client renderer runs the real provider and the planner board.
import { strict as assert } from "node:assert";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";

import { AppProvider } from "../components/app-provider";
import PlannerBoard from "../components/planner-board";
import { createFakeDom } from "./fake-dom";

test("after Try again, focus moves to the planner heading and stays there while the catalog loads and fails again (#145)", async (t) => {
  const { document, window } = createFakeDom();
  // fetch is the system boundary. Each catalog request stays open until the test fails it.
  let failRequest: (error: Error) => void = () => {};
  const globals = globalThis as Record<string, unknown>;
  const saved = { window: globals.window, document: globals.document, fetch: globals.fetch, IS_REACT_ACT_ENVIRONMENT: globals.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globals, { window, document, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => new Promise((_, reject) => { failRequest = reject; }) });
  t.after(() => Object.assign(globals, saved));
  const failure = new TypeError("Failed to fetch");
  const logged: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => { logged.push(args); });

  const root = createRoot(document.body.appendChild(document.createElement("div")) as unknown as Element);
  // The board calls useRouter(), which needs a mounted app router. Nothing here navigates.
  const page = createElement(AppProvider, { catalogKey: "test/retry-focus", children: createElement("main", null, createElement(PlannerBoard)) });
  await act(async () => root.render(createElement(AppRouterContext.Provider, { value: {} as never }, page)));
  await act(async () => failRequest(failure));

  const heading = document.querySelector("main h1");
  const retry = [...document.elements()].find((element) => element.nodeName === "BUTTON" && element.textContent.includes("Try again"));
  assert.equal(heading?.textContent, "Build your plan");
  assert.ok(retry, "the failure card offers Try again");
  retry.focus(); // A keyboard user presses Try again.
  await act(async () => retry.click());
  assert.ok(document.body.textContent.includes("Loading the course map"), "the catalog loads again");
  // Compare nodes with ===: a failed assert prints its values, and a node holds the whole tree.
  assert.ok(document.activeElement === heading, `focus moves to the page heading, not to ${document.activeElement.nodeName}`);

  await act(async () => failRequest(failure));
  assert.ok(document.body.textContent.includes("The course catalog did not load"), "the retry fails");
  assert.ok(document.activeElement === heading, `focus stays on the page heading after the retry fails, not on ${document.activeElement.nodeName}`);
  assert.deepEqual(logged.filter((args) => !args.includes(failure)).map((args) => args.map(String).join(" ")), [], "nothing else is logged as an error");
  await act(async () => root.unmount());
});
