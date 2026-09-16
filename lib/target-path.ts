import type { Course, RequirementExpression, Semester, StudentPlan } from "./types";

export type TargetPathRole = "completed" | "planned" | "remaining" | "target";

export interface TargetPathNode {
  code: string;
  role: TargetPathRole;
}

export interface TargetPathEdge {
  from: string;
  to: string;
  concurrent: boolean;
}

export interface TargetPath {
  target: string;
  status: "ok" | "unknown-course" | "cyclic" | "missing-data";
  nodes: TargetPathNode[];
  remainingCodes: string[];
  edges: TargetPathEdge[];
  cyclic: boolean;
  uncertain: boolean;
  missingCatalog: string[];
}

export interface TermPlacement {
  code: string;
  termName: string;
  semesterId: string | null;
}

export interface EarliestTerm {
  remainingCount: number;
  termName: string | null;
  semesterId: string | null;
  reason:
    | "ok"
    | "unknown-course"
    | "cyclic"
    | "missing-data"
    | "already-recorded"
    | "no-academic-term"
    | "no-matching-offering";
  summary: string;
  placements: TermPlacement[];
  usedOfferings: boolean;
}

export interface TargetPathSnapshot {
  path: TargetPath;
  earliest: EarliestTerm;
}

interface Walk {
  remaining: string[];
  ancestors: string[];
  edges: TargetPathEdge[];
  cyclic: boolean;
  uncertain: boolean;
  missing: string[];
}

const emptyWalk = (): Walk => ({
  remaining: [],
  ancestors: [],
  edges: [],
  cyclic: false,
  uncertain: false,
  missing: [],
});

function unique(codes: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const code of codes) {
    if (seen.has(code)) continue;
    seen.add(code);
    result.push(code);
  }
  return result;
}

function mergeWalks(walks: Walk[]): Walk {
  return {
    remaining: unique(walks.flatMap((walk) => walk.remaining)),
    ancestors: unique(walks.flatMap((walk) => walk.ancestors)),
    edges: walks.flatMap((walk) => walk.edges),
    cyclic: walks.some((walk) => walk.cyclic),
    uncertain: walks.some((walk) => walk.uncertain),
    missing: unique(walks.flatMap((walk) => walk.missing)),
  };
}

function walkCost(
  walk: Walk,
  courses: Map<string, Course>,
): [number, number, number, number, string] {
  const external = walk.remaining.filter((code) => {
    const course = courses.get(code);
    return !course || course.requirementType === "external";
  }).length;
  return [
    walk.cyclic ? 1 : 0,
    external,
    walk.remaining.length,
    walk.missing.length,
    walk.remaining[0] ?? walk.ancestors[0] ?? "",
  ];
}

function cheaper(left: Walk, right: Walk, courses: Map<string, Course>): Walk {
  const a = walkCost(left, courses);
  const b = walkCost(right, courses);
  for (let index = 0; index < a.length; index++) {
    if (a[index] < b[index]) return left;
    if (a[index] > b[index]) return right;
  }
  return left;
}

function roleOf(code: string, history: Set<string>, planned: Set<string>): Exclude<TargetPathRole, "target"> {
  if (history.has(code)) return "completed";
  if (planned.has(code)) return "planned";
  return "remaining";
}

function chooseExpression(
  expression: RequirementExpression,
  courses: Map<string, Course>,
  history: Set<string>,
  planned: Set<string>,
  visiting: Set<string>,
  memo: Map<string, Walk>,
  parent: string,
): Walk {
  switch (expression.type) {
    case "none":
      return emptyWalk();
    case "unknown":
      return { ...emptyWalk(), uncertain: true };
    case "course": {
      const recorded = history.has(expression.code) || planned.has(expression.code);
      if (recorded) {
        return {
          remaining: [],
          ancestors: [expression.code],
          edges: [{ from: expression.code, to: parent, concurrent: Boolean(expression.concurrent) }],
          cyclic: false,
          uncertain: false,
          missing: [],
        };
      }
      const inner = walkCourse(expression.code, courses, history, planned, visiting, memo);
      return {
        remaining: unique([...inner.remaining, expression.code]),
        ancestors: unique([...inner.ancestors, expression.code]),
        edges: [
          ...inner.edges,
          { from: expression.code, to: parent, concurrent: Boolean(expression.concurrent) },
        ],
        cyclic: inner.cyclic,
        uncertain: inner.uncertain,
        missing: inner.missing,
      };
    }
    case "all":
      if (!expression.items.length) return emptyWalk();
      return mergeWalks(
        expression.items.map((item) =>
          chooseExpression(item, courses, history, planned, visiting, memo, parent),
        ),
      );
    case "any": {
      if (!expression.items.length) return emptyWalk();
      const options = expression.items.map((item) =>
        chooseExpression(item, courses, history, planned, visiting, memo, parent),
      );
      const satisfied = options.find((option) => !option.cyclic && option.remaining.length === 0);
      if (satisfied) return satisfied;
      return options.reduce((left, right) => cheaper(left, right, courses));
    }
  }
}

