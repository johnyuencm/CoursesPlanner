import type {
  Catalog,
  Course,
  DegreeProgressV2,
  DegreeRequirement,
  DegreeRequirementV2,
  RuleGroup,
  RuleGroupResult,
  StudentPlan,
  SupportTier,
} from "./types";
import {
  auditNotes,
  auditPlanCourses,
  categoryMatching,
  hasBlockingIssue,
  sumCredits,
  type PlanCourseAudit,
} from "./validation";

const unique = (values: Iterable<string>): string[] => [...new Set(values)];
const byCodeOrder = (a: string, b: string) => a.localeCompare(b);

/** Expresses a v1 (fixed MSCS shape) requirement as a v2 rule-group tree. */
export function requirementsV2FromV1(requirements: DegreeRequirement): DegreeRequirementV2 {
  const rule = (pattern: RegExp) => requirements.rawRules.find((text) => pattern.test(text)) ?? "";
  const breadth = requirements.breadthRequirements;
  return {
    version: 2,
    name: requirements.name,
    catalogYear: requirements.catalogYear,
    minimumGpa: requirements.minimumGpa,
    officialUrl: requirements.officialUrl,
    uncertainties: requirements.uncertainties,
    lastUpdated: requirements.lastUpdated,
    root: {
      kind: "all",
      id: "program",
      label: requirements.name,
      rawText: rule(/complete all courses/i),
      children: [
        {
          kind: "choose-courses",
          id: "core",
          label: "Core requirements",
          rawText: "",
          count: requirements.coreCourses.length,
          courses: requirements.coreCourses,
        },
        {
          kind: "choose-areas",
          id: "breadth",
          label: "Breadth areas",
          rawText: rule(/from at least/i),
          count: breadth.coursesRequired,
          minAreas: breadth.minCategories,
          credits: breadth.credits,
          areas: breadth.categories,
        },
        {
          // The catalog lets breadth-area courses that breadth did not use count here.
          kind: "choose-credits",
          id: "electives",
          label: "Electives",
          rawText: rule(/semester hours from/i),
          credits: requirements.electiveCredits,
          courses: unique([...requirements.eligibleElectives, ...breadth.categories.flatMap((area) => area.courses)]),
        },
        {
          kind: "total-credits",
          id: "total",
          label: "Total credits",
          rawText: rule(/total semester hours/i),
          credits: requirements.totalCredits,
        },
      ],
    },
  };
}

function groupCodes(group: RuleGroup): string[] {
  switch (group.kind) {
    case "all":
      return group.children.flatMap(groupCodes);
    case "choose-courses":
    case "choose-credits":
      return group.courses;
    case "choose-areas":
      return group.areas.flatMap((area) => area.courses);
    case "total-credits":
    case "unmodeled":
      return [];
  }
}

function hasUnmodeled(group: RuleGroup): boolean {
  return group.kind === "unmodeled" || (group.kind === "all" && group.children.some(hasUnmodeled));
}

/** Credits that a group asks for, or undefined when the model cannot tell. */
function groupCredits(group: RuleGroup, byCode: Map<string, Course>): number | undefined {
  // A shared group double counts courses, so it adds nothing to the program total.
  if (group.shareCourses) return 0;
  switch (group.kind) {
    case "all": {
      const parts = group.children.map((child) => groupCredits(child, byCode));
      return parts.every((part) => part !== undefined) ? parts.reduce<number>((sum, part) => sum + part!, 0) : undefined;
    }
    case "choose-credits":
    case "choose-areas":
      return group.credits;
    case "choose-courses": {
      const credits: number[] = [];
      for (const code of unique(group.courses)) {
        const course = byCode.get(code);
        if (!course || (course.maxCredits !== undefined && course.maxCredits !== course.credits)) return undefined;
        credits.push(course.credits);
      }
      if (group.count === credits.length) return credits.reduce((sum, value) => sum + value, 0);
      return new Set(credits).size === 1 ? group.count * credits[0] : undefined;
    }
    case "total-credits":
    case "unmodeled":
      return undefined;
  }
}

const topLevel = (root: RuleGroup): RuleGroup[] => (root.kind === "all" ? root.children : [root]);

function requiredCredits(root: RuleGroup): number | null {
  const total = topLevel(root).find((group) => group.kind === "total-credits");
  return total?.kind === "total-credits" ? total.credits : null;
}

/** Audit when every top-level group is modeled and their credits add up to the program total; else Map. */
export function requirementTier(requirements: DegreeRequirementV2, courses: Course[]): SupportTier {
  const total = requiredCredits(requirements.root);
  if (total === null || hasUnmodeled(requirements.root)) return "map";
  const byCode = new Map(courses.map((course) => [course.code, course]));
  let sum = 0;
  for (const group of topLevel(requirements.root)) {
    if (group.kind === "total-credits") continue;
    const credits = groupCredits(group, byCode);
    if (credits === undefined) return "map";
    sum += credits;
  }
  return sum === total ? "audit" : "map";
}

