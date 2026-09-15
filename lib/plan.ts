import type { PlannedCourse, Semester, StudentPlan } from "./types";

export const STORAGE_KEY = "neu-mscs-planner-plan-v1";
export const MAX_PLAN_BACKUP_BYTES = 1_000_000;

const MAX_COURSE_CODES = 256;
const MAX_CREDIT_ENTRIES = 256;
const MAX_SEMESTERS = 32;
export const MAX_COURSES_PER_SEMESTER = 32;
const MAX_CREDITS_PER_COURSE = 32;
const MAX_TEXT_LENGTH = 100;
const COURSE_CODE = /^[A-Z]{2,6} [0-9]{2,4}[A-Z]{0,2}$/;
const SEMESTER_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;

export function recordedCourseCodes(plan: StudentPlan): Set<string> {
  return new Set([
    ...plan.completedCourses,
    ...plan.waivedCourses,
    ...plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code)),
  ]);
}

export function addableLineCourses(
  codes: Iterable<string>,
  courses: Iterable<{ code: string; requirementType: string; credits: number }>,
  recorded: Iterable<string>,
): PlannedCourse[] {
  const skip = new Set(recorded);
  const catalog = new Map([...courses].map((course) => [course.code, course]));
  const added = new Set<string>();
  const items: PlannedCourse[] = [];
  for (const code of codes) {
    if (added.has(code) || skip.has(code)) continue;
    const course = catalog.get(code);
    if (!course || course.requirementType === "external") continue;
    added.add(code);
    items.push({ code: course.code, credits: course.credits });
  }
  return items;
}

export type AppendCoursesResult =
  | { ok: true; plan: StudentPlan; added: string[]; semesterName: string }
  | { ok: false; reason: "missing-term" | "capacity" | "none" };

export function appendCoursesToSemester(
  plan: StudentPlan,
  semesterId: string,
  items: readonly PlannedCourse[],
): AppendCoursesResult {
  const target = plan.semesters.find((semester) => semester.id === semesterId);
  if (!target) return { ok: false, reason: "missing-term" };
  const present = recordedCourseCodes(plan);
  const newItems = items.filter((item) => !present.has(item.code));
  if (!newItems.length) return { ok: false, reason: "none" };
  if (target.courses.length + newItems.length > MAX_COURSES_PER_SEMESTER) {
    return { ok: false, reason: "capacity" };
  }
  return {
    ok: true,
    added: newItems.map((item) => item.code),
    semesterName: target.name,
    plan: {
      ...plan,
      semesters: plan.semesters.map((semester) =>
        semester.id === semesterId ? { ...semester, courses: [...semester.courses, ...newItems] } : semester,
      ),
    },
  };
}

export function emptyPlan(): StudentPlan {
  return {
    version: 1,
    completedCourses: [],
    waivedCourses: [],
    completedCredits: {},
    semesters: [
      { id: "fall-2026", name: "Fall 2026", type: "academic", courses: [] },
      { id: "spring-2027", name: "Spring 2027", type: "academic", courses: [] },
      { id: "summer-2027-coop", name: "Summer 2027 Co-op", type: "coop", courses: [] },
      { id: "fall-2027", name: "Fall 2027", type: "academic", courses: [] },
      { id: "spring-2028", name: "Spring 2028", type: "academic", courses: [] },
    ],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(path: string, message: string): never {
  throw new Error(`Invalid saved plan at ${path}: ${message}`);
}

function parseCode(value: unknown, path: string): string {
  if (typeof value !== "string" || !COURSE_CODE.test(value)) {
    fail(path, 'expected a course code such as "CS 5010"');
  }
  return value;
}

function parseCodeArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) fail(path, "expected an array");
  if (value.length > MAX_COURSE_CODES) fail(path, `cannot contain more than ${MAX_COURSE_CODES} entries`);
  return value.map((entry, index) => parseCode(entry, `${path}[${index}]`));
}

function parseCredits(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > MAX_CREDITS_PER_COURSE
  ) {
    fail(path, `expected a finite number from 0 to ${MAX_CREDITS_PER_COURSE}`);
  }
  return value;
}

function parsePlannedCourse(value: unknown, path: string): PlannedCourse {
  if (!isRecord(value)) fail(path, "expected an object");
  const code = parseCode(value.code, `${path}.code`);
  if (value.credits === undefined) return { code };
  return { code, credits: parseCredits(value.credits, `${path}.credits`) };
}

