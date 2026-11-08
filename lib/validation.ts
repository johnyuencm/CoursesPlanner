import type {
  Catalog,
  Course,
  Eligibility,
  PlanIssue,
  RequirementExpression,
  StudentPlan,
} from "./types";

function unique(values: Iterable<string>): string[] {
  return [...new Set(values)];
}

function formatExpression(expression: RequirementExpression): string {
  switch (expression.type) {
    case "none":
      return "no requirement";
    case "unknown":
      return `unverified requirement: ${expression.text || "unspecified text"}`;
    case "course": {
      const details: string[] = [];
      if (expression.minimumGrade) details.push(`minimum grade ${expression.minimumGrade}`);
      if (expression.concurrent) details.push("concurrent enrollment allowed");
      return details.length ? `${expression.code} (${details.join(", ")})` : expression.code;
    }
    case "all":
    case "any": {
      if (expression.items.length === 0) {
        return expression.type === "all" ? "all of an empty requirement list" : "one of an empty requirement list";
      }
      const operator = expression.type === "all" ? " AND " : " OR ";
      return `(${expression.items.map(formatExpression).join(operator)})`;
    }
  }
}

export function expressionLabel(expression: RequirementExpression): string {
  return formatExpression(expression);
}

export function evaluateRequirement(
  expression: RequirementExpression,
  prior: Set<string>,
  concurrent: Set<string> = new Set<string>(),
): Eligibility {
  switch (expression.type) {
    case "none":
      return { status: "eligible", missing: [], reasons: [] };
    case "unknown":
      return {
        status: "uncertain",
        missing: [],
        reasons: [`Could not verify ${expressionLabel(expression)}.`],
      };
    case "course": {
      if (prior.has(expression.code)) {
        const reasons = expression.minimumGrade
          ? [`Completion of ${expression.code} is treated as attesting the ${expression.minimumGrade} minimum grade.`]
          : [];
        return { status: "eligible", missing: [], reasons };
      }
      if (expression.concurrent && concurrent.has(expression.code)) {
        return {
          status: "eligible",
          missing: [],
          reasons: [
            expression.minimumGrade
              ? `${expression.code} may be taken concurrently; completion must meet the ${expression.minimumGrade} minimum grade.`
              : `${expression.code} may be taken concurrently.`,
          ],
        };
      }
      return {
        status: "locked",
        missing: [expression.code],
        reasons: [`Missing ${expressionLabel(expression)}.`],
      };
    }
    case "all": {
      if (expression.items.length === 0) return { status: "eligible", missing: [], reasons: [] };
      const results = expression.items.map((item) => evaluateRequirement(item, prior, concurrent));
      if (results.every((result) => result.status === "eligible")) {
        return {
          status: "eligible",
          missing: [],
          reasons: results.flatMap((result) => result.reasons),
        };
      }
      const status = results.some((result) => result.status === "locked") ? "locked" : "uncertain";
      return {
        status,
        missing: unique(results.flatMap((result) => result.missing)),
        reasons: [
          `Requires all of ${expressionLabel(expression)}.`,
          ...results.filter((result) => result.status !== "eligible").flatMap((result) => result.reasons),
        ],
      };
    }
    case "any": {
      if (expression.items.length === 0) {
        return { status: "locked", missing: [], reasons: ["No prerequisite alternatives were listed."] };
      }
      const results = expression.items.map((item) => evaluateRequirement(item, prior, concurrent));
      const eligible = results.find((result) => result.status === "eligible");
      if (eligible) return { status: "eligible", missing: [], reasons: eligible.reasons };
      const status = results.every((result) => result.status === "locked") ? "locked" : "uncertain";
      return {
        status,
        missing: unique(results.flatMap((result) => result.missing)),
        reasons: [
          `Requires one of the alternatives in ${expressionLabel(expression)}.`,
          ...results.flatMap((result) => result.reasons),
        ],
      };
    }
  }
}

export function getEligibility(
  course: Course,
  prior: Set<string>,
  concurrent: Set<string> = new Set<string>(),
): Eligibility {
  const eligibility = evaluateRequirement(course.prerequisites, prior, concurrent);
  if (course.corequisites.type === "none") return eligibility;
  return {
    ...eligibility,
    reasons: [
      ...eligibility.reasons,
      `Corequisite audited separately: ${expressionLabel(course.corequisites)}.`,
    ],
  };
}

function expressionCodes(expression: RequirementExpression): Set<string> {
  switch (expression.type) {
    case "course":
      return new Set([expression.code]);
    case "all":
    case "any":
      return new Set(expression.items.flatMap((item) => [...expressionCodes(item)]));
    case "none":
    case "unknown":
      return new Set();
  }
}