type Leaf = Extract<RuleGroup, { kind: "choose-courses" | "choose-credits" | "choose-areas" }>;
/** The courses that one group takes in an allocation. */
type Pick = { codes: string[]; satisfied: boolean; areas: string[] };
type Context = {
  audit: PlanCourseAudit;
  credits: Map<string, number>;
  steps: number;
  /** For each group: the courses that later groups in its pool list. */
  later: Map<Leaf, Set<string>>;
};

// ponytail: a step cap keeps a pathological tree from freezing the planner. Past the cap the audit
// keeps the best allocation found so far, so it can miss a valid allocation but never claims a false one.
const SEARCH_LIMIT = 20_000;

const isLeaf = (group: RuleGroup): group is Leaf =>
  group.kind === "choose-courses" || group.kind === "choose-credits" || group.kind === "choose-areas";

const creditsOf = (codes: string[], context: Context) =>
  codes.reduce((sum, code) => sum + (context.credits.get(code) ?? 0), 0);

/** Courses this group can use from `free`: list order for choose-courses, code order otherwise. */
function candidates(leaf: Leaf, free: Set<string>, { audit, credits }: Context): string[] {
  if (leaf.kind === "choose-courses") {
    return unique(leaf.courses).filter(
      (code) => free.has(code) && (audit.waived.has(code) || audit.completed.has(code) || audit.validPlanned.has(code)),
    );
  }
  const listed = leaf.kind === "choose-credits" ? leaf.courses : leaf.areas.flatMap((area) => area.courses);
  return unique(listed)
    .filter((code) => free.has(code) && credits.has(code))
    .sort(byCodeOrder);
}

function* combinations<T>(items: T[], size: number, start = 0, prefix: T[] = []): Generator<T[]> {
  if (prefix.length === size) {
    yield prefix;
    return;
  }
  for (let index = start; index <= items.length - (size - prefix.length); index += 1) {
    yield* combinations(items, size, index + 1, [...prefix, items[index]]);
  }
}

/** Sets that reach `target` credits and drop below it when any one course leaves. */
function* minimalSets(
  codes: string[],
  credit: (code: string) => number,
  target: number,
  start = 0,
  picked: string[] = [],
  total = 0,
): Generator<string[]> {
  if (total >= target) {
    if (picked.every((code) => total - credit(code) < target)) yield picked;
    return;
  }
  for (let index = start; index < codes.length; index += 1) {
    yield* minimalSets(codes, credit, target, index + 1, [...picked, codes[index]], total + credit(codes[index]));
  }
}

/**
 * The selections a group can make from `free`. Selections that meet the group come first, in a
 * fixed order of preference. A group that cannot be met gets one selection: its best progress.
 * Minimal selections are enough: a group that gives back courses it does not need never makes
 * another group fail.
 */
function* selections(leaf: Leaf, free: Set<string>, context: Context): Generator<Pick> {
  const codes = candidates(leaf, free, context);
  // Try courses that no later group lists first. Then the first selections leave later groups
  // their courses, and the search meets every group in few steps. Picks keep candidate order.
  const later = context.later.get(leaf) ?? new Set<string>();
  const order = [...codes.filter((code) => !later.has(code)), ...codes.filter((code) => later.has(code))];
  const inOrder = (picked: string[]) => codes.filter((code) => picked.includes(code));
  switch (leaf.kind) {
    case "choose-courses": {
      if (codes.length < leaf.count) {
        yield { codes, satisfied: false, areas: [] };
        return;
      }
      for (const picked of combinations(order, leaf.count)) yield { codes: inOrder(picked), satisfied: true, areas: [] };
      return;
    }
    case "choose-credits": {
      if (creditsOf(codes, context) < leaf.credits) {
        yield { codes, satisfied: false, areas: [] };
        return;
      }
      const credit = (code: string) => context.credits.get(code) ?? 0;
      for (const picked of minimalSets(order.filter((code) => credit(code) > 0), credit, leaf.credits)) {
        yield { codes: inOrder(picked), satisfied: true, areas: [] };
      }
      return;
    }
    case "choose-areas": {
      const membership = areaMembership(leaf);
      if (leaf.count === 0) {
        yield { codes: [], satisfied: leaf.minAreas === 0 && leaf.credits <= 0, areas: [] };
        return;
      }
      if (codes.length < leaf.count) {
        yield { codes, satisfied: false, areas: categoryMatching(codes, membership) };
        return;
      }
      const all = [...combinations(order, leaf.count)].map(inOrder).map((picked) => ({
        codes: picked,
        areas: categoryMatching(picked, membership),
        credits: creditsOf(picked, context),
      }));
      // Each combination is search work, so it counts toward the step cap.
      context.steps += all.length;
      // Fewest credits first (more stay free for other groups), then most areas. The sort is stable.
      const feasible = all
        .filter((option) => option.areas.length >= leaf.minAreas && option.credits >= leaf.credits)
        .sort((a, b) => a.credits - b.credits || b.areas.length - a.areas.length);
      if (feasible.length) {
        for (const option of feasible) yield { codes: option.codes, areas: option.areas, satisfied: true };
        return;
      }
      const progress = all.reduce((best, option) =>
        option.areas.length > best.areas.length ||
        (option.areas.length === best.areas.length && option.credits > best.credits)
          ? option
          : best,
      );
      yield { codes: progress.codes, areas: progress.areas, satisfied: false };
    }
  }
}

