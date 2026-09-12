import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  catalogRelations,
  neighborhoodDistances,
  programFlowPositions,
  programGridDimensions,
  programMapCodes,
  visibleGraphDistances,
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
  const spots = [...positions.values()].map((point) => `${point.x},${point.y}`);
  assert.equal(new Set(spots).size, spots.length, "no two courses may share a cell");
});