function parseSemester(value: unknown, path: string): Semester {
  if (!isRecord(value)) fail(path, "expected an object");
  if (typeof value.id !== "string" || !SEMESTER_ID.test(value.id)) {
    fail(`${path}.id`, "expected a non-empty ID using letters, numbers, dot, colon, underscore, or hyphen");
  }
  if (
    typeof value.name !== "string" ||
    value.name.length === 0 ||
    value.name.length > MAX_TEXT_LENGTH ||
    value.name.trim() !== value.name
  ) {
    fail(`${path}.name`, `expected trimmed text from 1 to ${MAX_TEXT_LENGTH} characters`);
  }
  if (value.type !== "academic" && value.type !== "coop") {
    fail(`${path}.type`, 'expected "academic" or "coop"');
  }
  if (!Array.isArray(value.courses)) fail(`${path}.courses`, "expected an array");
  if (value.courses.length > MAX_COURSES_PER_SEMESTER) {
    fail(`${path}.courses`, `cannot contain more than ${MAX_COURSES_PER_SEMESTER} entries`);
  }
  return {
    id: value.id,
    name: value.name,
    type: value.type,
    courses: value.courses.map((course, index) => parsePlannedCourse(course, `${path}.courses[${index}]`)),
  };
}

export function parsePlan(input: unknown): StudentPlan {
  if (!isRecord(input)) fail("plan", "expected an object");
  if (input.version !== 1) fail("plan.version", "expected version 1");

  const completedCourses = parseCodeArray(input.completedCourses, "plan.completedCourses");
  const waivedCourses = parseCodeArray(input.waivedCourses, "plan.waivedCourses");

  if (!isRecord(input.completedCredits)) fail("plan.completedCredits", "expected an object");
  const creditEntries = Object.entries(input.completedCredits);
  if (creditEntries.length > MAX_CREDIT_ENTRIES) {
    fail("plan.completedCredits", `cannot contain more than ${MAX_CREDIT_ENTRIES} entries`);
  }
  const completedCredits: Record<string, number> = {};
  for (const [rawCode, rawCredits] of creditEntries) {
    const code = parseCode(rawCode, `plan.completedCredits.${rawCode}`);
    completedCredits[code] = parseCredits(rawCredits, `plan.completedCredits.${code}`);
  }

  if (!Array.isArray(input.semesters)) fail("plan.semesters", "expected an array");
  if (input.semesters.length > MAX_SEMESTERS) {
    fail("plan.semesters", `cannot contain more than ${MAX_SEMESTERS} entries`);
  }
  const semesters = input.semesters.map((semester, index) => parseSemester(semester, `plan.semesters[${index}]`));
  const ids = new Set<string>();
  for (const semester of semesters) {
    if (ids.has(semester.id)) fail("plan.semesters", `semester ID "${semester.id}" is duplicated`);
    ids.add(semester.id);
  }

  return { version: 1, completedCourses, waivedCourses, completedCredits, semesters };
}

function backupSize(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function serializePlanBackup(plan: StudentPlan): string {
  const backup = JSON.stringify(parsePlan(plan));
  if (backupSize(backup) > MAX_PLAN_BACKUP_BYTES) {
    throw new Error("Plan backup is too large.");
  }
  return backup;
}

export function parsePlanBackup(text: string): StudentPlan {
  if (backupSize(text) > MAX_PLAN_BACKUP_BYTES) {
    throw new Error("Plan backup is too large.");
  }
  try {
    return parsePlan(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Plan backup must be valid JSON.");
    throw error;
  }
}

export function restorePlan(storage: Pick<Storage, "setItem">, candidate: unknown): StudentPlan {
  const restored = parsePlan(candidate);
  storage.setItem(STORAGE_KEY, JSON.stringify(restored));
  return restored;
}

export function loadPlan(storage: Pick<Storage, "getItem">): { plan: StudentPlan; error: string | null } {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored === null) return { plan: emptyPlan(), error: null };
    if (typeof stored !== "string") throw new Error("storage returned a non-text value");
    return { plan: parsePlan(JSON.parse(stored)), error: null };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown storage error";
    return { plan: emptyPlan(), error: `Could not load the saved plan: ${detail}` };
  }
}
