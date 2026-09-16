import { recordedCourseCodes } from "./plan";
import type { Catalog, Course, DegreeProgress, PlanIssue, StudentPlan } from "./types";
import { getEligibility } from "./validation";

const PREREQ_KINDS = new Set<PlanIssue["kind"]>(["prerequisite", "corequisite"]);

export function criticalPrereqIssue(issues: readonly PlanIssue[]): PlanIssue | null {
  const relevant = issues.filter((issue) => PREREQ_KINDS.has(issue.kind));
  return relevant.find((issue) => issue.severity === "error") ?? relevant[0] ?? null;
}

export function nextUnlockCourse(
  catalog: Catalog,
  plan: StudentPlan,
): { course: Course; unlocks: string[] } | null {
  const recorded = recordedCourseCodes(plan);
  const prior = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  const ranked = catalog.courses
    .filter((course) => course.requirementType !== "external" && !recorded.has(course.code))
    .filter((course) => getEligibility(course, prior).status === "eligible")
    .map((course) => ({
      course,
      unlocks: course.unlocks.filter((code) => !recorded.has(code)),
    }))
    .sort(
      (a, b) =>
        b.unlocks.length - a.unlocks.length ||
        a.course.code.localeCompare(b.course.code, undefined, { numeric: true }),
    );
  return ranked[0] ?? null;
}

export function overviewSnapshot(input: {
  catalog: Catalog;
  plan: StudentPlan;
  progress: DegreeProgress;
  targetName: string | null;
}) {
  const next = nextUnlockCourse(input.catalog, input.plan);
  const critical = criticalPrereqIssue(input.progress.issues);
  return {
    credits: { current: input.progress.totalCredits, required: input.catalog.requirements.totalCredits },
    targetName: input.targetName,
    criticalPrereq: critical ? { courseCode: critical.courseCode, message: critical.message } : null,
    nextUnlock: next
      ? { code: next.course.code, title: next.course.title, unlocks: next.unlocks }
      : null,
  };
}
