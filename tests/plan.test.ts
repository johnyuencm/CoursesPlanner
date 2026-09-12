import { strict as assert } from "node:assert";
import test from "node:test";

import { emptyPlan, loadPlan, parsePlan, STORAGE_KEY } from "../lib/plan";

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
