import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  consumeGraphFitRequest,
  catalogRelations,
  centeredGraphZoomScroll,
  clampGraphZoom,
  compactGraphStatusLabel,
  directedCourseChain,
  graphCourseZIndex,
  graphFitZoom,
  graphZoomPercent,
  GRAPH_SELECTED_EDGE_Z,
  shouldClearLineFocusOnEscape,
  layoutProgramFlow,
  mapFind,
  mapScene,
  PROGRAM_ROW,
  programMapCodes,
  prerequisiteBusMeta,
  prerequisiteConnector,
  prerequisiteHitPaths,
  relationshipControlGroups,
  relationshipSelection,
  GRAPH_HIT_TARGET_WIDTH,
  selectedGraphScroll,
  stableDestinationColor,
  unlockArrowView,
  visibleGraphDistances,
} from "../lib/graph";
import { PROGRAM_URL, buildCourseGraph, parseCourses, parseProgramRequirements } from "../scraper/parser";

const fixture = (name: string) => readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");

test("prerequisite trace follows every ancestor, excludes descendants and corequisites, and terminates on cycles", () => {
  const { courses, requirements } = seattleGraph();
  const relations = [
    { source: "A", target: "B", corequisite: false },
    { source: "B", target: "C", corequisite: false },
    { source: "C", target: "D", corequisite: false },
    { source: "B", target: "A", corequisite: false },
    { source: "X", target: "C", corequisite: true },
  ];
  const visible = visibleGraphDistances("prerequisites", "C", courses, requirements, relations);
  assert.deepEqual([...visible.keys()].sort(), ["A", "B", "C"]);
});

test("a directed course chain keeps ancestors and unlocks but excludes sibling prerequisites of downstream courses", () => {
  const relations = [
    { source: "A", target: "B", corequisite: false },
    { source: "B", target: "C", corequisite: false },
    { source: "SIBLING", target: "C", corequisite: false },
    { source: "C", target: "D", corequisite: false },
  ];
  assert.deepEqual([...directedCourseChain(relations, "B")].sort(), ["A", "B", "C", "D"]);
});

test("relationship selection distinguishes an exact branch from an incoming bus", () => {
  const relations = [
    { source: "A", target: "C", corequisite: false },
    { source: "B", target: "C", corequisite: false },
    { source: "C", target: "D", corequisite: false },
  ];
  assert.deepEqual(relationshipSelection.branch("A", "C"), { kind: "branch", source: "A", target: "C", codes: new Set(["A", "C"]) });
  assert.deepEqual(relationshipSelection.bus(relations, "C"), { kind: "bus", target: "C", sources: ["A", "B"], codes: new Set(["A", "B", "C"]) });
  const branch = relationshipSelection.branch("A", "C");
  const bus = relationshipSelection.bus(relations, "C");
  assert.equal(relationshipSelection.isSelected(branch, "A", "C"), true);
  assert.equal(relationshipSelection.isSelected(branch, "B", "C"), false);
  assert.equal(relationshipSelection.isSelected(bus, "A", "C"), true);
  assert.equal(relationshipSelection.isSelected(bus, "C", "D"), false);
  assert.equal(relationshipSelection.isSelected(null, "A", "C"), false);
});

test("relationship control groups expose deterministic bus controls before exact branches", () => {
  const relations = [
    { source: "B", target: "C", corequisite: false },
    { source: "A", target: "C", corequisite: false },
    { source: "D", target: "E", corequisite: false },
    { source: "X", target: "E", corequisite: true },
  ];

  assert.deepEqual(relationshipControlGroups(relations), [
    {
      target: "C",
      sources: ["A", "B"],
      branches: [
        { source: "A", target: "C", corequisite: false },
        { source: "B", target: "C", corequisite: false },
      ],
    },
    {
      target: "E",
      sources: ["D"],
      branches: [{ source: "D", target: "E", corequisite: false }],
    },
  ]);
});

test("relationship helpers accept unlock arrows that omit corequisite", () => {
  const arrows = [
    { source: "B", target: "C" },
    { source: "A", target: "C" },
  ];
  assert.deepEqual(relationshipSelection.bus(arrows, "C"), {
    kind: "bus",
    target: "C",
    sources: ["A", "B"],
    codes: new Set(["A", "B", "C"]),
  });
  assert.deepEqual(relationshipControlGroups(arrows)[0]?.sources, ["A", "B"]);
});

