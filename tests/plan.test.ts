import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { addableLineCourses, addableProgramCodes, appendCoursesToSemester, applyPrerequisiteFix, canRestorePlanBackup, createPlanBackupDownload, emptyPlan, isCatalogOutage, loadPlan, MAX_COURSES_PER_SEMESTER, moveCourseToSemester, parsePlan, parsePlanBackup, PLAN_BACKUP_FILENAME, PLAN_RECOVERY_FILENAME, recordedCourseCodes, restorePlan, serializePlanBackup, STORAGE_KEY, suggestedPrerequisiteFix, summarizePlan } from "../lib/plan";
import type { Catalog } from "../lib/types";
import { validatePlan } from "../lib/validation";

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
  assert.equal(loaded.raw, saved);
  assert.deepEqual(loaded.plan, emptyPlan());
});

test("loadPlan safely recovers from absent, corrupt, and unavailable storage", () => {
  const absent = loadPlan({ getItem: (_key: string) => null });
  assert.equal(absent.error, null);
  assert.equal(absent.raw, null);
  assert.deepEqual(absent.plan, emptyPlan());

  const corrupt = loadPlan({ getItem: (_key: string) => "{not-json" });
  assert.match(corrupt.error ?? "", /Could not load/);
  assert.equal(corrupt.raw, "{not-json");
  assert.deepEqual(corrupt.plan, emptyPlan());

  const unavailable = loadPlan({
    getItem(_key: string): string | null {
      throw new Error("storage denied");
    },
  });
  assert.match(unavailable.error ?? "", /storage denied/);
  assert.equal(unavailable.raw, null);
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

test("blocked storage export downloads raw recovery data instead of an empty plan backup", () => {
  const emptyBackup = serializePlanBackup(emptyPlan());
  const corruptStored = "{not-json";
  const recovery = createPlanBackupDownload({ blocked: true, plan: emptyPlan(), rawStored: corruptStored });
  assert.equal(recovery.kind, "recovery");
  assert.equal(recovery.filename, PLAN_RECOVERY_FILENAME);
  assert.equal(recovery.mimeType, "text/plain");
  assert.equal(recovery.body, corruptStored);
  assert.notEqual(recovery.body, emptyBackup);
  assert.match(recovery.message, /recovery copy|not a validated plan backup/i);

  assert.throws(
    () => createPlanBackupDownload({ blocked: true, plan: emptyPlan(), rawStored: null }),
    /empty on-screen plan/i,
  );
  assert.throws(
    () => createPlanBackupDownload({ blocked: true, plan: emptyPlan(), rawStored: "" }),
    /empty on-screen plan/i,
  );
});

test("healthy persistence still exports a validated in-memory plan backup", () => {
  const plan = {
    ...emptyPlan(),
    completedCourses: ["CS 5010"],
    semesters: [{ id: "fall-2026", name: "Fall 2026", type: "academic" as const, courses: [{ code: "CS 5800", credits: 4 }] }],
  };
  const download = createPlanBackupDownload({ blocked: false, plan, rawStored: "{ignored" });
  assert.equal(download.kind, "backup");
  assert.equal(download.filename, PLAN_BACKUP_FILENAME);
  assert.equal(download.mimeType, "application/json");
  assert.deepEqual(parsePlanBackup(download.body), plan);
  assert.match(download.message, /Backup downloaded/);
});

test("catalog loading is not an outage and keeps Restore disabled without an ack card", () => {
  assert.equal(isCatalogOutage({ hydrated: true, catalogAvailable: false, catalogBusy: true }), false);
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: false,
      catalogBusy: true,
      acknowledgedOutageRestore: false,
    }),
    false,
  );
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: false,
      catalogBusy: true,
      acknowledgedOutageRestore: true,
    }),
    false,
  );
});

test("catalog-outage restore stays gated until the current plan is acknowledged", () => {
  assert.equal(isCatalogOutage({ hydrated: true, catalogAvailable: false, catalogBusy: false }), true);
  assert.equal(isCatalogOutage({ hydrated: true, catalogAvailable: true, catalogBusy: false }), false);
  assert.equal(isCatalogOutage({ hydrated: false, catalogAvailable: false, catalogBusy: false }), false);
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: true,
      catalogBusy: false,
      acknowledgedOutageRestore: false,
    }),
    true,
  );
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: true,
      catalogBusy: true,
      acknowledgedOutageRestore: false,
    }),
    true,
  );
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: false,
      catalogBusy: false,
      acknowledgedOutageRestore: false,
    }),
    false,
  );
  assert.equal(
    canRestorePlanBackup({
      hydrated: true,
      catalogAvailable: false,
      catalogBusy: false,
      acknowledgedOutageRestore: true,
    }),
    true,
  );
  assert.equal(
    canRestorePlanBackup({
      hydrated: false,
      catalogAvailable: true,
      catalogBusy: false,
      acknowledgedOutageRestore: true,
    }),
    false,
  );
});

