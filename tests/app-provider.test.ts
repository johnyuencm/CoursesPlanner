import { strict as assert } from "node:assert";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";

import { useAppContextValue } from "../components/app-provider";

test("the shared AppContext value keeps its identity across a render that changes nothing (CR8)", () => {
  const values: ReturnType<typeof useAppContextValue>[] = [];
  function Probe() {
    const value = useAppContextValue();
    // A render-phase update of unrelated local state re-renders this component
    // with the same hook state, like a parent re-render with no provider change.
    const [renders, setRenders] = useState(0);
    if (renders < 1) setRenders(renders + 1);
    values.push(value);
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  assert.equal(values.length, 2);
  const [first, second] = values;
  for (const handler of ["resetPlan", "setCourseStatus", "addCourse", "addCourses", "addPrerequisiteChain", "addTargetChain"] as const) {
    assert.equal(first[handler], second[handler], `${handler} identity changed`);
  }
  assert.equal(first, second, "context value identity changed");
});

test("a catalog load stays busy, not failed, until its request fails; then it stops with the error (#140)", async (t) => {
  // The provider loads the catalog in an effect, so React's client renderer runs it. fetch is the system boundary.
  let failRequest: (error: Error) => void = () => {};
  const events = { addEventListener() {}, removeEventListener() {} };
  const globals = globalThis as Record<string, unknown>;
  const saved = { window: globals.window, fetch: globals.fetch, IS_REACT_ACT_ENVIRONMENT: globals.IS_REACT_ACT_ENVIRONMENT };
  Object.assign(globals, { window: events, IS_REACT_ACT_ENVIRONMENT: true, fetch: () => new Promise((_, reject) => { failRequest = reject; }) });
  t.after(() => Object.assign(globals, saved));
  // shortcut: a stub DOM root, enough for a root that renders null; use a DOM library when a test needs real nodes.
  const container = { nodeType: 1, tagName: "DIV", ...events, ownerDocument: { ...events, defaultView: { HTMLIFrameElement: class {} } } };
  let app: ReturnType<typeof useAppContextValue> | undefined;
  function Probe() {
    app = useAppContextValue("test/no-cached-catalog"); // The tab cache keeps a loaded catalog per key; this key never loads.
    return null;
  }
  const load = () => ({ busy: app?.catalogBusy, error: app?.catalogError, catalog: app?.catalog });
  const root = createRoot(container as unknown as Element);

  await act(async () => root.render(createElement(Probe)));
  assert.deepEqual(load(), { busy: true, error: null, catalog: null }, "while the request is open, the load is busy and has no error");
  await act(async () => failRequest(new TypeError("Failed to fetch")));
  assert.deepEqual(load(), { busy: false, error: "Failed to fetch", catalog: null }, "after the request fails, the load is not busy and has the error");
  await act(async () => root.unmount());
});