export function dependencyClosure(
  code: string,
  courses: Course[],
  direction: "upstream" | "downstream",
): Set<string> {
  const upstream = new Map<string, Set<string>>();
  for (const course of courses) {
    upstream.set(
      course.code,
      new Set([
        ...expressionCodes(course.prerequisites),
        ...expressionCodes(course.corequisites),
        ...course.prerequisiteCodes,
        ...course.corequisiteCodes,
      ]),
    );
  }

  const graph = direction === "upstream" ? upstream : new Map<string, Set<string>>();
  if (direction === "downstream") {
    for (const course of courses) {
      if (!graph.has(course.code)) graph.set(course.code, new Set());
      for (const dependency of upstream.get(course.code) ?? []) {
        const unlocked = graph.get(dependency) ?? new Set<string>();
        unlocked.add(course.code);
        graph.set(dependency, unlocked);
      }
      for (const unlockedCode of course.unlocks) {
        const unlocked = graph.get(course.code) ?? new Set<string>();
        unlocked.add(unlockedCode);
        graph.set(course.code, unlocked);
      }
    }
  }

  const result = new Set<string>();
  const visited = new Set([code]);
  const queue = [code];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of graph.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      result.add(next);
      queue.push(next);
    }
  }
  return result;
}

export interface CountedCourse {
  code: string;
  credits: number;
  source: "earned" | "planned";
}

/** Result of the plan pass that every requirement model shares. */
export interface PlanCourseAudit {
  issues: PlanIssue[];
  /** Completed and valid planned degree courses with resolved credits; each code once. */
  counted: CountedCourse[];
  completed: Set<string>;
  waived: Set<string>;
  validPlanned: Set<string>;
}

/**
 * Checks duplicates, credits, unknown codes, prerequisites and corequisites.
 * Only codes in `degreeCodes` earn degree credit.
 */