test("prerequisite bus owner is the lexicographically least source", () => {
  const positions = new Map([
    ["CS 10", { x: 0, y: 0 }],
    ["CS 2", { x: 0, y: 160 }],
    ["CS 99", { x: 600, y: 80 }],
  ]);
  const meta = prerequisiteBusMeta(
    [
      { source: "CS 10", target: "CS 99" },
      { source: "CS 2", target: "CS 99" },
    ],
    positions,
  );
  assert.equal(meta.get("CS 99")?.busOwner, "CS 2");
});

test("prerequisite bus bounds span short and long entry Y", () => {
  const positions = new Map([
    ["SHORT", { x: 200, y: 50 }],
    ["LONG", { x: 0, y: 200 }],
    ["T", { x: 600, y: 100 }],
  ]);
  const meta = prerequisiteBusMeta(
    [
      { source: "SHORT", target: "T" },
      { source: "LONG", target: "T" },
    ],
    positions,
  );
  // Short: (600 - (200+224)=176) <= 180 → entry Y = 50+58
  // Long: (600 - (0+224)=376) > 180 → entry Y = 200+140
  // Target handle Y = 100+58
  assert.equal(meta.get("T")?.busOwner, "LONG");
  assert.equal(meta.get("T")?.busStartY, 108);
  assert.equal(meta.get("T")?.busEndY, 340);
});

test("destination bus colors are stable and distinct across destinations", () => {
  assert.equal(stableDestinationColor("CS 5500"), stableDestinationColor("CS 5500"));
  assert.notEqual(stableDestinationColor("CS 5500"), stableDestinationColor("CS 6510"));
});

test("incoming connectors share a destination junction using only straight segments", () => {
  const first = prerequisiteConnector(224, 58, 360, 218);
  const second = prerequisiteConnector(224, 378, 360, 218);
  assert.ok(first.endsWith("H 324 V 218 H 360"));
  assert.ok(second.endsWith("H 324 V 218 H 360"));
  assert.equal(/[CQSA]/.test(first + second), false);
  assert.notEqual(first, prerequisiteConnector(224, 58, 360, 218, 46));
});

type SegmentBox = { left: number; right: number; top: number; bottom: number };

function hitBoxes(pathText: string): SegmentBox[] {
  const radius = GRAPH_HIT_TARGET_WIDTH / 2;
  const commands = [...pathText.matchAll(/([MHV]) (-?[\d.]+)(?: (-?[\d.]+))?/g)];
  let x = 0;
  let y = 0;
  const boxes: SegmentBox[] = [];
  for (const [, command, first, second] of commands) {
    const nextX = command === "V" ? x : Number(first);
    const nextY = command === "H" ? y : Number(command === "V" ? first : second);
    if (command === "H") {
      boxes.push({ left: Math.min(x, nextX), right: Math.max(x, nextX), top: y - radius, bottom: y + radius });
    } else if (command === "V") {
      boxes.push({ left: x - radius, right: x + radius, top: Math.min(y, nextY), bottom: Math.max(y, nextY) });
    }
    x = nextX;
    y = nextY;
  }
  return boxes;
}

function boxesOverlap(left: SegmentBox, right: SegmentBox): boolean {
  return left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;
}

test("branch hit regions stop outside the shared bus hit region for short and long entries", () => {
  const short = prerequisiteHitPaths(224, 58, 360, 218, 36, 58, 218);
  const long = prerequisiteHitPaths(224, 378, 360, 218, 36, 218, 460);

  for (const paths of [short, long]) {
    for (const branch of hitBoxes(paths.branch)) {
      for (const bus of hitBoxes(paths.bus)) {
        assert.equal(boxesOverlap(branch, bus), false, `${paths.branch} overlaps ${paths.bus}`);
      }
    }
  }
});

