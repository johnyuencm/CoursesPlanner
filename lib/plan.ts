import type { PlannedCourse, PlanIssue, Semester, StudentPlan } from "./types";
import type { TermPlacement } from "./target-path";
import { termSlug } from "./target-path";

export const STORAGE_KEY = "neu-mscs-planner-plan-v1";
export const MAX_PLAN_BACKUP_BYTES = 1_000_000;

const MAX_COURSE_CODES = 256;
const MAX_CREDIT_ENTRIES = 256;
export const MAX_SEMESTERS = 32;
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

export type ApplyRemainingPathResult =
  | { ok: true; plan: StudentPlan; added: string[]; createdTerms: string[] }
  | { ok: false; reason: "capacity" | "missing-term" | "semester-limit"; plan: StudentPlan; added: []; createdTerms: []; semesterName?: string };

export function applyRemainingPathToPlan(
  plan: StudentPlan,
  courses: Iterable<{ code: string; requirementType: string; credits: number }>,
  placements: readonly TermPlacement[],
): ApplyRemainingPathResult {
  const original = plan;
  const catalog = [...courses];
  let next = plan;
  const createdTerms: string[] = [];
  const resolved: TermPlacement[] = [];
  for (const placement of placements) {
    if (placement.semesterId && next.semesters.some((semester) => semester.id === placement.semesterId)) {
      resolved.push(placement);
      continue;
    }
    const existing = next.semesters.find((semester) => semester.name === placement.termName && semester.type === "academic");
    if (existing) {
      resolved.push({ ...placement, semesterId: existing.id });
      continue;
    }
    if (next.semesters.length >= MAX_SEMESTERS) {
      return { ok: false, reason: "semester-limit", plan: original, added: [], createdTerms: [] };
    }
    let id = termSlug(placement.termName);
    if (next.semesters.some((semester) => semester.id === id)) id = `${id}-${next.semesters.length}`;
    next = {
      ...next,
      semesters: [...next.semesters, { id, name: placement.termName, type: "academic", courses: [] }],
    };
    createdTerms.push(placement.termName);
    resolved.push({ ...placement, semesterId: id });
  }
  const added: string[] = [];
  const byTerm = new Map<string, TermPlacement[]>();
  for (const placement of resolved) {
    if (!placement.semesterId) continue;
    const group = byTerm.get(placement.semesterId) ?? [];
    group.push(placement);
    byTerm.set(placement.semesterId, group);
  }
  for (const [semesterId, group] of byTerm) {
    const items = addableLineCourses(
      group.map((item) => item.code),
      catalog,
      recordedCourseCodes(next),
    );
    if (!items.length) continue;
    const result = appendCoursesToSemester(next, semesterId, items);
    if (!result.ok) {
      if (result.reason === "none") continue;
      return {
        ok: false,
        reason: result.reason,
        plan: original,
        added: [],
        createdTerms: [],
        semesterName: next.semesters.find((semester) => semester.id === semesterId)?.name,
      };
    }
    next = result.plan;
    added.push(...result.added);
  }
  return { ok: true, plan: next, added, createdTerms };
}

export type MoveCourseResult =
  | { ok: true; plan: StudentPlan; semesterName: string }
  | { ok: false; reason: "same-term" | "missing-source" | "missing-term" | "capacity" | "duplicate" };

export function moveCourseToSemester(
  plan: StudentPlan,
  code: string,
  fromId: string,
  targetId: string,
): MoveCourseResult {
  if (fromId === targetId) return { ok: false, reason: "same-term" };
  const source = plan.semesters.find((semester) => semester.id === fromId);
  const target = plan.semesters.find((semester) => semester.id === targetId);
  if (!source) return { ok: false, reason: "missing-source" };
  if (!target) return { ok: false, reason: "missing-term" };
  const item = source.courses.find((course) => course.code === code);
  if (!item) return { ok: false, reason: "missing-source" };
  if (target.courses.some((course) => course.code === code)) return { ok: false, reason: "duplicate" };
  if (target.courses.length >= MAX_COURSES_PER_SEMESTER) return { ok: false, reason: "capacity" };
  return {
    ok: true,
    semesterName: target.name,
    plan: {
      ...plan,
      semesters: plan.semesters.map((semester) =>
        semester.id === fromId
          ? { ...semester, courses: semester.courses.filter((course) => course.code !== code) }
          : semester.id === targetId
            ? { ...semester, courses: [...semester.courses, item] }
            : semester,
      ),
    },
  };
}