function areaMembership(leaf: Extract<Leaf, { kind: "choose-areas" }>): Map<string, string[]> {
  const membership = new Map<string, string[]>();
  for (const area of leaf.areas) {
    for (const code of area.courses) membership.set(code, [...(membership.get(code) ?? []), area.id]);
  }
  return membership;
}

/**
 * Can the group still be met from `free`? The search uses this only to prune, so it may say yes
 * too often, but never no too often. For choose-areas it is a cheap bound, not a full enumeration.
 */
function canMeet(leaf: Leaf, free: Set<string>, context: Context): boolean {
  const codes = candidates(leaf, free, context);
  if (leaf.kind === "choose-courses") return codes.length >= leaf.count;
  if (leaf.kind === "choose-credits") return creditsOf(codes, context) >= leaf.credits;
  if (leaf.count === 0) return leaf.minAreas === 0 && leaf.credits <= 0;
  const best = codes.map((code) => context.credits.get(code) ?? 0).sort((a, b) => b - a).slice(0, leaf.count);
  return (
    codes.length >= leaf.count &&
    Math.min(leaf.count, categoryMatching(codes, areaMembership(leaf)).length) >= leaf.minAreas &&
    best.reduce((sum, value) => sum + value, 0) >= leaf.credits
  );
}

/** True when `a` beats `b`: at the first group where they differ, `a` meets it. */
function beats(a: boolean[], b: boolean[]): boolean {
  const index = a.findIndex((value, position) => value !== b[position]);
  return index >= 0 && a[index];
}

/**
 * Gives each group in one pool its courses. The search meets every group when any allocation can
 * (below the step cap). When no allocation can, earlier groups win, and a group that cannot be met
 * keeps its partial progress: it holds those courses, so a later group can stay unmet although it
 * could be met alone. It tries the plain tree-order allocation first and keeps the first of equal
 * results, so the result is deterministic and does not depend on plan order.
 */
function allocate(leaves: Leaf[], free: Set<string>, context: Context, picks: Map<RuleGroup, Pick>): void {
  const listedLater = new Set<string>();
  for (const leaf of [...leaves].reverse()) {
    context.later.set(leaf, new Set(listedLater));
    for (const code of groupCodes(leaf)) listedLater.add(code);
  }
  let best: Pick[] = [];
  let bestScore: boolean[] | undefined;
  const visit = (index: number, available: Set<string>, chosen: Pick[]) => {
    if (index === leaves.length) {
      const score = chosen.map((pick) => pick.satisfied);
      if (!bestScore || beats(score, bestScore)) [best, bestScore] = [chosen, score];
      return;
    }
    if (bestScore) {
      const bound = [
        ...chosen.map((pick) => pick.satisfied),
        ...leaves.slice(index).map((leaf) => canMeet(leaf, available, context)),
      ];
      if (!beats(bound, bestScore)) return;
    }
    for (const pick of selections(leaves[index], available, context)) {
      const rest = new Set(available);
      for (const code of pick.codes) rest.delete(code);
      visit(index + 1, rest, [...chosen, pick]);
      context.steps += 1;
      if (bestScore?.every(Boolean) || context.steps > SEARCH_LIMIT) return;
    }
  };
  visit(0, free, []);

  // A course that no group took still counts toward the first credit group that lists it.
  const left = new Set(free);
  for (const pick of best) for (const code of pick.codes) left.delete(code);
  leaves.forEach((leaf, index) => {
    const pick = { ...best[index] };
    if (leaf.kind === "choose-credits") {
      const extra = candidates(leaf, left, context);
      pick.codes = [...pick.codes, ...extra].sort(byCodeOrder);
      for (const code of extra) left.delete(code);
    }
    picks.set(leaf, pick);
  });
}

/** Groups that share one pool of courses. A `shareCourses` subtree gets its own pool of every course. */
function pools(group: RuleGroup, pool: Leaf[], out: Leaf[][]): Leaf[][] {
  if (group.shareCourses) {
    pool = [];
    out.push(pool);
  }
  if (group.kind === "all") for (const child of group.children) pools(child, pool, out);
  else if (isLeaf(group)) pool.push(group);
  return out;
}

