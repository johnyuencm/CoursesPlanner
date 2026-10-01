import { strict as assert } from "node:assert";
import { createElement, useState } from "react";
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
