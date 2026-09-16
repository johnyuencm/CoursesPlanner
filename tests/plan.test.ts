import { strict as assert } from "node:assert";
import test from "node:test";

import { addableLineCourses, appendCoursesToSemester, emptyPlan, loadPlan, parsePlan, parsePlanBackup, recordedCourseCodes, restorePlan, serializePlanBackup, STORAGE_KEY } from "../lib/plan";

test("emptyPlan starts in Fall 2026 with five fresh terms and one co-op", () => {
  const first = emptyPlan();
  const second = emptyPlan();
  assert.equal(first.version, 1);
  assert.equal(first.semesters[0].name, "Fall 2026");
  assert.equal(first.semesters.length, 5);
  assert.equal(first.semesters.filter((semester) => semester.type === "coop").length, 1);
  first.semesters[0].courses.push({ code: "CS 5010" });
  assert.deepEqual(second.semesters[0].courses, []);
});

test("parsePlan accepts valid version-1 data and preserves well-formed unknown catalog codes", () => {
  const parsed = parsePlan({
    version: 1,
    completedCourses: ["CY 9999"],
    waivedCourses: ["CS 5010"],
    completedCredits: { "CY 9999": 4 },
    semesters: [
      {
        id: "fall-2026",
        name: "Fall 2026",
        type: "academic",
        courses: [{ code: "CS 5800", credits: 4 }],
      },
    ],
  });
  assert.deepEqual(parsed.completedCourses, ["CY 9999"]);
  assert.deepEqual(parsed.semesters[0].courses[0], { code: "CS 5800", credits: 4 });
});

test("parsePlan rejects malformed versions, course codes, credit values, and semester fields", () => {
  const valid = emptyPlan();
  assert.throws(() => parsePlan({ ...valid, version: 2 }), /version 1/);
  assert.throws(() => parsePlan({ ...valid, completedCourses: ["cs5010"] }), /course code/);
  assert.throws(() => parsePlan({ ...valid, completedCredits: { "CS 5010": Number.NaN } }), /finite number/);
  assert.throws(() => parsePlan({ ...valid, completedCredits: { "CS 5010": Number.POSITIVE_INFINITY } }), /finite number/);
  assert.throws(() => parsePlan({ ...valid, completedCredits: { "CS 5010": 33 } }), /0 to 32/);
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: [{ id: "bad id", name: "Fall 2026", type: "academic", courses: [] }],
      }),
    /semester.*id|ID/i,
  );
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: [{ id: "fall", name: " Fall 2026", type: "academic", courses: [] }],
      }),
    /trimmed text/,
  );
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: [{ id: "fall", name: "Fall 2026", type: "internship", courses: [] }],
      }),
    /academic.*coop/,
  );
});

test("parsePlan bounds arrays and requires unique semester IDs", () => {
  const valid = emptyPlan();
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: [
          { id: "same", name: "Fall 2026", type: "academic", courses: [] },
          { id: "same", name: "Spring 2027", type: "academic", courses: [] },
        ],
      }),
    /duplicated/,
  );
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: Array.from({ length: 33 }, (_, index) => ({
          id: `term-${index}`,
          name: `Term ${index}`,
          type: "academic",
          courses: [],
        })),
      }),
    /more than 32/,
  );
  assert.throws(
    () =>
      parsePlan({
        ...valid,
        semesters: [
          {
            id: "fall",
            name: "Fall",
            type: "academic",
            courses: Array.from({ length: 33 }, () => ({ code: "CS 5010" })),
          },
        ],
      }),
    /more than 32/,
  );
});

test("loadPlan returns parsed storage without writing or replacing it", () => {
  const saved = JSON.stringify(emptyPlan());
  let requestedKey = "";
  const loaded = loadPlan({
    getItem(key: string) {
      requestedKey = key;
      return saved;
    },
  });
  assert.equal(requestedKey, STORAGE_KEY);
  assert.equal(loaded.error, null);
  assert.deepEqual(loaded.plan, emptyPlan());
});

test("loadPlan safely recovers from absent, corrupt, and unavailable storage", () => {
  const absent = loadPlan({ getItem: (_key: string) => null });
  assert.equal(absent.error, null);
  assert.deepEqual(absent.plan, emptyPlan());

  const corrupt = loadPlan({ getItem: (_key: string) => "{not-json" });
  assert.match(corrupt.error ?? "", /Could not load/);
  assert.deepEqual(corrupt.plan, emptyPlan());

  const unavailable = loadPlan({
    getItem(_key: string): string | null {
      throw new Error("storage denied");
    },
  });
  assert.match(unavailable.error ?? "", /storage denied/);
  assert.deepEqual(unavailable.plan, emptyPlan());
});