test("long connectors cross intervening columns in row gutters, never through course cards", () => {
  const { courses, requirements } = seattleGraph();
  const scene = mapScene({ courses, requirements, scope: "program", focusCode: "CS 6200", selectedCode: "CS 6200" });
  for (const edge of scene.arrows) {
    const source = scene.positions.get(edge.source)!;
    const target = scene.positions.get(edge.target)!;
    const path = prerequisiteConnector(source.x + 224, source.y + 58, target.x, target.y + 58);
    const commands = [...path.matchAll(/([MHV]) (-?[\d.]+)(?: (-?[\d.]+))?/g)];
    let x = 0;
    let y = 0;
    for (const [, command, first, second] of commands) {
      const nextX = command === "V" ? x : Number(first);
      const nextY = command === "H" ? y : Number(command === "V" ? first : second);
      if (command !== "M") {
        for (const [code, card] of scene.positions) {
          if (code === edge.source || code === edge.target) continue;
          const intersects = command === "H"
            ? y > card.y && y < card.y + 116 && Math.max(x, nextX) > card.x && Math.min(x, nextX) < card.x + 224
            : x > card.x && x < card.x + 224 && Math.max(y, nextY) > card.y && Math.min(y, nextY) < card.y + 116;
          assert.equal(intersects, false, `${edge.source} -> ${edge.target} crosses ${code}`);
        }
      }
      x = nextX;
      y = nextY;
    }
  }
});

function bandCourses(
  layout: { positions: Map<string, { x: number; y: number }>; bands: { id: string; y: number }[] },
  codes: Iterable<string>,
  id: string,
): string[] {
  const band = layout.bands.find((item) => item.id === id);
  if (!band) return [];
  const next = layout.bands.filter((item) => item.y > band.y).sort((left, right) => left.y - right.y)[0];
  const result: string[] = [];
  for (const code of codes) {
    const y = layout.positions.get(code)?.y;
    if (y === undefined || y <= band.y) continue;
    if (next && y >= next.y) continue;
    result.push(code);
  }
  return result;
}

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
  const neighborhood = visibleGraphDistances("1", "CS 5500", courses, requirements, relations);
  const program = visibleGraphDistances("program", "CS 5500", courses, requirements, relations);

  assert.deepEqual([...neighborhood.keys()].sort(), ["CS 5004", "CS 5010", "CS 5500", "CS 6510"]);
  assert.equal(program.has("CS 5800"), true);
  assert.equal(program.has("CS 5100"), true);
  assert.equal(neighborhood.has("CS 5800"), false);
});

test("program grid prefers a canvas-filling packing over a short wide strip", () => {
  const none = { type: "none" as const };
  const codes = Array.from({ length: 114 }, (_, index) => `E ${String(index).padStart(3, "0")}`);
  const courses = codes.map((code) => ({ code, requirementType: "elective" as const, prerequisites: none }));
  const layout = layoutProgramFlow(codes, [], courses, undefined, 164, 64);
  const points = codes.map((code) => layout.positions.get(code)!);
  const columns = new Set(points.map((point) => point.x)).size;
  const rows = new Set(points.map((point) => point.y)).size;
  assert.ok(rows >= 8, `expected a tall packing, got ${rows} rows`);
  assert.ok(columns <= 12, `expected fewer columns than the 6-row strip, got ${columns}`);
  assert.equal(columns * rows >= 114, true);
});

test("program flow puts prerequisites to the left of the courses they unlock", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const positions = layoutProgramFlow(codes, catalogRelations(courses), courses).positions;
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
  const none = { type: "none" as const };
  const positions = layoutProgramFlow(
    ["PHYS 5116", "CS 7332", "CS 5150"],
    [{ source: "PHYS 5116", target: "CS 7332", corequisite: false }],
    [
      { code: "PHYS 5116", requirementType: "external", prerequisites: none },
      { code: "CS 7332", requirementType: "elective", prerequisites: { type: "course", code: "PHYS 5116" } },
      { code: "CS 5150", requirementType: "elective", prerequisites: none },
    ],
  ).positions;
  assert.ok(positions.get("PHYS 5116")!.x < positions.get("CS 7332")!.x);
  assert.equal(positions.get("PHYS 5116")!.y, positions.get("CS 7332")!.y);
  assert.ok(positions.get("CS 5150")!.y > positions.get("CS 7332")!.y);
});

