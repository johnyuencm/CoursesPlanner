import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildGraphProjection } from "../lib/graph-projection";
import { PROGRAM_URL, buildCourseGraph, parseCourses, parseProgramRequirements } from "../scraper/parser";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");

function seattleGraph() {
  const requirements = parseProgramRequirements(fixture("mscs-sea-program.html"), PROGRAM_URL, "2026-09-11T00:00:00.000Z");
  const courses = buildCourseGraph(parseCourses(fixture("cs.html"), "https://catalog.northeastern.edu/course-descriptions/cs/"), requirements);
  return { courses, requirements };
}

test("program projection keeps official isolates and stable positions while selection changes drawn arrows", () => {
  const { courses, requirements } = seattleGraph();
  const forFoundations = buildGraphProjection({ courses, requirements, scope: "program", focusCode: "CS 5010", selectedCode: "CS 5500" });
  const forAlgorithms = buildGraphProjection({ courses, requirements, scope: "program", focusCode: "CS 5010", selectedCode: "CS 5800" });

  assert.equal(forFoundations.visible.has("CS 5800"), true);
  assert.equal(forFoundations.visible.has("CS 5100"), true);
  assert.equal(forFoundations.visible.has("CS 5004"), true);
  assert.equal(courses.find((course) => course.code === "CS 5004")?.requirementType, "external");
  assert.ok(forFoundations.nodes.some((node) => node.code === "CS 5004"), "external prerequisites retain a projection node without metadata");
  assert.deepEqual(forFoundations.nodes, forAlgorithms.nodes);
  assert.ok(forFoundations.relations.some((relation) => relation.source === "CS 5004" && relation.target === "CS 5500"));
  assert.ok(forFoundations.relations.some((relation) => relation.source === "CS 5011" && relation.target === "CS 5010" && relation.corequisite));
  assert.ok(forFoundations.relations.every((relation) =>
    ["CS 5004", "CS 5010", "CS 5011", "CS 5500", "CS 6510"].includes(relation.source) &&
    ["CS 5004", "CS 5010", "CS 5011", "CS 5500", "CS 6510"].includes(relation.target),
  ));
  assert.ok(forAlgorithms.relations.length > 0);
  assert.ok(forAlgorithms.relations.every((relation) =>
    forAlgorithms.upstream.has(relation.source) || relation.source === "CS 5800" || forAlgorithms.downstream.has(relation.source),
  ));
});

test("neighborhood projection keeps local relations and positions prerequisites before the focus", () => {
  const { courses, requirements } = seattleGraph();
  const projection = buildGraphProjection({ courses, requirements, scope: "1", focusCode: "CS 5500", selectedCode: "CS 5500" });
  const byCode = new Map(projection.nodes.map((node) => [node.code, node.position]));

  assert.deepEqual([...projection.visible.keys()].sort(), ["CS 5004", "CS 5010", "CS 5500", "CS 6510"]);
  assert.deepEqual(projection.relations, [
    { source: "CS 5004", target: "CS 5500", corequisite: false },
    { source: "CS 5010", target: "CS 5500", corequisite: false },
    { source: "CS 5004", target: "CS 6510", corequisite: false },
    { source: "CS 5010", target: "CS 6510", corequisite: false },
    { source: "CS 5500", target: "CS 6510", corequisite: false },
  ]);
  assert.ok(byCode.get("CS 5004")!.x < byCode.get("CS 5500")!.x);
  assert.ok(byCode.get("CS 5500")!.x < byCode.get("CS 6510")!.x);
});

test("two-step and full projections retain the focused connected graph with stable coordinates across selection", () => {
  const { courses, requirements } = seattleGraph();
  const immediate = buildGraphProjection({ courses, requirements, scope: "1", focusCode: "CS 5500", selectedCode: "CS 5500" });
  const twoSteps = buildGraphProjection({ courses, requirements, scope: "2", focusCode: "CS 5500", selectedCode: "CS 5500" });
  const twoStepsForNextCourse = buildGraphProjection({ courses, requirements, scope: "2", focusCode: "CS 5500", selectedCode: "CS 6510" });
  const full = buildGraphProjection({ courses, requirements, scope: "full", focusCode: "CS 5500", selectedCode: "CS 5500" });

  assert.ok([...immediate.visible.keys()].every((code) => twoSteps.visible.has(code)));
  assert.ok([...twoSteps.visible.keys()].every((code) => full.visible.has(code)));
  assert.ok(full.visible.size >= twoSteps.visible.size);
  assert.deepEqual(twoSteps.nodes, twoStepsForNextCourse.nodes, "selection changes arrows, not neighborhood coordinates");
});
