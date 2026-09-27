import { strict as assert } from "node:assert";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { RequirementChipsView, RequirementTreeView } from "../components/requirement-tree";
import {
  busGroupKey,
  catalogRelations,
  graphJoinStrokeDasharray,
  namedPrerequisiteJoin,
  prerequisiteBusMeta,
  relationshipControlGroups,
  relationshipExplanationCopy,
  relationshipGroupButtonLabel,
  requirementJoinGroups,
  REQUIREMENT_ALL_LABEL,
  REQUIREMENT_ANY_LABEL,
  simplifyRequirement,
} from "../lib/graph";
import { parseRequirement } from "../scraper/parser";
import type { Catalog, Course, RequirementExpression } from "../lib/types";

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;
const byCode = new Map(seattle.courses.map((course) => [course.code, course] as const));

function course(code: string): Course {
  const found = byCode.get(code);
  assert.ok(found, `missing ${code}`);
  return found;
}

test("parser keeps AND/OR types for NEU MSCS samples that need compound logic", () => {
  assert.deepEqual(parseRequirement("CS 5800 with a minimum grade of C- or CS 7800 with a minimum grade of C-").type, "any");
  const grouped = parseRequirement("(CS 5004 with a minimum grade of B- or CS 5010 with a minimum grade of C- ); CS 5500 with a minimum grade of C-");
  assert.equal(grouped.type, "all");
  assert.equal(grouped.type === "all" && grouped.items.some((item) => item.type === "any"), true);

  assert.equal(course("CS 6140").prerequisites.type, "any");
  assert.equal(course("CS 6510").prerequisites.type, "all");
  assert.equal(course("CS 5004").prerequisites.type, "all");
  assert.equal(course("CS 5010").corequisites.type, "course");
  assert.equal(course("CS 5011").corequisites.type, "course");
});

test("simplifyRequirement flattens nested OR and duplicate catalog leaves", () => {
  const nestedOr: RequirementExpression = {
    type: "any",
    items: [
      { type: "any", items: [{ type: "course", code: "CS 5800" }, { type: "course", code: "CS 7800" }] },
      { type: "course", code: "CS 7800" },
    ],
  };
  assert.deepEqual(simplifyRequirement(nestedOr), {
    type: "any",
    items: [
      { type: "course", code: "CS 5800" },
      { type: "course", code: "CS 7800" },
    ],
  });

  const cs5004 = simplifyRequirement(course("CS 5004").prerequisites);
  assert.deepEqual(cs5004, {
    type: "all",
    items: [
      { type: "course", code: "CS 5001", minimumGrade: "C-" },
      { type: "course", code: "CS 5002", minimumGrade: "C-" },
    ],
  });
});

test("join groups keep OR alternatives off the AND bus for CS 6510", () => {
  const groups = requirementJoinGroups(course("CS 6510").prerequisites);
  assert.deepEqual(
    groups.map((group) => ({ join: group.join, codes: group.codes, label: group.label })),
    [
      { join: "any", codes: ["CS 5004", "CS 5010"], label: REQUIREMENT_ANY_LABEL },
      { join: "all", codes: ["CS 5500"], label: REQUIREMENT_ALL_LABEL },
    ],
  );
  assert.equal(namedPrerequisiteJoin(course("CS 6510").prerequisites, "CS 5004"), "any");
  assert.equal(namedPrerequisiteJoin(course("CS 6510").prerequisites, "CS 5500"), "all");

  const orGroups = requirementJoinGroups(course("CS 6140").prerequisites);
  assert.equal(orGroups.length, 1);
  assert.equal(orGroups[0]?.join, "any");
  assert.deepEqual(orGroups[0]?.codes, ["CS 5800", "CS 7800"]);
});

test("catalogRelations carry join metadata for NEU MSCS AND/OR samples", () => {
  const relations = catalogRelations(seattle.courses);
  const cs6140 = relations.filter((edge) => edge.target === "CS 6140" && !edge.corequisite);
  assert.ok(cs6140.length >= 2);
  assert.ok(cs6140.every((edge) => edge.join === "any"));
  const cs6510 = relations.filter((edge) => edge.target === "CS 6510" && !edge.corequisite);
  assert.equal(cs6510.find((edge) => edge.source === "CS 5004")?.join, "any");
  assert.equal(cs6510.find((edge) => edge.source === "CS 5500")?.join, "all");
  assert.notEqual(
    cs6510.find((edge) => edge.source === "CS 5004")?.groupId,
    cs6510.find((edge) => edge.source === "CS 5500")?.groupId,
  );
  const coreq = relations.find((edge) => edge.corequisite && [edge.source, edge.target].includes("CS 5010"));
  assert.ok(coreq);
});

test("AND and OR incoming groups get separate buses", () => {
  const positions = new Map([
    ["CS 5004", { x: 0, y: 0 }],
    ["CS 5010", { x: 0, y: 160 }],
    ["CS 5500", { x: 0, y: 320 }],
    ["CS 6510", { x: 360, y: 160 }],
  ]);
  const relations = catalogRelations(seattle.courses).filter((edge) => edge.target === "CS 6510" && !edge.corequisite);
  const meta = prerequisiteBusMeta(relations, positions);
  const orKey = busGroupKey("CS 6510", relations.find((edge) => edge.source === "CS 5004")?.groupId);
  const andKey = busGroupKey("CS 6510", relations.find((edge) => edge.source === "CS 5500")?.groupId);
  assert.notEqual(orKey, andKey);
  assert.ok(meta.get(orKey));
  assert.ok(meta.get(andKey));
  assert.notEqual(meta.get(orKey)?.busOwner, meta.get(andKey)?.busOwner);
  const groups = relationshipControlGroups(relations);
  assert.equal(groups.length, 2);
  assert.equal(relationshipGroupButtonLabel(groups.find((group) => group.join === "any")!), "OR · CS 6510");
});

test("display helpers do not describe an OR alternative as a sole prerequisite", () => {
  const orBranch = relationshipExplanationCopy({
    kind: "branch",
    source: "CS 5800",
    target: "CS 6140",
    sources: ["CS 5800"],
    join: "any",
  });
  assert.match(orBranch.body, /OR alternative/);
  assert.doesNotMatch(orBranch.body, /named as a prerequisite of CS 6140/);
  const orBus = relationshipExplanationCopy({
    kind: "bus",
    target: "CS 6140",
    sources: ["CS 5800", "CS 7800"],
    join: "any",
  });
  assert.match(orBus.body, /OR alternatives/);
  assert.doesNotMatch(orBus.title, /shared prerequisite bus/);
  assert.equal(graphJoinStrokeDasharray("any"), "7 5");
  assert.equal(graphJoinStrokeDasharray("all"), undefined);
  assert.equal(graphJoinStrokeDasharray(undefined, true), "2 3");
});

test("requirement tree and chips render AND/OR instead of a flat required list", () => {
  const tree = renderToStaticMarkup(
    createElement(RequirementTreeView, {
      expression: course("CS 6510").prerequisites,
      onSelect: () => {},
    }),
  );
  assert.match(tree, /ALL of the following \(AND\)/);
  assert.match(tree, /ANY of the following \(OR\)/);
  assert.match(tree, /CS 5004/);
  assert.match(tree, /CS 5500/);

  const chips = renderToStaticMarkup(
    createElement(RequirementChipsView, {
      expression: course("CS 6140").prerequisites,
      onSelect: () => {},
    }),
  );
  assert.match(chips, />OR</);
  assert.match(chips, /CS 5800/);
  assert.match(chips, /CS 7800/);
  assert.doesNotMatch(chips, /All into/);
});