test("unlock arrows omit corequisites, off-map edges, and unselected chains", () => {
  const arrows = unlockArrowView(
    [
      { source: "CS 5004", target: "CS 5500", corequisite: false },
      { source: "PHYS 5116", target: "CS 7332", corequisite: false },
      { source: "CS 5011", target: "CS 5010", corequisite: true },
    ],
    ["PHYS 5116", "CS 7332"],
    ["PHYS 5116", "CS 7332", "CS 5011", "CS 5010"],
  );

  assert.deepEqual(
    arrows.map((arrow) => ({ source: arrow.source, target: arrow.target, emphasized: arrow.emphasized })),
    [{ source: "PHYS 5116", target: "CS 7332", emphasized: true }],
  );
});

test("unlock arrows keep unselected on-map prerequisites muted", () => {
  const arrows = unlockArrowView(
    [
      { source: "CS 5004", target: "CS 5500", corequisite: false },
      { source: "PHYS 5116", target: "CS 7332", corequisite: false },
      { source: "CS 5011", target: "CS 5010", corequisite: true },
    ],
    ["PHYS 5116", "CS 7332"],
  );

  assert.deepEqual(
    arrows.map((arrow) => ({ source: arrow.source, target: arrow.target, emphasized: arrow.emphasized })),
    [
      { source: "CS 5004", target: "CS 5500", emphasized: false },
      { source: "PHYS 5116", target: "CS 7332", emphasized: true },
    ],
  );
});

test("unlinked codes with no parsed prerequisite sit in the no-prereq band, not the connected roots", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const layout = layoutProgramFlow(codes, catalogRelations(courses), courses);
  const noPrerequisite = bandCourses(layout, codes, "no-prerequisite");
  const unlinked = bandCourses(layout, codes, "unlinked");

  assert.equal(noPrerequisite.includes("CS 5150"), true);
  assert.equal(noPrerequisite.includes("CS 5010"), false);
  assert.equal(unlinked.includes("CS 5010"), false);
  assert.equal(noPrerequisite.includes("PHYS 5116"), false);
});

test("a corequisite partner is linked even when it has no prerequisite of its own", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const layout = layoutProgramFlow(codes, catalogRelations(courses), courses);
  assert.equal(bandCourses(layout, codes, "no-prerequisite").includes("CS 5011"), false);
  assert.equal(bandCourses(layout, codes, "unlinked").includes("CS 5011"), false);
});

test("layout keeps CS 5011 in the skill tree beside CS 5010 instead of the no-prereq band", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const layout = layoutProgramFlow(codes, catalogRelations(courses), courses);
  const noPrereqLabel = layout.bands.find((band) => band.id === "no-prerequisite");
  const y = (code: string) => layout.positions.get(code)!.y;

  assert.ok(noPrereqLabel, "expected a No prerequisite required label");
  assert.ok(layout.positions.get("CS 5011")!.y < noPrereqLabel!.y);
  assert.equal(layout.positions.get("CS 5011")!.x, layout.positions.get("CS 5010")!.x);
  assert.equal(y("CS 5011"), y("CS 5010") + PROGRAM_ROW);
});

test("an exclusive coreq pair with no outgoing unlocks occupies consecutive rows in the same column", () => {
  const none = { type: "none" as const };
  const layout = layoutProgramFlow(
    ["COREQ A", "COREQ B"],
    [{ source: "COREQ A", target: "COREQ B", corequisite: true }],
    [
      { code: "COREQ A", requirementType: "elective", prerequisites: none },
      { code: "COREQ B", requirementType: "elective", prerequisites: none },
    ],
  );
  const a = layout.positions.get("COREQ A")!;
  const b = layout.positions.get("COREQ B")!;
  assert.equal(a.x, b.x);
  assert.equal(Math.abs(a.y - b.y), PROGRAM_ROW);
});

test("CS 5500 neighborhood lays out left to right through the skill tree", () => {
  const { courses, requirements } = seattleGraph();
  const relations = catalogRelations(courses);
  const neighborhood = visibleGraphDistances("1", "CS 5500", courses, requirements, relations);
  assert.deepEqual([...neighborhood.keys()].sort(), ["CS 5004", "CS 5010", "CS 5500", "CS 6510"]);
  const positions = layoutProgramFlow(neighborhood.keys(), relations, courses).positions;
  const x = (code: string) => positions.get(code)!.x;
  assert.ok(x("CS 5004") < x("CS 5500"), "CS 5004 should sit left of CS 5500");
  assert.ok(x("CS 5010") < x("CS 5500"), "CS 5010 should sit left of CS 5500");
  assert.ok(x("CS 5500") < x("CS 6510"), "CS 5500 should sit left of CS 6510");
});