type Allocated = { courses: string[]; waived: string[]; credits: number; areas: string[]; children: RuleGroupResult[] };

function summary(group: RuleGroup, result: Allocated): string {
  switch (group.kind) {
    case "choose-courses": {
      const listed = unique(group.courses);
      const missing = listed.filter((code) => !result.courses.includes(code) && !result.waived.includes(code));
      // When every listed course is required, name the ones still needed.
      const needs = group.count === listed.length && missing.length ? `; needs ${missing.join(", ")}` : "";
      return `${result.courses.length + result.waived.length} of ${group.count} courses${needs}`;
    }
    case "choose-credits":
    case "total-credits":
      return `${result.credits} of ${group.credits} credits`;
    case "choose-areas":
      return `${result.courses.length} of ${group.count} courses, ${result.areas.length} of ${group.minAreas} areas, ${result.credits} of ${group.credits} credits`;
    case "all":
    case "unmodeled":
      return "";
  }
}

function groupResult(group: RuleGroup, picks: Map<RuleGroup, Pick>, context: Context): RuleGroupResult {
  const done = (values: Partial<Allocated>, satisfied: boolean): RuleGroupResult => {
    const allocated: Allocated = { courses: [], waived: [], credits: 0, areas: [], children: [], ...values };
    return { id: group.id, kind: group.kind, label: group.label, rawText: group.rawText, satisfied, ...allocated, summary: summary(group, allocated) };
  };

  switch (group.kind) {
    case "all": {
      const children = group.children.map((child) => groupResult(child, picks, context));
      const courses = unique(children.flatMap((child) => child.courses));
      return done(
        { courses, waived: unique(children.flatMap((child) => child.waived)), credits: creditsOf(courses, context), children },
        children.every((child) => child.satisfied),
      );
    }
    case "choose-courses": {
      const { codes } = picks.get(group)!;
      const waived = codes.filter((code) => context.audit.waived.has(code));
      const courses = codes.filter((code) => !context.audit.waived.has(code));
      return done({ courses, waived, credits: creditsOf(courses, context) }, codes.length >= group.count);
    }
    case "choose-credits": {
      const { codes } = picks.get(group)!;
      const credits = creditsOf(codes, context);
      return done({ courses: codes, credits }, credits >= group.credits);
    }
    case "choose-areas": {
      const pick = picks.get(group)!;
      return done({ courses: pick.codes, credits: creditsOf(pick.codes, context), areas: pick.areas }, pick.satisfied);
    }
    case "total-credits": {
      const credits = sumCredits(context.audit.counted);
      return done({ credits }, credits >= group.credits);
    }
    case "unmodeled":
      return done({}, false);
  }
}

/**
 * Audits a plan against a v2 requirement tree. A Map-tier tree gets the plan checks
 * (prerequisites, corequisites, term order, duplicates, credits), but it is never satisfied.
 */
export function validatePlanV2(plan: StudentPlan, catalog: Catalog, requirements: DegreeRequirementV2): DegreeProgressV2 {
  const tier = requirementTier(requirements, catalog.courses);
  // A Map-tier tree can miss courses, so every catalog course counts toward the plan credits.
  const degreeCodes = tier === "audit" ? groupCodes(requirements.root) : catalog.courses.map((course) => course.code);
  const audit = auditPlanCourses(plan, catalog, new Set(degreeCodes));
  const context: Context = { audit, credits: new Map(audit.counted.map((course) => [course.code, course.credits])), steps: 0, later: new Map() };
  const free = new Set([...audit.completed, ...audit.waived, ...audit.validPlanned]);
  const picks = new Map<RuleGroup, Pick>();
  const main: Leaf[] = [];
  for (const pool of pools(requirements.root, main, [main])) allocate(pool, free, context, picks);
  const root = groupResult(requirements.root, picks, context);
  const earnedCredits = sumCredits(audit.counted, "earned");
  const plannedCredits = sumCredits(audit.counted, "planned");
  return {
    tier,
    earnedCredits,
    plannedCredits,
    totalCredits: earnedCredits + plannedCredits,
    requiredCredits: requiredCredits(requirements.root),
    root,
    issues: audit.issues,
    satisfied: tier === "audit" && root.satisfied && !hasBlockingIssue(audit.issues),
    notes: auditNotes(requirements.minimumGpa, requirements.uncertainties, catalog.warnings),
  };
}

/** The Plan audit for a catalog snapshot. */
export function validatePlan(plan: StudentPlan, catalog: Catalog): DegreeProgressV2 {
  return validatePlanV2(plan, catalog, requirementsV2FromV1(catalog.requirements));
}
