import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { PrerequisiteChainView } from "../components/target-path";
import { emptyPlan, previewChainInsert } from "../lib/plan";
import type { Catalog } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;

test("blocked-course chain view explains why, remaining chain, earliest term, and add action", () => {
  const preview = previewChainInsert("CS 6510", seattle.courses, emptyPlan(), seattle);
  const markup = renderToStaticMarkup(
    createElement(PrerequisiteChainView, {
      preview,
      kicker: "Blocked",
      onSelectCode: () => {},
      onApply: () => {},
      applyEnabled: true,
    }),
  );
  assert.match(markup, /Why can(?:'|\&apos;|\&\#x27;)t I take this\?/);
  assert.match(markup, /CS 5010/);
  assert.match(markup, /CS 5500/);
  assert.match(markup, /Earliest term for CS 6510/);
  assert.match(markup, /Fall 2027/);
  assert.match(markup, /Add prerequisite chain to plan/);
});

test("chain view surfaces overload warnings before the apply control", () => {
  const loaded = {
    ...emptyPlan(),
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "fall-2026"
        ? { ...semester, courses: [{ code: "CS 5800", credits: 4 }, { code: "CS 6140", credits: 4 }] }
        : semester,
    ),
  };
  const preview = previewChainInsert("CS 5500", seattle.courses, loaded, seattle);
  const markup = renderToStaticMarkup(
    createElement(PrerequisiteChainView, {
      preview,
      kicker: "Blocked",
      onSelectCode: () => {},
      onApply: () => {},
      applyEnabled: true,
    }),
  );
  const overloadAt = markup.indexOf("overload");
  const applyAt = markup.indexOf("Add prerequisite chain to plan");
  assert.ok(overloadAt >= 0);
  assert.ok(applyAt > overloadAt);
  assert.match(markup, /typical load is 8/);
});

test("unscheduled chain view shows the conflict and hides apply", () => {
  const withTarget = {
    ...emptyPlan(),
    semesters: emptyPlan().semesters.map((semester) =>
      semester.id === "spring-2027" ? { ...semester, courses: [{ code: "CS 6510", credits: 4 }] } : semester,
    ),
  };
  const preview = previewChainInsert("CS 6510", seattle.courses, withTarget, seattle);
  const markup = renderToStaticMarkup(
    createElement(PrerequisiteChainView, {
      preview,
      kicker: "Blocked",
      onSelectCode: () => {},
      onApply: () => {},
      applyEnabled: true,
    }),
  );
  assert.match(markup, /cannot fit before Spring 2027/);
  assert.doesNotMatch(markup, /Add prerequisite chain to plan/);
});