test("corequisite partners share the earlier prerequisite rank", () => {
  const none = { type: "none" as const };
  const layout = layoutProgramFlow(
    ["A", "B", "C"],
    [
      { source: "A", target: "C", corequisite: false },
      { source: "B", target: "C", corequisite: true },
    ],
    [
      { code: "A", requirementType: "core", prerequisites: none },
      { code: "B", requirementType: "core", prerequisites: none },
      { code: "C", requirementType: "core", prerequisites: { type: "course", code: "A" } },
    ],
  );

  assert.equal(layout.positions.get("B")!.x, layout.positions.get("C")!.x);
  assert.equal(layout.positions.get("A")!.x, layout.positions.get("C")!.x);
});

test("layout stacks the no-prereq band below the connected flow and unlinked courses below that", () => {
  const { courses, requirements } = seattleGraph();
  const codes = programMapCodes(courses, requirements);
  const layout = layoutProgramFlow(codes, catalogRelations(courses), courses);
  const noPrerequisite = bandCourses(layout, codes, "no-prerequisite");
  const unlinked = bandCourses(layout, codes, "unlinked");

  assert.ok(layout.positions.get("CS 5150")!.y > layout.positions.get("CS 5500")!.y);
  const noPrereqYs = noPrerequisite.map((code) => layout.positions.get(code)!.y);
  const unlinkedYs = unlinked.map((code) => layout.positions.get(code)!.y);
  const firstNoPrereqY = Math.min(...noPrereqYs);
  const lastNoPrereqY = Math.max(...noPrereqYs);
  const firstUnlinkedY = Math.min(...unlinkedYs);
  const noPrereqLabel = layout.bands.find((band) => band.id === "no-prerequisite");
  const unlinkedLabel = layout.bands.find((band) => band.id === "unlinked");

  assert.ok(noPrereqLabel, "expected a No prerequisite required label");
  assert.ok(noPrereqLabel!.y < firstNoPrereqY);
  assert.ok(firstUnlinkedY > lastNoPrereqY, "unlinked band should sit below no-prereq courses");
  assert.ok(unlinkedLabel, "expected an Unlinked in this catalog label");
  assert.ok(unlinkedLabel!.y < firstUnlinkedY);
  assert.ok(unlinkedLabel!.y > lastNoPrereqY);

  const spots = [...layout.positions.values()].map((point) => `${point.x},${point.y}`);
  assert.equal(new Set(spots).size, spots.length, "no two courses may share a cell");
  assert.equal(layout.positions.size, codes.size);
});

test("mapFind matches compacted codes and titles and prefers courses on the map", () => {
  const courses = [
    { code: "CS 1800", title: "Discrete Structures" },
    { code: "CS 5500", title: "Foundations of Software Engineering" },
    { code: "CS 5800", title: "Algorithms" },
    { code: "PHYS 5116", title: "Electromagnetic Materials" },
  ];

  assert.deepEqual(mapFind.query(courses, "  ").matches, []);
  assert.equal(mapFind.query(courses, "cs5500").matches[0]?.code, "CS 5500");
  assert.equal(mapFind.query(courses, "PHYS 5116").matches[0]?.code, "PHYS 5116");
  assert.equal(mapFind.query(courses, "discrete").matches[0]?.code, "CS 1800");
  assert.equal(mapFind.query(courses, "800", ["CS 5800"]).matches[0]?.code, "CS 5800");
  assert.ok(mapFind.query(courses, "cs").matches.length > 2);
});

test("mapFind on the MSCS snapshot locates CS 5500 and PHYS 5116", () => {
  const { courses, requirements } = seattleGraph();
  const onMap = programMapCodes(courses, requirements);
  assert.equal(mapFind.query(courses, "cs5500", onMap).matches[0]?.code, "CS 5500");
  assert.equal(mapFind.query(courses, "5500", onMap).matches[0]?.code, "CS 5500");
  assert.equal(mapFind.query(courses, "PHYS 5116", onMap).matches[0]?.code, "PHYS 5116");
});