test("plan summary lists terms and recorded courses for outage restore visibility", () => {
  const plan = {
    version: 1 as const,
    completedCourses: ["CS 5010"],
    waivedCourses: ["CS 5004"],
    completedCredits: { "CS 5010": 4 },
    semesters: [
      { id: "fall-2026", name: "Fall 2026", type: "academic" as const, courses: [{ code: "CS 5800", credits: 4 }] },
      { id: "spring-2027", name: "Spring 2027", type: "academic" as const, courses: [] },
    ],
  };
  const summary = summarizePlan(plan);
  assert.equal(summary.termCount, 2);
  assert.equal(summary.plannedCourseCount, 1);
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.waivedCount, 1);
  assert.deepEqual(summary.terms[0].courseCodes, ["CS 5800"]);
  assert.deepEqual(summary.terms[1].courseCodes, []);
  assert.deepEqual(summary.completedCourses, ["CS 5010"]);
  assert.deepEqual(summary.waivedCourses, ["CS 5004"]);
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

const seattle = JSON.parse(readFileSync(path.join(process.cwd(), "data", "catalog.json"), "utf8")) as Catalog;

function withCourses(plan: ReturnType<typeof emptyPlan>, updates: Record<string, { code: string; credits?: number }[]>) {
  return {
    ...plan,
    semesters: plan.semesters.map((semester) =>
      Object.prototype.hasOwnProperty.call(updates, semester.id)
        ? { ...semester, courses: updates[semester.id]! }
        : semester,
    ),
  };
}

test("moveCourseToSemester relocates a course and refuses missing or full terms", () => {
  const start = withCourses(emptyPlan(), { "fall-2026": [{ code: "CS 5800", credits: 4 }] });
  const moved = moveCourseToSemester(start, "CS 5800", "fall-2026", "spring-2027");
  assert.equal(moved.ok, true);
  if (moved.ok) {
    assert.deepEqual(moved.plan.semesters[0].courses, []);
    assert.deepEqual(moved.plan.semesters[1].courses, [{ code: "CS 5800", credits: 4 }]);
    assert.deepEqual(start.semesters[0].courses, [{ code: "CS 5800", credits: 4 }]);
  }
  assert.equal(moveCourseToSemester(start, "CS 5800", "fall-2026", "fall-2026").ok, false);
  assert.equal(moveCourseToSemester(start, "CS 5800", "fall-2026", "missing").ok, false);
});

test("suggestedPrerequisiteFix moves a later hard prereq earlier", () => {
  const plan = withCourses(emptyPlan(), {
    "fall-2027": [{ code: "CS 6140", credits: 4 }],
    "spring-2028": [{ code: "CS 5800", credits: 4 }],
  });
  const progress = validatePlan(plan, seattle);
  const issue = progress.issues.find((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140");
  assert.ok(issue);
  assert.equal(progress.satisfied, false);
  const fix = suggestedPrerequisiteFix(issue!, plan, addableProgramCodes(seattle.courses));
  assert.equal(fix?.suggestion, "move CS 5800 earlier");
  assert.deepEqual(fix?.action, { type: "move", fromId: "spring-2028", toId: "spring-2027" });
  const applied = applyPrerequisiteFix(plan, fix!, seattle.courses);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    const next = validatePlan(applied.plan, seattle);
    assert.equal(next.issues.some((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140"), false);
    assert.ok(applied.plan.semesters.find((semester) => semester.id === "spring-2027")?.courses.some((course) => course.code === "CS 5800"));
  }
});

test("suggestedPrerequisiteFix adds a missing hard prereq to the previous academic term", () => {
  const plan = withCourses(emptyPlan(), { "fall-2027": [{ code: "CS 6140", credits: 4 }] });
  const issue = validatePlan(plan, seattle).issues.find((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140");
  assert.ok(issue);
  const fix = suggestedPrerequisiteFix(issue!, plan, addableProgramCodes(seattle.courses));
  assert.equal(fix?.suggestion, "add CS 5800 to Spring 2027");
  assert.deepEqual(fix?.action, { type: "add", toId: "spring-2027" });
  const applied = applyPrerequisiteFix(plan, fix!, seattle.courses);
  assert.equal(applied.ok, true);
  if (applied.ok) {
    assert.ok(applied.plan.semesters.find((semester) => semester.id === "spring-2027")?.courses.some((course) => course.code === "CS 5800"));
    assert.equal(validatePlan(applied.plan, seattle).issues.some((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140"), false);
  }
});

test("known catalog hard prerequisites cannot silently satisfy a plan", () => {
  const plan = withCourses(emptyPlan(), { "fall-2027": [{ code: "CS 6140", credits: 4 }] });
  const progress = validatePlan(plan, seattle);
  assert.equal(progress.satisfied, false);
  assert.ok(progress.issues.some((issue) => issue.kind === "prerequisite" && issue.courseCode === "CS 6140" && issue.relatedCourses.includes("CS 5800")));
});

test("a blocked course in the first academic term has no earlier-semester Apply suggestion", () => {
  const plan = withCourses(emptyPlan(), { "fall-2026": [{ code: "CS 6140", credits: 4 }] });
  const issue = validatePlan(plan, seattle).issues.find((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140");
  assert.ok(issue);
  assert.equal(suggestedPrerequisiteFix(issue!, plan, addableProgramCodes(seattle.courses)), null);
});

test("suggestedPrerequisiteFix does not suggest Apply into a full term", () => {
  const fillers = Array.from({ length: MAX_COURSES_PER_SEMESTER }, (_, index) => ({ code: `CS ${5100 + index}`, credits: 4 }));
  const plan = withCourses(emptyPlan(), {
    "spring-2027": fillers,
    "fall-2027": [{ code: "CS 6140", credits: 4 }],
  });
  const issue = validatePlan(plan, seattle).issues.find((item) => item.kind === "prerequisite" && item.courseCode === "CS 6140");
  assert.ok(issue);
  assert.equal(suggestedPrerequisiteFix(issue!, plan, addableProgramCodes(seattle.courses)), null);
});