export function auditPlanCourses(plan: StudentPlan, catalog: Catalog, degreeCodes: Set<string>): PlanCourseAudit {
  const courseByCode = new Map(catalog.courses.map((course) => [course.code, course]));
  const issues: PlanIssue[] = [];
  const counted: CountedCourse[] = [];

  const addIssue = (
    kind: PlanIssue["kind"],
    severity: PlanIssue["severity"],
    courseCode: string,
    message: string,
    relatedCourses: string[] = [],
    semesterId?: string,
  ) => issues.push({ kind, severity, courseCode, semesterId, message, relatedCourses });

  const completedSet = new Set<string>();
  for (const code of plan.completedCourses) {
    if (completedSet.has(code)) {
      addIssue("duplicate", "error", code, `${code} appears more than once in completed courses.`, [code]);
    }
    completedSet.add(code);
  }

  const waivedSet = new Set<string>();
  for (const code of plan.waivedCourses) {
    if (waivedSet.has(code)) {
      addIssue("duplicate", "error", code, `${code} appears more than once in waived courses.`, [code]);
    }
    waivedSet.add(code);
  }
  for (const code of completedSet) {
    if (waivedSet.has(code)) {
      addIssue("duplicate", "error", code, `${code} is marked both completed and waived.`, [code]);
    }
  }

  for (const code of Object.keys(plan.completedCredits)) {
    if (!completedSet.has(code)) {
      addIssue("credits", "error", code, `Completed credits were recorded for ${code}, but the course is not completed.`, [code]);
    }
  }

  const resolveCredits = (
    course: Course,
    selected: number | undefined,
    source: "completed" | "planned",
    semesterId?: string,
  ): number | null => {
    const minimum = course.credits;
    const maximum = course.maxCredits;
    if (
      !Number.isFinite(minimum) ||
      minimum < 0 ||
      (maximum !== undefined && (!Number.isFinite(maximum) || maximum < minimum))
    ) {
      addIssue("credits", "error", course.code, `${course.code} has invalid catalog credit bounds.`, [course.code], semesterId);
      return null;
    }
    const variable = maximum !== undefined && maximum > minimum;
    if (variable) {
      if (selected === undefined) {
        addIssue(
          "credits",
          "error",
          course.code,
          `${source === "completed" ? "Completed" : "Planned"} variable-credit course ${course.code} requires an explicit credit selection.`,
          [course.code],
          semesterId,
        );
        return null;
      }
      if (!Number.isFinite(selected) || selected < minimum || selected > maximum) {
        addIssue(
          "credits",
          "error",
          course.code,
          `${course.code} credits must be between ${minimum} and ${maximum}.`,
          [course.code],
          semesterId,
        );
        return null;
      }
      return selected;
    }
    if (selected !== undefined && (!Number.isFinite(selected) || selected !== minimum)) {
      addIssue(
        "credits",
        "error",
        course.code,
        `${course.code} is fixed at ${minimum} credits; the ${String(selected)}-credit override was ignored.`,
        [course.code],
        semesterId,
      );
    }
    return minimum;
  };

  for (const code of completedSet) {
    const course = courseByCode.get(code);
    if (!course) {
      addIssue("unknown", "warning", code, `${code} is not in the current catalog and earns no degree credit.`, [code]);
      continue;
    }
    const selected = Object.prototype.hasOwnProperty.call(plan.completedCredits, code)
      ? plan.completedCredits[code]
      : undefined;
    const credits = resolveCredits(course, selected, "completed");
    if (credits !== null && degreeCodes.has(code)) counted.push({ code, credits, source: "earned" });
  }
  for (const code of waivedSet) {
    if (!courseByCode.has(code)) {
      addIssue("unknown", "warning", code, `${code} is waived but is not in the current catalog.`, [code]);
    }
  }

  const prior = new Set([...completedSet, ...waivedSet]);
  const plannedSeen = new Set<string>();
  const validPlanned = new Set<string>();

  for (const semester of plan.semesters) {
    const concurrent = new Set(semester.courses.map((course) => course.code));
    const validThisSemester = new Set<string>();
    for (const planned of semester.courses) {
      const code = planned.code;
      if (completedSet.has(code)) {
        addIssue("duplicate", "error", code, `${code} is both completed and planned.`, [code], semester.id);
        continue;
      }
      if (plannedSeen.has(code)) {
        addIssue("duplicate", "error", code, `${code} is planned more than once.`, [code], semester.id);
        continue;
      }
      plannedSeen.add(code);

      const course = courseByCode.get(code);
      if (!course) {
        addIssue("unknown", "warning", code, `${code} is not in the current catalog and earns no degree credit.`, [code], semester.id);
        continue;
      }

      const prerequisite = evaluateRequirement(course.prerequisites, prior, concurrent);
      if (prerequisite.status !== "eligible") {
        addIssue(
          "prerequisite",
          prerequisite.status === "locked" ? "error" : "warning",
          code,
          `${prerequisite.status === "locked" ? "Prerequisite not met" : "Prerequisite could not be verified"}: ${expressionLabel(course.prerequisites)}. ${prerequisite.reasons.join(" ")}`,
          prerequisite.missing,
          semester.id,
        );
      }

      const priorOrConcurrent = new Set([...prior, ...concurrent]);
      const corequisite = evaluateRequirement(course.corequisites, priorOrConcurrent);
      if (corequisite.status !== "eligible") {
        addIssue(
          "corequisite",
          corequisite.status === "locked" ? "error" : "warning",
          code,
          `${corequisite.status === "locked" ? "Corequisite not met" : "Corequisite could not be verified"}: ${expressionLabel(course.corequisites)}. ${corequisite.reasons.join(" ")}`,
          corequisite.missing,
          semester.id,
        );
      }

      const credits = resolveCredits(course, planned.credits, "planned", semester.id);
      const academicallyEligible = prerequisite.status === "eligible" && corequisite.status === "eligible";
      if (academicallyEligible) {
        validThisSemester.add(code);
        validPlanned.add(code);
        if (credits !== null && degreeCodes.has(code)) counted.push({ code, credits, source: "planned" });
      }
    }
    for (const code of validThisSemester) prior.add(code);
  }

  return { issues, counted, completed: completedSet, waived: waivedSet, validPlanned };
}

export function sumCredits(courses: CountedCourse[], source?: CountedCourse["source"]): number {
  return courses
    .filter((course) => source === undefined || course.source === source)
    .reduce((sum, course) => sum + course.credits, 0);
}

export function auditNotes(minimumGpa: number | undefined, uncertainties: string[], warnings: string[]): string[] {
  return unique([
    "Course completion is the student's attestation that applicable minimum-grade requirements were met.",
    minimumGpa === undefined
      ? "Grade floors and advisor or department approvals require an official university audit and are not verified here."
      : `The ${minimumGpa} minimum GPA, grade floors, and advisor or department approvals require an official university audit and are not verified here.`,
    "Course offerings and semester availability are unknown and are not verified by this planner.",
    "Waivers satisfy only the named course requirement or prerequisite; they award no credits and do not count toward breadth or electives.",
    ...uncertainties,
    ...warnings,
  ]);
}

/** Errors, unknown courses, and unverifiable prerequisites block a satisfied audit. */
export function hasBlockingIssue(issues: PlanIssue[]): boolean {
  return issues.some(
    (issue) =>
      issue.severity === "error" ||
      issue.kind === "unknown" ||
      ((issue.kind === "prerequisite" || issue.kind === "corequisite") && issue.severity === "warning"),
  );
}
