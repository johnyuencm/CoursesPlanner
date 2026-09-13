import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  catalogRelations,
  classifyUnlinkedProgramCodes,
  findCourses,
  neighborhoodDistances,
  programFlowPositions,
  programGridDimensions,
  programMapCodes,
  selectedChainRelations,
  shouldAutoLocateFind,
  visibleGraphDistances,
  wrapFindIndex,
} from "../lib/graph";
import { PROGRAM_URL, buildCourseGraph, parseCourses, parseProgramRequirements } from "../scraper/parser";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");

function seattleGraph() {
  const requirements = parseProgramRequirements(
    fixture("mscs-sea-program.html"),
    PROGRAM_URL,
    "2026-09-11T00:00:00.000Z",
  );
  const courses = buildCourseGraph(
    parseCourses(fixture("cs.html"), "https://catalog.northeastern.edu/course-descriptions/cs/"),
    requirements,
  );
  return { courses, requirements };
}

test("entire-program map includes isolated official MSCS Seattle courses and their direct prerequisites", () => {
  const { courses, requirements } = seattleGraph();
  const visible = programMapCodes(courses, requirements);

  assert.equal(visible.has("CS 5010"), true);
  assert.equal(visible.has("CS 5011"), true);
  assert.equal(visible.has("CS 5800"), true);
  assert.equal(visible.has("CS 5100"), true);
  assert.equal(visible.has("CS 5500"), true);
  assert.equal(visible.has("CS 5004"), true);
  assert.equal(visible.has("CS 1800"), false);
  assert.ok(visible.size >= requirements.coreCourses.length + 20);
});

test("immediate neighborhood of CS 5500 stays local while entire-program scope keeps isolated cores", () => {
  const { courses, requirements } = seattleGraph();
  const relations = catalogRelations(courses);
  const neighborhood = neighborhoodDistances("CS 5500", relations, 1);
  const program = visibleGraphDistances("program", "CS 5500", courses, requirements, relations);

  assert.deepEqual([...neighborhood.keys()].sort(), ["CS 5004", "CS 5010", "CS 5500", "CS 6510"]);
  assert.equal(program.has("CS 5800"), true);
  assert.equal(program.has("CS 5100"), true);
  assert.equal(neighborhood.has("CS 5800"), false);
});

test("program grid prefers a canvas-filling packing over a short wide strip", () => {
  const packed = programGridDimensions(114, 164, 64);
  assert.ok(packed.rows >= 8, `expected a tall packing, got ${packed.rows} rows`);
  assert.ok(packed.columns <= 12, `expected fewer columns than the 6-row strip, got ${packed.columns}`);
  assert.equal(packed.columns * packed.rows >= 114, true);
});

test("program flow puts prerequisites to the left of the courses they unlock", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const positions = programFlowPositions(codes, catalogRelations(courses));
  const x = (code: string) => positions.get(code)!.x;
  const y = (code: string) => positions.get(code)!.y;

  assert.equal(positions.size, codes.size);
  assert.ok(x("CS 5004") < x("CS 5500"), "CS 5004 should sit left of CS 5500");
  assert.ok(x("CS 5010") < x("CS 5500"), "CS 5010 should sit left of CS 5500");
  assert.ok(x("CS 5500") < x("CS 6510"), "CS 5500 should sit left of CS 6510");
  assert.equal(positions.has("CS 5800"), true);
  assert.equal(positions.has("CS 5100"), true);
  assert.ok(y("CS 5150") > y("CS 5500"), "courses with no arrows pack below the connected flow");
  if (positions.has("PHYS 5116") && positions.has("CS 7332")) {
    assert.ok(x("PHYS 5116") < x("CS 7332"));
    assert.equal(y("PHYS 5116"), y("CS 7332"), "PHYS 5116 should sit on the same row as CS 7332");
  }
  const spots = [...positions.values()].map((point) => `${point.x},${point.y}`);
  assert.equal(new Set(spots).size, spots.length, "no two courses may share a cell");
});

test("a sole prerequisite sits on the same row immediately left of the course that names it", () => {
  const positions = programFlowPositions(
    ["PHYS 5116", "CS 7332", "CS 5150"],
    [{ source: "PHYS 5116", target: "CS 7332", corequisite: false }],
  );
  assert.ok(positions.get("PHYS 5116")!.x < positions.get("CS 7332")!.x);
  assert.equal(positions.get("PHYS 5116")!.y, positions.get("CS 7332")!.y);
  assert.ok(positions.get("CS 5150")!.y > positions.get("CS 7332")!.y);
});

test("selected-chain arrows omit relationships that do not touch the selected course", () => {
  const relations = [
    { source: "CS 5004", target: "CS 5500", corequisite: false },
    { source: "PHYS 5116", target: "CS 7332", corequisite: false },
  ];
  const shown = selectedChainRelations(relations, ["PHYS 5116", "CS 7332"]);
  assert.deepEqual(shown, [{ source: "PHYS 5116", target: "CS 7332", corequisite: false }]);
});

test("unlinked codes with no parsed prerequisite sit in the no-prereq band, not the connected roots", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const classified = classifyUnlinkedProgramCodes(codes, catalogRelations(courses), courses);

  assert.equal(classified.noPrerequisite.includes("CS 5150"), true);
  assert.equal(classified.noPrerequisite.includes("CS 5010"), false);
  assert.equal(classified.unlinked.includes("CS 5010"), false);
  assert.equal(classified.noPrerequisite.includes("PHYS 5116"), false);
});

test("findCourses matches compacted codes and titles and prefers courses on the map", () => {
  const courses = [
    { code: "CS 1800", title: "Discrete Structures" },
    { code: "CS 5500", title: "Foundations of Software Engineering" },
    { code: "CS 5800", title: "Algorithms" },
    { code: "PHYS 5116", title: "Electromagnetic Materials" },
  ];

  assert.deepEqual(findCourses(courses, "  "), []);
  assert.equal(findCourses(courses, "cs5500")[0]?.code, "CS 5500");
  assert.equal(findCourses(courses, "PHYS 5116")[0]?.code, "PHYS 5116");
  assert.equal(findCourses(courses, "discrete")[0]?.code, "CS 1800");
  assert.equal(findCourses(courses, "800", ["CS 5800"])[0]?.code, "CS 5800");
  assert.ok(findCourses(courses, "cs").length > 2);
});

test("findCourses on the MSCS snapshot locates CS 5500 and PHYS 5116", () => {
  const { courses, requirements } = seattleGraph();
  const onMap = programMapCodes(courses, requirements);
  assert.equal(findCourses(courses, "cs5500", onMap)[0]?.code, "CS 5500");
  assert.equal(findCourses(courses, "5500", onMap)[0]?.code, "CS 5500");
  assert.equal(findCourses(courses, "PHYS 5116", onMap)[0]?.code, "PHYS 5116");
});

test("wrapFindIndex and auto-locate match Ctrl+F next/previous behavior", () => {
  assert.equal(wrapFindIndex(-1, 5, 1), 0);
  assert.equal(wrapFindIndex(-1, 5, -1), 4);
  assert.equal(wrapFindIndex(0, 5, 1), 1);
  assert.equal(wrapFindIndex(4, 5, 1), 0);
  assert.equal(wrapFindIndex(0, 5, -1), 4);
  assert.equal(wrapFindIndex(0, 0, 1), -1);
  assert.equal(shouldAutoLocateFind("c", 12), false);
  assert.equal(shouldAutoLocateFind("cs55", 4), true);
  assert.equal(shouldAutoLocateFind("xy", 1), true);
  assert.equal(shouldAutoLocateFind("cs55", 0), false);
});