test("plan backup round-trips every version-1 plan field, including empty terms and unknown courses", () => {
  const plan = {
    version: 1 as const,
    completedCourses: ["CY 9999"],
    waivedCourses: ["CS 5010"],
    completedCredits: { "CY 9999": 3 },
    semesters: [
      { id: "empty", name: "Empty term", type: "academic" as const, courses: [] },
      { id: "coop", name: "Co-op", type: "coop" as const, courses: [{ code: "DS 9999", credits: 1 }] },
    ],
  };
  assert.deepEqual(parsePlanBackup(serializePlanBackup(plan)), plan);
});

test("backup parsing rejects invalid JSON and oversized text before a restore can begin", () => {
  assert.throws(() => parsePlanBackup("not json"), /valid JSON/i);
  assert.throws(() => parsePlanBackup(" ".repeat(1_000_001)), /too large/i);
  assert.throws(() => parsePlanBackup("é".repeat(500_001)), /too large/i);
});

test("restore writes the validated replacement before returning it to the UI", () => {
  const replacement = { ...emptyPlan(), semesters: [] };
  let stored = "";
  const restored = restorePlan({ setItem: (_key, value) => { stored = value; } }, replacement);
  assert.deepEqual(restored, replacement);
  assert.deepEqual(JSON.parse(stored), replacement);

  assert.throws(
    () => restorePlan({ setItem: () => { throw new Error("storage denied"); } }, replacement),
    /storage denied/,
  );

  let writes = 0;
  assert.throws(
    () => restorePlan({ setItem: () => { writes += 1; } }, { ...replacement, version: 2 }),
    /version 1/,
  );
  assert.equal(writes, 0);

  const saved: string[] = [];
  const storage = { setItem: (_key: string, value: string) => { saved.push(value); } };
  restorePlan(storage, replacement);
  restorePlan(storage, { ...replacement, completedCourses: ["CS 5010"] });
  assert.equal(saved.length, 2);
  assert.deepEqual(JSON.parse(saved[1]).completedCourses, ["CS 5010"]);
});

test("addableLineCourses keeps program courses and skips externals, unknowns, and recorded codes", () => {
  const courses = [
    { code: "CS 5010", requirementType: "core", credits: 4 },
    { code: "CS 5500", requirementType: "core", credits: 4 },
    { code: "CS 5004", requirementType: "external", credits: 4 },
  ];
  assert.deepEqual(
    addableLineCourses(["CS 5010", "CS 5500", "CS 5004", "CS 9999", "CS 5500"], courses, ["CS 5010"]),
    [{ code: "CS 5500", credits: 4 }],
  );
});

test("appendCoursesToSemester inserts remaining line courses and refuses a missing or full term", () => {
  const plan = emptyPlan();
  plan.semesters[0] = { ...plan.semesters[0], courses: [{ code: "CS 5800" }] };
  const added = appendCoursesToSemester(plan, "fall-2026", [{ code: "CS 5500", credits: 4 }]);
  assert.equal(added.ok, true);
  if (added.ok) {
    assert.deepEqual(added.added, ["CS 5500"]);
    assert.equal(added.semesterName, "Fall 2026");
    assert.deepEqual(added.plan.semesters[0].courses, [{ code: "CS 5800" }, { code: "CS 5500", credits: 4 }]);
    assert.deepEqual(plan.semesters[0].courses, [{ code: "CS 5800" }]);
  }

  const recorded = recordedCourseCodes(added.ok ? added.plan : plan);
  assert.equal(recorded.has("CS 5800"), true);
  assert.equal(recorded.has("CS 5500"), true);

  assert.equal(appendCoursesToSemester(plan, "missing-term", [{ code: "CS 5500", credits: 4 }]).ok, false);
  assert.equal(appendCoursesToSemester(plan, "fall-2026", []).ok, false);

  const full = emptyPlan();
  full.semesters[0] = {
    ...full.semesters[0],
    courses: Array.from({ length: 32 }, (_, index) => ({ code: `CS ${String(5000 + index).padStart(4, "0")}` })),
  };
  const capacity = appendCoursesToSemester(full, "fall-2026", [{ code: "CS 5800", credits: 4 }]);
  assert.equal(capacity.ok, false);
  if (!capacity.ok) assert.equal(capacity.reason, "capacity");
});