function walkCourse(
  code: string,
  courses: Map<string, Course>,
  history: Set<string>,
  planned: Set<string>,
  visiting: Set<string>,
  memo: Map<string, Walk>,
): Walk {
  const cached = memo.get(code);
  if (cached) return cached;
  if (visiting.has(code)) return { ...emptyWalk(), cyclic: true };
  visiting.add(code);
  const course = courses.get(code);
  if (!course) {
    visiting.delete(code);
    const recorded = history.has(code) || planned.has(code);
    const result: Walk = {
      remaining: recorded ? [] : [code],
      ancestors: recorded ? [code] : [],
      edges: [],
      cyclic: false,
      uncertain: true,
      missing: [code],
    };
    if (recorded) memo.set(code, emptyWalk());
    return result;
  }
  if (history.has(code) || planned.has(code)) {
    visiting.delete(code);
    const result = emptyWalk();
    memo.set(code, result);
    return result;
  }
  const chosen = chooseExpression(course.prerequisites, courses, history, planned, visiting, memo, code);
  const coreqWalks: Walk[] = [];
  for (const coreq of course.corequisiteCodes) {
    if (coreq === code || visiting.has(coreq)) continue;
    if (history.has(coreq) || planned.has(coreq)) {
      coreqWalks.push({
        remaining: [],
        ancestors: [coreq],
        edges: [{ from: coreq, to: code, concurrent: true }],
        cyclic: false,
        uncertain: false,
        missing: [],
      });
      continue;
    }
    coreqWalks.push({
      remaining: [coreq],
      ancestors: [coreq],
      edges: [{ from: coreq, to: code, concurrent: true }],
      cyclic: false,
      uncertain: !courses.has(coreq),
      missing: courses.has(coreq) ? [] : [coreq],
    });
  }
  const merged = mergeWalks([chosen, ...coreqWalks]);
  visiting.delete(code);
  memo.set(code, merged);
  return merged;
}

function topologicalOrder(codes: readonly string[], edges: readonly TargetPathEdge[]): string[] {
  const keep = new Set(codes);
  const incoming = new Map<string, string[]>();
  for (const code of keep) incoming.set(code, []);
  for (const edge of edges) {
    if (edge.concurrent || !keep.has(edge.from) || !keep.has(edge.to)) continue;
    incoming.get(edge.to)?.push(edge.from);
  }
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const rankOf = (code: string): number => {
    const cached = memo.get(code);
    if (cached !== undefined) return cached;
    if (visiting.has(code)) return 0;
    visiting.add(code);
    const dependencies = incoming.get(code) ?? [];
    const value = dependencies.length ? 1 + Math.max(...dependencies.map(rankOf)) : 0;
    visiting.delete(code);
    memo.set(code, value);
    return value;
  };
  return [...keep].sort(
    (left, right) => rankOf(left) - rankOf(right) || left.localeCompare(right, undefined, { numeric: true }),
  );
}

