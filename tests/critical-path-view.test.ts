import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CriticalPathView } from "../components/target-path";
import { analyzeCriticalPath, analyzeResolvedCriticalPath } from "../lib/critical-path";
import { emptyPlan } from "../lib/plan";
import type { Catalog, Pathway } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;
const pathways = JSON.parse(readFileSync(path.join(process.cwd(), "config", "pathways.json"), "utf8")) as Pathway[];

test("critical path view shows bottleneck chain and delay-impact copy for CS 6510", () => {
  const analysis = analyzeCriticalPath(["CS 6510"], seattle.courses, emptyPlan());
  const markup = renderToStaticMarkup(
    createElement(CriticalPathView, { analysis, onSelectCode: () => {} }),
  );
  assert.match(markup, /Bottleneck to CS 6510/);
  assert.match(markup, /CS 5010/);
  assert.match(markup, /CS 5500/);
  assert.match(markup, /delaying CS 5010 moves earliest CS 6510 from Fall 2027 → Spring 2028/);
});

test("critical path view for General Software Engineer uses the multi-course CS 6510 bottleneck", () => {
  const analysis = analyzeResolvedCriticalPath(null, "general-software-engineer", pathways, seattle.courses, emptyPlan());
  const markup = renderToStaticMarkup(
    createElement(CriticalPathView, { analysis, onSelectCode: () => {} }),
  );
  assert.match(markup, /Bottleneck to CS 6510/);
  assert.match(markup, /delaying CS 5010 moves earliest CS 6510 from Fall 2027 → Spring 2028/);
});

test("critical path view asks for a target when none is set", () => {
  const analysis = analyzeResolvedCriticalPath(null, null, pathways, seattle.courses, emptyPlan());
  const markup = renderToStaticMarkup(
    createElement(CriticalPathView, { analysis, onSelectCode: () => {} }),
  );
  assert.match(markup, /Choose a target course or career direction/);
});