function lastAcademicBefore(plan: StudentPlan, semesterId: string): Semester | undefined {
  const index = plan.semesters.findIndex((semester) => semester.id === semesterId);
  if (index <= 0) return undefined;
  return plan.semesters.slice(0, index).findLast((semester) => semester.type === "academic");
}

function plannedSemesterOf(plan: StudentPlan, code: string): { semester: Semester; index: number } | undefined {
  const index = plan.semesters.findIndex((semester) => semester.courses.some((course) => course.code === code));
  if (index < 0) return undefined;
  return { semester: plan.semesters[index]!, index };
}

export type PrerequisiteFix = {
  issueCourseCode: string;
  issueSemesterId: string;
  relatedCode: string;
  suggestion: string;
  detail: string;
  action: { type: "move"; fromId: string; toId: string } | { type: "add"; toId: string };
};

export type ApplyFixResult =
  | { ok: true; plan: StudentPlan; message: string }
  | { ok: false; reason: Extract<MoveCourseResult, { ok: false }>["reason"] | Extract<AppendCoursesResult, { ok: false }>["reason"] };

function pickRelatedCode(
  relatedCourses: readonly string[],
  plan: StudentPlan,
  issueIndex: number,
  addable: ReadonlySet<string>,
): string | undefined {
  const ranked = relatedCourses.map((code) => ({
    code,
    index: plan.semesters.findIndex((semester) => semester.courses.some((course) => course.code === code)),
  }));
  const plannedLater = ranked.find((item) => item.index >= issueIndex);
  if (plannedLater) return plannedLater.code;
  const unplanned = ranked.find((item) => item.index < 0 && (!addable.size || addable.has(item.code)));
  if (unplanned) return unplanned.code;
  return ranked.find((item) => !addable.size || addable.has(item.code))?.code ?? relatedCourses[0];
}

/** Suggested semester repair for a catalog prereq/coreq issue. Null when no earlier (or same-term coreq) academic term exists. */
export function suggestedPrerequisiteFix(
  issue: Pick<PlanIssue, "kind" | "courseCode" | "semesterId" | "relatedCourses">,
  plan: StudentPlan,
  addableCodes: Iterable<string> = [],
): PrerequisiteFix | null {
  if ((issue.kind !== "prerequisite" && issue.kind !== "corequisite") || !issue.semesterId || !issue.relatedCourses.length) {
    return null;
  }
  const issueIndex = plan.semesters.findIndex((semester) => semester.id === issue.semesterId);
  if (issueIndex < 0) return null;
  const issueTerm = plan.semesters[issueIndex]!;
  const resolutionTerm = issue.kind === "corequisite" ? issueTerm : lastAcademicBefore(plan, issue.semesterId);
  if (!resolutionTerm || resolutionTerm.courses.length >= MAX_COURSES_PER_SEMESTER) return null;
  const addable = addableCodes instanceof Set ? addableCodes : new Set(addableCodes);
  const relatedCode = pickRelatedCode(issue.relatedCourses, plan, issueIndex, addable);
  if (!relatedCode) return null;
  const current = plannedSemesterOf(plan, relatedCode);
  if (current) {
    const needsMove = issue.kind === "corequisite" ? current.semester.id !== resolutionTerm.id : current.index >= issueIndex;
    if (!needsMove || current.semester.id === resolutionTerm.id) return null;
    return {
      issueCourseCode: issue.courseCode,
      issueSemesterId: issue.semesterId,
      relatedCode,
      suggestion: `move ${relatedCode} earlier`,
      detail: `Move ${relatedCode} to ${resolutionTerm.name}`,
      action: { type: "move", fromId: current.semester.id, toId: resolutionTerm.id },
    };
  }
  if (addable.size && !addable.has(relatedCode)) return null;
  return {
    issueCourseCode: issue.courseCode,
    issueSemesterId: issue.semesterId,
    relatedCode,
    suggestion: `add ${relatedCode} to ${resolutionTerm.name}`,
    detail: `Add ${relatedCode} to ${resolutionTerm.name}`,
    action: { type: "add", toId: resolutionTerm.id },
  };
}