test("mapFind cycles matches and auto-locates only for a unique hit or a long needle", () => {
  const many = Array.from({ length: 12 }, (_, index) => ({
    code: `CS ${1000 + index}`,
    title: `Course ${index}`,
  }));
  const cs55 = [
    { code: "CS 5500", title: "Foundations" },
    { code: "CS 5510", title: "More" },
    { code: "CS 5520", title: "Still" },
    { code: "CS 5530", title: "Again" },
  ];
  assert.equal(mapFind.cycleIndex(-1, 5, 1), 0);
  assert.equal(mapFind.cycleIndex(-1, 5, -1), 4);
  assert.equal(mapFind.cycleIndex(0, 5, 1), 1);
  assert.equal(mapFind.cycleIndex(4, 5, 1), 0);
  assert.equal(mapFind.cycleIndex(0, 5, -1), 4);
  assert.equal(mapFind.cycleIndex(0, 0, 1), -1);
  assert.equal(mapFind.query(many, "c").autoLocate, false);
  assert.equal(mapFind.query(cs55, "cs55").autoLocate, true);
  assert.equal(mapFind.query([{ code: "XY 1", title: "Xylophone" }], "xy").autoLocate, true);
  assert.equal(mapFind.query([], "cs55").autoLocate, false);
});

test("mapFind reveals off-map courses by switching to the immediate neighborhood", () => {
  assert.deepEqual(mapFind.reveal("CS 1800", new Set(["CS 5010"])), { code: "CS 1800", neighborhood: true });
  assert.deepEqual(mapFind.reveal("CS 5010", new Set(["CS 5010"])), { code: "CS 5010", neighborhood: false });
  assert.deepEqual(mapFind.reveal("CS 5500", new Map([["CS 5500", 0]])), { code: "CS 5500", neighborhood: false });
});

class FakeElement {
  constructor(
    readonly tagName: string,
    readonly attrs: Record<string, string> = {},
    readonly parent: FakeElement | null = null,
  ) {}

  closest(selector: string): FakeElement | null {
    const parts = selector.split(",").map((part) => part.trim());
    let node: FakeElement | null = this;
    while (node) {
      if (parts.some((part) => node!.matchesSelector(part))) return node;
      node = node.parent;
    }
    return null;
  }

  matchesSelector(selector: string): boolean {
    if (selector === "dialog") return this.tagName === "dialog";
    const role = /^\[role=['"](.+)['"]\]$/.exec(selector);
    if (role) return this.attrs.role === role[1];
    if (selector.startsWith(".")) return (this.attrs.class ?? "").split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith("#")) return this.attrs.id === selector.slice(1);
    return false;
  }
}

const asTarget = (element: FakeElement) => element as unknown as EventTarget;

test("graph find skips a native dialog even when it has no role attribute", () => {
  const insideDialog = new FakeElement("input", {}, new FakeElement("dialog"));
  const onCanvas = new FakeElement("div");
  assert.equal(mapFind.intent({ key: "a", target: asTarget(insideDialog) }, "cs55").type, "skip");
  assert.equal(mapFind.intent({ key: "a", target: asTarget(onCanvas) }, "cs55").type, "none");
  assert.equal(mapFind.intent({ key: "a", target: null }, "cs55").type, "none");
});

test("graph find skips a role=dialog ancestor used by the course-details modal", () => {
  const insideModal = new FakeElement("button", {}, new FakeElement("div", { role: "dialog" }));
  assert.equal(mapFind.intent({ key: "F3", target: asTarget(insideModal) }, "cs55").type, "skip");
});

test("Escape clears map find when it has text and the canvas is focused", () => {
  const canvas = new FakeElement("div", { class: "react-flow" }, new FakeElement("div", { class: "flow-canvas" }));
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(canvas) }, "cs55").type, "clear");
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(canvas) }, "  ").type, "none");
  assert.equal(mapFind.intent({ key: "f", target: asTarget(canvas) }, "cs55").type, "none");
  assert.equal(mapFind.intent({ key: "Escape", target: null }, "cs55").type, "clear");
});

test("Escape does not steal dialog close when map find has text", () => {
  const insideDialog = new FakeElement("input", {}, new FakeElement("dialog"));
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(insideDialog) }, "cs55").type, "skip");
});

test("Escape does not clear map find from the header catalog search", () => {
  const headerSearch = new FakeElement("input", { type: "search" });
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(headerSearch) }, "cs55").type, "none");
  assert.equal(mapFind.intent({ key: "f", ctrlKey: true, target: asTarget(headerSearch) }, "").type, "focus");
});

