import { strict as assert } from "node:assert";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { validateCatalog } from "../lib/catalog";
import { programCourseCodes, requirementView } from "../lib/requirements-v2";
import type { Catalog, RequirementExpression } from "../lib/types";
import {
  PROGRAM_URL,
  buildCourseGraph,
  parseCourses,
  parseProgramRequirements,
  parseRequirement,
} from "../scraper/parser";
import { refreshCatalog } from "../scraper/refresh";

const fixture = (name: string) =>
  readFileSync(path.join(process.cwd(), "data", "raw", name), "utf8");

function containsType(expression: RequirementExpression, type: RequirementExpression["type"]): boolean {
  if (expression.type === type) return true;
  return (expression.type === "all" || expression.type === "any") &&
    expression.items.some((item) => containsType(item, type));
}

test("parses official MSCS Seattle program requirements from cached HTML", () => {
  const requirements = parseProgramRequirements(
    fixture("mscs-sea-program.html"),
    PROGRAM_URL,
    "2026-09-11T00:00:00.000Z",
  );

  const view = requirementView(requirements);
  assert.equal(requirements.version, 2);
  assert.equal(view.totalCredits, 32);
  assert.equal(view.breadth?.credits, 12);
  assert.equal(view.breadth?.count, 3);
  assert.equal(view.breadth?.minAreas, 2);
  assert.equal(view.areas.length, 3);
  assert.equal(view.electives?.credits, 12);
  assert.deepEqual(view.core, ["CS 5010", "CS 5011", "CS 5800"]);
  assert.equal(requirements.officialUrl, PROGRAM_URL);
  // The committed snapshot holds exactly what the parser emits (v2), from the same cached page.
  const committed = JSON.parse(readFileSync(path.join(process.cwd(), "data", "requirements.json"), "utf8"));
  assert.deepEqual(parseProgramRequirements(fixture("mscs-sea-program.html"), PROGRAM_URL, committed.lastUpdated), committed);
});

test("parses reciprocal corequisites and grouped prerequisites from cached bulk CS HTML", () => {
  const courses = parseCourses(
    fixture("cs.html"),
    "https://catalog.northeastern.edu/course-descriptions/cs/",
  );
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const cs5010 = byCode.get("CS 5010");
  const cs5011 = byCode.get("CS 5011");
  const cs5800 = byCode.get("CS 5800");
  const cs6140 = byCode.get("CS 6140");
  const cs6510 = byCode.get("CS 6510");
  const variableCredit = courses.find((course) => course.maxCredits !== undefined && course.maxCredits > course.credits);

  assert.ok(courses.length > 150, "bulk fixture should contain the full CS subject listing");
  assert.ok(cs5010);
  assert.ok(cs5011);
  assert.ok(cs5800);
  assert.ok(cs6140);
  assert.ok(cs6510);
  assert.ok(variableCredit, "bulk fixture should contain at least one parsed credit range");
  assert.deepEqual(cs5010.corequisiteCodes, ["CS 5011"]);
  assert.deepEqual(cs5011.corequisiteCodes, ["CS 5010"]);
  assert.equal(cs5800.prerequisites.type, "none");
  assert.equal(cs5800.corequisites.type, "none");
  assert.equal(cs6140.prerequisites.type, "any");
  assert.deepEqual(cs6140.prerequisiteCodes, ["CS 5800", "CS 7800"]);
  assert.match(cs6140.prerequisiteText, /minimum grade of C-/i);
  assert.deepEqual(cs6140.prerequisites, {
    type: "any",
    items: [
      { type: "course", code: "CS 5800", minimumGrade: "C-" },
      { type: "course", code: "CS 7800", minimumGrade: "C-" },
    ],
  });
  assert.equal(containsType(cs6510.prerequisites, "all"), true);
  assert.equal(containsType(cs6510.prerequisites, "any"), true);
  assert.ok(cs6510.prerequisiteCodes.length >= 3);
});

test("parses letter-grade floors that include a trailing minus", () => {
  assert.deepEqual(parseRequirement("CS 5800 with a minimum grade of C- or CS 7800 with a minimum grade of C-"), {
    type: "any",
    items: [
      { type: "course", code: "CS 5800", minimumGrade: "C-" },
      { type: "course", code: "CS 7800", minimumGrade: "C-" },
    ],
  });
});

test("a (Graduate)/(Undergraduate) level after a grade belongs to that grade, not a new clause", () => {
  // CS 5400 catalog text: the level qualifies the C- grade floor.
  assert.deepEqual(parseRequirement("CS 5010 with a minimum grade of D- or CS 5004 with a minimum grade of B- or CS 5010 with a minimum grade of C- (Graduate)"), {
    type: "any",
    items: [
      { type: "any", items: [{ type: "course", code: "CS 5010", minimumGrade: "D-" }, { type: "course", code: "CS 5004", minimumGrade: "B-" }] },
      { type: "course", code: "CS 5010", minimumGrade: "C- (Graduate)" },
    ],
  });
  assert.deepEqual(parseRequirement("MATH 2331 with a minimum grade of C ( Undergraduate ) and CS 5800"), {
    type: "all",
    items: [{ type: "course", code: "MATH 2331", minimumGrade: "C (Undergraduate)" }, { type: "course", code: "CS 5800" }],
  });
  // Without a grade floor, a parenthesized word is still not guessed at.
  assert.deepEqual(parseRequirement("CS 5010 (Graduate)"), {
    type: "all",
    items: [{ type: "course", code: "CS 5010" }, { type: "unknown", text: "Graduate" }],
  });
});