export function prerequisitePathToTarget(
  targetCode: string,
  courses: readonly Course[],
  plan: Pick<StudentPlan, "completedCourses" | "waivedCourses" | "semesters">,
): TargetPath {
  const catalog = new Map(courses.map((course) => [course.code, course]));
  const history = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  const planned = new Set(plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code)));
  if (!catalog.has(targetCode)) {
    return {
      target: targetCode,
      status: "unknown-course",
      nodes: [],
      remainingCodes: [],
      edges: [],
      cyclic: false,
      uncertain: false,
      missingCatalog: [targetCode],
    };
  }
  const walk = walkCourse(targetCode, catalog, history, planned, new Set(), new Map());
  const remainingCodes = unique(walk.remaining.filter((code) => code !== targetCode));
  const ancestorCodes = unique(walk.ancestors.filter((code) => code !== targetCode));
  const ordered = topologicalOrder(ancestorCodes, walk.edges);
  const nodes: TargetPathNode[] = [
    ...ordered.map((code) => ({ code, role: roleOf(code, history, planned) })),
    { code: targetCode, role: "target" },
  ];
  const missingCatalog = unique(walk.missing.filter((code) => code !== targetCode));
  const status = walk.cyclic ? "cyclic" : missingCatalog.length ? "missing-data" : "ok";
  return {
    target: targetCode,
    status,
    nodes,
    remainingCodes,
    edges: walk.edges,
    cyclic: walk.cyclic,
    uncertain: walk.uncertain,
    missingCatalog,
  };
}

const SEASON = /^(Fall|Spring|Summer)\s+(\d{4})$/i;

export function parseTermName(name: string): { season: "Fall" | "Spring" | "Summer"; year: number } | null {
  const match = SEASON.exec(name.trim());
  if (!match) return null;
  const season = `${match[1][0].toUpperCase()}${match[1].slice(1).toLowerCase()}` as "Fall" | "Spring" | "Summer";
  return { season, year: Number(match[2]) };
}

export function nextAcademicTermName(name: string): string {
  const parsed = parseTermName(name);
  if (!parsed) return name;
  if (parsed.season === "Fall") return `Spring ${parsed.year + 1}`;
  return `Fall ${parsed.season === "Spring" ? parsed.year : parsed.year}`;
}

export function termMatchesOffering(termName: string, offerings?: readonly string[]): boolean {
  if (!offerings?.length) return true;
  const parsed = parseTermName(termName);
  return offerings.some((offering) => {
    const exact = offering.trim();
    if (exact.toLowerCase() === termName.toLowerCase()) return true;
    if (!parsed) return termName.toLowerCase().includes(exact.toLowerCase());
    return parsed.season.toLowerCase() === exact.toLowerCase();
  });
}

function academicTerms(plan: StudentPlan): Semester[] {
  return plan.semesters.filter((semester) => semester.type === "academic");
}

function plannedAcademicIndex(
  code: string,
  plan: StudentPlan,
  academic: readonly Semester[],
): number | undefined {
  const index = plan.semesters.findIndex((semester) => semester.courses.some((course) => course.code === code));
  if (index < 0) return undefined;
  const after = academic.findIndex((semester) => {
    const at = plan.semesters.findIndex((item) => item.id === semester.id);
    return at >= index && semester.type === "academic";
  });
  if (after >= 0) return after;
  return academic.length;
}

function remainingLabel(count: number): string {
  return `${count} prerequisite${count === 1 ? "" : "s"} remaining`;
}

function summarize(reason: EarliestTerm["reason"], remainingCount: number, termName: string | null, recordedLabel?: string): string {
  if (reason === "unknown-course") return "That course is not in this catalog.";
  if (reason === "cyclic") return "This prerequisite path has a cycle and cannot be scheduled.";
  if (reason === "missing-data") return "Path includes courses missing from this catalog.";
  if (reason === "no-academic-term") return "Add an academic term to estimate an earliest semester.";
  if (reason === "no-matching-offering") return `${remainingLabel(remainingCount)} · no matching term offering`;
  if (reason === "already-recorded") {
    return recordedLabel ?? (termName ? `Already on your plan · ${termName}` : "Already completed");
  }
  if (!termName) return remainingLabel(remainingCount);
  return `${remainingLabel(remainingCount)} · earliest ${termName}`;
}