test("Escape does not clear map find from the Show depth select", () => {
  const depth = new FakeElement("select", {}, new FakeElement("label", { class: "graph-depth-label" }, new FakeElement("div", { class: "graph-panel" })));
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(depth) }, "cs55").type, "none");
});

test("Escape still clears map find from graph find UI and the map panel", () => {
  const findInput = new FakeElement("input", { id: "graph-find" }, new FakeElement("div", { class: "graph-search-wrap" }));
  const panelNode = new FakeElement("button", {}, new FakeElement("div", { class: "graph-panel" }));
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(findInput) }, "cs55").type, "clear");
  assert.equal(mapFind.intent({ key: "Escape", target: asTarget(panelNode) }, "cs55").type, "clear");
});

test("compact graph cards shorten Prerequisite eligible without clipping other statuses", () => {
  assert.equal(compactGraphStatusLabel("Prerequisite eligible"), "Eligible");
  assert.equal(compactGraphStatusLabel("Locked"), "Locked");
  assert.equal(compactGraphStatusLabel("Needs review"), "Needs review");
  assert.equal(compactGraphStatusLabel("Completed"), "Completed");
});

test("a pending Fit survives Table to Map and is consumed once across remounts", () => {
  const acknowledged = { current: 0 };
  const container = { width: 800, height: 600 };
  const map = { width: 4000, height: 1000 };
  assert.equal(consumeGraphFitRequest(1, acknowledged, { width: 0, height: 0 }, map), null);
  assert.equal(consumeGraphFitRequest(1, acknowledged, container, map), 0.195);
  assert.equal(consumeGraphFitRequest(1, acknowledged, container, map), null);
  // The parent retains this acknowledgment while the canvas is unmounted.
  assert.equal(consumeGraphFitRequest(1, acknowledged, { width: 1200, height: 900 }, map), null);
  assert.equal(consumeGraphFitRequest(2, acknowledged, { width: 1200, height: 900 }, map), 0.295);
});

test("fit zoom uses the limiting dimension and can go below manual zoom minimum", () => {
  assert.equal(graphFitZoom({ width: 800, height: 600 }, { width: 4000, height: 1000 }), 0.195);
  assert.equal(graphFitZoom({ width: 800, height: 600 }, { width: 1000, height: 5000 }), 0.116);
  assert.equal(graphFitZoom({ width: 800, height: 600 }, { width: 200, height: 120 }), 1);
  assert.equal(graphFitZoom({ width: 800, height: 600 }, { width: 50000, height: 50000 }), 0.05);
});

test("zoom readout reports actual fit scale while manual zoom remains bounded", () => {
  assert.equal(graphZoomPercent(0.08), 8);
  assert.equal(graphZoomPercent(Number.NaN), 100);
  assert.equal(clampGraphZoom(0.08), 0.25);
  assert.equal(clampGraphZoom(0.08 + 0.25), 0.33);
});

test("manual graph zoom preserves the viewport center", () => {
  const next = centeredGraphZoomScroll(
    { scrollLeft: 300, scrollTop: 120, clientWidth: 400, clientHeight: 300 },
    1,
    1.5,
  );
  assert.deepEqual(next, { left: 550, top: 255 });
});

test("selected course reveal uses the current zoomed card geometry", () => {
  const current = { scrollLeft: 0, scrollTop: 0, clientWidth: 500, clientHeight: 360 };
  assert.deepEqual(selectedGraphScroll({ x: 50, y: 40 }, 0.5, current), { left: 0, top: 0 });
  assert.deepEqual(selectedGraphScroll({ x: 1000, y: 700 }, 0.5, current), { left: 322, top: 215 });
});

test("mapScene seats CS 5011 beside CS 5010 and draws no corequisite arrows", () => {
  const { courses, requirements } = seattleGraph();
  const scene = mapScene({
    courses,
    requirements,
    scope: "program",
    focusCode: "CS 5010",
    selectedCode: "CS 5010",
  });

  assert.equal(scene.visible.has("CS 5010"), true);
  assert.equal(scene.visible.has("CS 5011"), true);
  assert.equal(scene.positions.get("CS 5011")!.x, scene.positions.get("CS 5010")!.x);
  assert.equal(scene.positions.get("CS 5011")!.y, scene.positions.get("CS 5010")!.y + PROGRAM_ROW);
  assert.equal(
    scene.arrows.some(
      (arrow) =>
        (arrow.source === "CS 5010" && arrow.target === "CS 5011") ||
        (arrow.source === "CS 5011" && arrow.target === "CS 5010"),
    ),
    false,
  );
  assert.ok(scene.bands.some((band) => band.id === "no-prerequisite"));
});