test("keeps unsupported or malformed requirement clauses explicitly unknown", () => {
  assert.deepEqual(parseRequirement("Prerequisite(s): department approval"), {
    type: "unknown",
    text: "department approval",
  });
  assert.deepEqual(parseRequirement("Prerequisite(s): (CS 5000"), {
    type: "unknown",
    text: "(CS 5000",
  });
});

test("builds downstream prerequisite unlocks without adding corequisite unlocks", () => {
  const requirements = parseProgramRequirements(
    fixture("mscs-sea-program.html"),
    PROGRAM_URL,
    "2026-09-11T00:00:00.000Z",
  );
  const graph = buildCourseGraph(
    parseCourses(fixture("cs.html"), "https://catalog.northeastern.edu/course-descriptions/cs/"),
    requirements,
  );
  const byCode = new Map(graph.map((course) => [course.code, course]));
  const cs5010 = byCode.get("CS 5010");
  const cs5011 = byCode.get("CS 5011");

  assert.ok(cs5010);
  assert.ok(cs5011);
  assert.equal(cs5010.requirementType, "core");
  assert.equal(cs5011.requirementType, "core");
  assert.equal(cs5010.unlocks.includes("CS 5011"), false);
  assert.ok(
    cs5010.unlocks.some((code) => byCode.get(code)?.prerequisiteCodes.includes("CS 5010")),
    "at least one parsed prerequisite should produce a downstream unlock",
  );
  assert.ok(byCode.has("CS 5100"), "isolated breadth courses remain in the program graph");
  assert.ok(byCode.has("CS 5800"), "core courses with no prerequisites remain in the program graph");
  assert.ok(byCode.has("CS 5004"), "direct external prerequisites of program courses remain");
  assert.equal(byCode.has("CS 1800"), false, "unrelated undergraduate bulk listings stay out of the published catalog");
  assert.equal(
    graph.filter((course) => course.requirementType !== "external").length,
    programCourseCodes(requirements).length,
  );
});

test("catalog validation rejects unsafe official links and mismatched relationship indexes", () => {
  const lastUpdated = "2026-09-11T00:00:00.000Z";
  const requirements = parseProgramRequirements(
    fixture("mscs-sea-program.html"),
    PROGRAM_URL,
    lastUpdated,
  );
  const catalog: Catalog = {
    courses: buildCourseGraph(
      parseCourses(fixture("cs.html"), "https://catalog.northeastern.edu/course-descriptions/cs/"),
      requirements,
    ),
    requirements,
    lastUpdated,
    sources: [PROGRAM_URL, "https://catalog.northeastern.edu/course-descriptions/cs/"],
    warnings: [],
  };

  assert.doesNotThrow(() => validateCatalog(catalog));

  const unsafe = structuredClone(catalog);
  unsafe.courses[0].officialUrl = "https://example.com/course";
  assert.throws(() => validateCatalog(unsafe), /Invalid course record/);

  const mismatched = structuredClone(catalog);
  const cs5800 = mismatched.courses.find((course) => course.code === "CS 5800");
  assert.ok(cs5800);
  cs5800.prerequisiteCodes = ["CS 5010"];
  assert.throws(() => validateCatalog(mismatched), /Requirement code indexes do not match/);
});

test("forced refresh retains usable cached sources when the catalog is offline", async () => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "neu-catalog-refresh-"));
  const rawDir = path.join(rootDir, "data", "raw");
  const offlineFetch: typeof fetch = async () => {
    throw new TypeError("offline test fixture");
  };

  try {
    await mkdir(rawDir, { recursive: true });
    await copyFile(path.join(process.cwd(), "data", "raw", "mscs-sea-program.html"), path.join(rawDir, "mscs-sea-program.html"));
    await copyFile(path.join(process.cwd(), "data", "raw", "cs.html"), path.join(rawDir, "cs.html"));

    const catalog = await refreshCatalog({
      force: true,
      rootDir,
      fetchImpl: offlineFetch,
      delayMs: 0,
      now: () => new Date("2026-09-11T00:00:00.000Z"),
    });

    assert.equal(requirementView(catalog.requirements).totalCredits, 32);
    assert.ok(catalog.courses.some((course) => course.code === "CS 5010"));
    assert.ok(catalog.warnings.some((warning) => warning.startsWith("Using stale cache for")));
    assert.ok(catalog.warnings.some((warning) => warning.includes("optional") && warning.includes("placeholder")));
    assert.equal(requirementView(JSON.parse(readFileSync(path.join(rootDir, "data", "catalog.json"), "utf8")).requirements).totalCredits, 32);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});
