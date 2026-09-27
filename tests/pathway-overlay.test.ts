import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { analyzeResolvedCriticalPath } from "../lib/critical-path";
import { emptyPlan } from "../lib/plan";
import {
  PERSONA_PROMPT,
  buildPathwayOverlay,
  graphPersonaEmphasis,
  overlayKeepsEdge,
  overlayNodeCopy,
  overlayRoleFor,
} from "../lib/pathway-overlay";
import type { Catalog, Pathway } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;
const pathways = JSON.parse(readFileSync(path.join(process.cwd(), "config", "pathways.json"), "utf8")) as Pathway[];
const catalogCodes = new Set(seattle.courses.map((course) => course.code));

test("persona prompt is the product question", () => {
  assert.equal(PERSONA_PROMPT, "What are you trying to become?");
});

test("NEU MSCS Seattle ships at least three curated personas", () => {
  assert.ok(pathways.length >= 3);
  for (const persona of pathways) {
    assert.ok(persona.id);
    assert.ok(persona.name);
    assert.ok(persona.groups.length > 0);
    const codes = persona.groups.flatMap((group) => group.courses);
    assert.ok(codes.length > 0, `${persona.name} needs a curated course set`);
    for (const code of codes) {
      assert.ok(catalogCodes.has(code), `${persona.name} lists ${code}, missing from the Seattle catalog`);
    }
  }
});

test("Machine Learning overlay keeps CORE, RECOMMENDED, and CS 5800 as critical ★", () => {
  const persona = pathways.find((item) => item.id === "machine-learning");
  assert.ok(persona);
  const analysis = analyzeResolvedCriticalPath(null, persona.id, pathways, seattle.courses, emptyPlan());
  const overlay = buildPathwayOverlay({
    persona,
    coreCourses: seattle.requirements.coreCourses,
    bottleneck: analysis.bottleneck,
  });
  assert.ok(overlay);
  assert.ok(overlay.core.has("CS 5800"));
  assert.ok(overlay.core.has("CS 5010"));
  assert.ok(overlay.recommended.has("CS 6140"));
  assert.ok(overlay.critical.has("CS 5800"));
  assert.equal(overlayRoleFor("CS 5800", overlay), "critical");
  assert.deepEqual(overlayNodeCopy("CS 5800", overlay), { role: "critical", label: "CRITICAL ★", starred: true });
  assert.equal(overlayRoleFor("CS 5010", overlay), overlay.critical.has("CS 5010") ? "critical" : "core");
  assert.equal(overlayRoleFor("CS 6140", overlay), overlay.critical.has("CS 6140") ? "critical" : "recommended");
  assert.equal(overlayRoleFor("CS 5600", overlay), null);
  assert.equal(graphPersonaEmphasis({ code: "CS 5800", overlayKeep: overlay.keep, neighborhood: new Set() }), true);
  assert.equal(graphPersonaEmphasis({ code: "CS 5600", overlayKeep: overlay.keep, neighborhood: new Set(["CS 5600"]) }), false);
  assert.equal(overlayKeepsEdge("CS 5800", "CS 6140", overlay.keep), overlay.keep.has("CS 6140"));
  assert.equal(overlayKeepsEdge("CS 5600", "CS 5700", overlay.keep), false);
});

test("overlay fades neighborhood-only courses unless line focus or bottleneck wins", () => {
  const keep = new Set(["CS 5800"]);
  const neighborhood = new Set(["CS 5010", "CS 5800"]);
  assert.equal(graphPersonaEmphasis({ code: "CS 5010", overlayKeep: keep, neighborhood }), false);
  assert.equal(graphPersonaEmphasis({ code: "CS 5010", bottleneck: new Set(["CS 5010"]), overlayKeep: keep, neighborhood }), true);
  assert.equal(graphPersonaEmphasis({
    code: "CS 5010",
    lineCodes: new Set(["CS 5010"]),
    bottleneck: new Set(),
    overlayKeep: keep,
    neighborhood,
  }), true);
  assert.equal(graphPersonaEmphasis({ code: "CS 5010", neighborhood }), true);
});

test("no persona means no overlay, so Explore neighborhood dimming stays intact", () => {
  assert.equal(buildPathwayOverlay({ persona: null, coreCourses: ["CS 5800"] }), null);
  assert.equal(overlayRoleFor("CS 5800", null), null);
  assert.equal(overlayNodeCopy("CS 5800", null).starred, false);
});