test("mapScene neighborhood of CS 5500 is four courses left to right", () => {
  const { courses, requirements } = seattleGraph();
  const scene = mapScene({
    courses,
    requirements,
    scope: "1",
    focusCode: "CS 5500",
    selectedCode: "CS 5500",
  });

  assert.deepEqual([...scene.visible.keys()].sort(), ["CS 5004", "CS 5010", "CS 5500", "CS 6510"]);
  const x = (code: string) => scene.positions.get(code)!.x;
  assert.ok(x("CS 5004") < x("CS 5500"));
  assert.ok(x("CS 5010") < x("CS 5500"));
  assert.ok(x("CS 5500") < x("CS 6510"));
  assert.deepEqual(scene.bands, []);
});

test("mapScene highlights only directed prerequisite chains, not corequisite neighbors", () => {
  const { courses, requirements } = seattleGraph();
  const selected5010 = mapScene({
    courses,
    requirements,
    scope: "program",
    focusCode: "CS 5010",
    selectedCode: "CS 5010",
  });
  const selected5500 = mapScene({
    courses,
    requirements,
    scope: "program",
    focusCode: "CS 5010",
    selectedCode: "CS 5500",
  });

  assert.equal(selected5010.chain.has("CS 5010"), true);
  assert.equal(selected5010.chain.has("CS 5011"), false);
  assert.equal(selected5010.chain.has("CS 5500"), true);
  assert.equal(selected5010.chain.has("CS 5004"), false);
  assert.equal(
    selected5010.arrows.some((arrow) => arrow.source === "CS 5010" && arrow.target === "CS 5500" && arrow.emphasized),
    true,
  );
  assert.equal(selected5500.chain.has("CS 5011"), false);
  assert.equal(selected5500.chain.has("CS 5004"), true);
  assert.equal(selected5500.chain.has("CS 5010"), true);
});

test("dimmed course cards stack above selected edges so line-focus does not steal clicks", () => {
  assert.ok(graphCourseZIndex({ focused: false, emphasized: false }) > GRAPH_SELECTED_EDGE_Z);
  assert.ok(graphCourseZIndex({ focused: false, emphasized: true }) > GRAPH_SELECTED_EDGE_Z);
  assert.ok(graphCourseZIndex({ focused: true, emphasized: true }) > graphCourseZIndex({ focused: false, emphasized: true }));
});

test("Escape clears line focus from the inspector and empty map, not from find text or fullscreen", () => {
  const inspector = new FakeElement("h2", {}, new FakeElement("aside", { class: "graph-inspector", id: "graph-inspector" }, new FakeElement("div", { class: "graph-layout" })));
  const pane = new FakeElement("div", { class: "react-flow__pane" }, new FakeElement("div", { class: "flow-canvas" }, new FakeElement("div", { class: "graph-layout" })));
  const dialog = new FakeElement("button", {}, new FakeElement("div", { role: "dialog" }));
  const semesterSelect = new FakeElement("select", { id: "line-focus-semester" }, new FakeElement("div", { class: "graph-layout" }));
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(inspector) }, { active: true, findQuery: "", fullscreen: false }), true);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(pane) }, { active: true, findQuery: "", fullscreen: false }), true);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: null }, { active: true, findQuery: "", fullscreen: false }), true);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(inspector) }, { active: false, findQuery: "", fullscreen: false }), false);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(pane) }, { active: true, findQuery: "cs55", fullscreen: false }), false);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(inspector) }, { active: true, findQuery: "", fullscreen: true }), false);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Enter", target: asTarget(inspector) }, { active: true, findQuery: "", fullscreen: false }), false);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(dialog) }, { active: true, findQuery: "", fullscreen: false }), false);
  assert.equal(shouldClearLineFocusOnEscape({ key: "Escape", target: asTarget(semesterSelect) }, { active: true, findQuery: "", fullscreen: false }), false);
});