export function earliestFeasibleTerm(
  path: TargetPath,
  courses: readonly Course[],
  plan: StudentPlan,
): EarliestTerm {
  const remainingCount = path.remainingCodes.length;
  const fail = (reason: EarliestTerm["reason"], termName: string | null = null): EarliestTerm => ({
    remainingCount,
    termName,
    semesterId: null,
    reason,
    summary: summarize(reason, remainingCount, termName),
    placements: [],
    usedOfferings: false,
  });
  if (path.status === "unknown-course") return fail("unknown-course");
  if (path.status === "cyclic") return fail("cyclic");
  if (path.status === "missing-data") return fail("missing-data");

  const catalog = new Map(courses.map((course) => [course.code, course]));
  const history = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  const usedOfferings = courses.some((course) => Boolean(course.termOfferings?.length));
  const academic = academicTerms(plan);
  const recorded = history.has(path.target) || plan.semesters.some((semester) => semester.courses.some((course) => course.code === path.target));
  if (recorded) {
    const semester = plan.semesters.find((item) => item.courses.some((course) => course.code === path.target));
    const alreadyCompleted = history.has(path.target);
    return {
      remainingCount,
      termName: semester?.name ?? null,
      semesterId: semester?.id ?? null,
      reason: "already-recorded",
      summary: summarize(
        "already-recorded",
        remainingCount,
        semester?.name ?? null,
        alreadyCompleted ? "Already completed" : semester ? `Already on your plan · ${semester.name}` : "Already on your plan",
      ),
      placements: [],
      usedOfferings,
    };
  }
  if (!academic.length) return fail("no-academic-term");

  const toPlace = unique([...path.remainingCodes, path.target]);
  const assignment = new Map<string, number>();
  const order = topologicalOrder(toPlace, path.edges);
  let synthesized = 0;

  const termAt = (index: number): { name: string; id: string | null } => {
    const existing = academic[index];
    if (existing) return { name: existing.name, id: existing.id };
    const extra = index - academic.length + 1;
    synthesized = Math.max(synthesized, extra);
    let name = academic[academic.length - 1]?.name ?? "Fall 2026";
    for (let step = 0; step < extra; step++) name = nextAcademicTermName(name);
    return { name, id: null };
  };

  const findTerm = (minimum: number, code: string): number | null => {
    const offerings = catalog.get(code)?.termOfferings;
    for (let index = minimum; index < academic.length + 8; index++) {
      if (termMatchesOffering(termAt(index).name, offerings)) return index;
    }
    return null;
  };

  for (const code of order) {
    if (assignment.has(code)) continue;
    let minimum = 0;
    for (const edge of path.edges) {
      if (edge.to !== code) continue;
      if (history.has(edge.from)) continue;
      const plannedIndex = plannedAcademicIndex(edge.from, plan, academic);
      if (plannedIndex !== undefined) {
        minimum = Math.max(minimum, plannedIndex + (edge.concurrent ? 0 : 1));
      }
      const assigned = assignment.get(edge.from);
      if (assigned !== undefined) {
        minimum = Math.max(minimum, assigned + (edge.concurrent ? 0 : 1));
      }
    }
    const index = findTerm(minimum, code);
    if (index === null) return { ...fail("no-matching-offering"), usedOfferings };
    assignment.set(code, index);
    for (const edge of path.edges) {
      if (!edge.concurrent) continue;
      const partner = edge.to === code ? edge.from : edge.from === code ? edge.to : null;
      if (partner && toPlace.includes(partner) && !assignment.has(partner) && !history.has(partner)) {
        const partnerIndex = findTerm(index, partner);
        assignment.set(partner, partnerIndex ?? index);
      }
    }
  }

  const placements: TermPlacement[] = order.map((code) => {
    const term = termAt(assignment.get(code) ?? 0);
    return { code, termName: term.name, semesterId: term.id };
  });
  const targetIndex = assignment.get(path.target) ?? 0;
  const targetTerm = termAt(targetIndex);
  return {
    remainingCount,
    termName: targetTerm.name,
    semesterId: targetTerm.id,
    reason: "ok",
    summary: summarize("ok", remainingCount, targetTerm.name),
    placements,
    usedOfferings,
  };
}

export function targetPathSnapshot(
  targetCode: string,
  courses: readonly Course[],
  plan: StudentPlan,
): TargetPathSnapshot {
  const path = prerequisitePathToTarget(targetCode, courses, plan);
  return { path, earliest: earliestFeasibleTerm(path, courses, plan) };
}

export function matchCourseTarget(query: string, courses: readonly Course[]): string | null {
  const compact = query.trim().toUpperCase().replace(/\s+/g, "");
  if (!compact) return null;
  const match = courses.find((course) => course.code.replace(/\s/g, "") === compact);
  if (match) return match.code;
  const spaced = query.trim().toUpperCase().replace(/\s+/g, " ");
  return /^[A-Z]{2,6} \d{2,4}[A-Z]{0,2}$/.test(spaced) ? spaced : null;
}

export function termSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "term";
}