export function applyPrerequisiteFix(
  plan: StudentPlan,
  fix: PrerequisiteFix,
  courses: Iterable<{ code: string; requirementType: string; credits: number }>,
): ApplyFixResult {
  if (fix.action.type === "move") {
    const moved = moveCourseToSemester(plan, fix.relatedCode, fix.action.fromId, fix.action.toId);
    if (!moved.ok) return moved;
    return { ok: true, plan: moved.plan, message: `${fix.detail}.` };
  }
  const items = addableLineCourses([fix.relatedCode], courses, recordedCourseCodes(plan));
  const added = appendCoursesToSemester(plan, fix.action.toId, items);
  if (!added.ok) return added;
  return { ok: true, plan: added.plan, message: `${fix.detail}.` };
}

export function addableProgramCodes(courses: Iterable<{ code: string; requirementType: string }>): string[] {
  return [...courses].filter((course) => course.requirementType !== "external").map((course) => course.code);
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

export const PLAN_BACKUP_FILENAME = "course-plan-backup.json";
export const PLAN_RECOVERY_FILENAME = "course-plan-storage-recovery.txt";

export type PlanBackupDownload =
  | {
      kind: "backup";
      filename: typeof PLAN_BACKUP_FILENAME;
      body: string;
      mimeType: "application/json";
      message: string;
    }
  | {
      kind: "recovery";
      filename: typeof PLAN_RECOVERY_FILENAME;
      body: string;
      mimeType: "text/plain";
      message: string;
    };

export interface PlanBackupSummary {
  termCount: number;
  plannedCourseCount: number;
  completedCount: number;
  waivedCount: number;
  terms: { id: string; name: string; type: Semester["type"]; courseCodes: string[] }[];
  completedCourses: string[];
  waivedCourses: string[];
}

export function serializePlanBackup(plan: StudentPlan): string {
  const backup = JSON.stringify(parsePlan(plan));
  if (backupSize(backup) > MAX_PLAN_BACKUP_BYTES) {
    throw new Error("Plan backup is too large.");
  }
  return backup;
}

export function createPlanBackupDownload(input: {
  blocked: boolean;
  plan: StudentPlan;
  rawStored: string | null;
}): PlanBackupDownload {
  if (input.blocked) {
    if (input.rawStored == null || input.rawStored === "") {
      throw new Error(
        "Saved plan data is unreadable, so a backup was not created from the empty on-screen plan. The original browser data was not overwritten.",
      );
    }
    return {
      kind: "recovery",
      filename: PLAN_RECOVERY_FILENAME,
      body: input.rawStored,
      mimeType: "text/plain",
      message:
        "Downloaded a recovery copy of the unreadable saved data. This is not a validated plan backup. Do not restore it unless you have inspected the file. The empty on-screen plan was not exported.",
    };
  }
  return {
    kind: "backup",
    filename: PLAN_BACKUP_FILENAME,
    body: serializePlanBackup(input.plan),
    mimeType: "application/json",
    message: "Backup downloaded. This is separate from the saved-on-this-device status.",
  };
}

export function summarizePlan(plan: StudentPlan): PlanBackupSummary {
  return {
    termCount: plan.semesters.length,
    plannedCourseCount: plan.semesters.reduce((count, semester) => count + semester.courses.length, 0),
    completedCount: plan.completedCourses.length,
    waivedCount: plan.waivedCourses.length,
    terms: plan.semesters.map((semester) => ({
      id: semester.id,
      name: semester.name,
      type: semester.type,
      courseCodes: semester.courses.map((course) => course.code),
    })),
    completedCourses: [...plan.completedCourses],
    waivedCourses: [...plan.waivedCourses],
  };
}

export function isCatalogOutage(input: {
  hydrated: boolean;
  catalogAvailable: boolean;
  catalogBusy: boolean;
}): boolean {
  return input.hydrated && !input.catalogAvailable && !input.catalogBusy;
}

export function canRestorePlanBackup(input: {
  hydrated: boolean;
  catalogAvailable: boolean;
  catalogBusy: boolean;
  acknowledgedOutageRestore: boolean;
}): boolean {
  if (!input.hydrated) return false;
  if (input.catalogAvailable) return true;
  if (input.catalogBusy) return false;
  return input.acknowledgedOutageRestore;
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

export function loadPlan(storage: Pick<Storage, "getItem">): {
  plan: StudentPlan;
  error: string | null;
  raw: string | null;
} {
  let stored: string | null = null;
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (value === null) return { plan: emptyPlan(), error: null, raw: null };
    if (typeof value !== "string") throw new Error("storage returned a non-text value");
    stored = value;
    return { plan: parsePlan(JSON.parse(stored)), error: null, raw: stored };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown storage error";
    return { plan: emptyPlan(), error: `Could not load the saved plan: ${detail}`, raw: stored };
  }
}
