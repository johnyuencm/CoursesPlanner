import type {
  Catalog,
  Course,
  DegreeProgressV2,
  DegreeRequirementV2,
  RuleGroup,
  RuleGroupResult,
  StudentPlan,
  SupportTier,
} from "./types";
import { auditNotes, auditPlanCourses, hasBlockingIssue, sumCredits, type PlanCourseAudit } from "./validation";

const unique = (values: Iterable<string>): string[] => [...new Set(values)];
const byCodeOrder = (a: string, b: string) => a.localeCompare(b);

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

/** Every course code that the tree lists, in tree order. */
export function programCourseCodes(requirements: DegreeRequirementV2): string[] {
  return unique(groupCodes(requirements.root));
}

const flatGroups = (group: RuleGroup): RuleGroup[] =>
  group.kind === "all" ? [group, ...group.children.flatMap(flatGroups)] : [group];

type GroupOf<K extends RuleGroup["kind"]> = Extract<RuleGroup, { kind: K }>;

/** A flat view of the tree for pages and the parser that list courses by role. */
export function requirementView(requirements: DegreeRequirementV2) {
  const groups = flatGroups(requirements.root);
  const ofKind = <K extends RuleGroup["kind"]>(kind: K) => groups.filter((group): group is GroupOf<K> => group.kind === kind);
  const areaGroups = ofKind("choose-areas");
  const creditGroups = ofKind("choose-credits");
  return {
    totalCredits: requiredCredits(requirements.root),
    /** Courses of `choose-courses` groups that need every listed course. */
    core: unique(ofKind("choose-courses").filter((group) => group.count >= unique(group.courses).length).flatMap((group) => group.courses)),
    areas: areaGroups.flatMap((group) => group.areas),
    /** The first `choose-areas` group, if any. */
    breadth: areaGroups[0] as GroupOf<"choose-areas"> | undefined,
    /** The first `choose-credits` group, if any. */
    electives: creditGroups[0] as GroupOf<"choose-credits"> | undefined,
    /** Courses that any `choose-credits` group lists. */
    electiveCourses: unique(creditGroups.flatMap((group) => group.courses)),
  };
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
// One step is one selection tried, one choose-areas combination or one node of the minimal-set search.
export const SEARCH_LIMIT = 20_000;

/** Test hook: the steps that the last `validatePlanV2` call used. It is not part of the audit result. */
export const lastAuditSearch = { steps: 0 };

const isLeaf = (group: RuleGroup): group is Leaf =>
  group.kind === "choose-courses" || group.kind === "choose-credits" || group.kind === "choose-areas";

const creditsOf = (codes: string[], context: Context) =>
  codes.reduce((sum, code) => sum + (context.credits.get(code) ?? 0), 0);

/** Computes a value once per group: the search asks for it at every node. Trees are never changed. */
function perGroup<G extends object, T>(compute: (group: G) => T): (group: G) => T {
  const cache = new WeakMap<G, T>();
  return (group) => {
    if (!cache.has(group)) cache.set(group, compute(group));
    return cache.get(group)!;
  };
}

/** The courses that a group lists: list order for choose-courses, code order otherwise. */
const listedCodes = perGroup((leaf: Leaf): string[] => {
  if (leaf.kind === "choose-courses") return unique(leaf.courses);
  const listed = leaf.kind === "choose-credits" ? leaf.courses : leaf.areas.flatMap((area) => area.courses);
  return unique(listed).sort(byCodeOrder);
});

/** Courses this group can use from `free`: list order for choose-courses, code order otherwise. */
function candidates(leaf: Leaf, free: Set<string>, { audit, credits }: Context): string[] {
  if (leaf.kind === "choose-courses") {
    return listedCodes(leaf).filter(
      (code) => free.has(code) && (audit.waived.has(code) || audit.completed.has(code) || audit.validPlanned.has(code)),
    );
  }
  return listedCodes(leaf).filter((code) => free.has(code) && credits.has(code));
}

/**
 * Areas matched one course each (bipartite matching), so one course never fills two areas.
 * It stops when `enough` areas are matched.
 */
function categoryMatching(codes: string[], memberships: Map<string, string[]>, enough = Infinity): string[] {
  const categoryToCourse = new Map<string, string>();
  const assign = (code: string, seen: Set<string>): boolean => {
    for (const category of memberships.get(code) ?? []) {
      if (seen.has(category)) continue;
      seen.add(category);
      const owner = categoryToCourse.get(category);
      if (owner === undefined || assign(owner, seen)) {
        categoryToCourse.set(category, code);
        return true;
      }
    }
    return false;
  };
  for (const code of codes) {
    if (categoryToCourse.size >= enough) break;
    assign(code, new Set());
  }
  return [...categoryToCourse.keys()];
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

/** C(n, k), or Infinity when it is above `limit`. */
function binomial(n: number, k: number, limit: number): number {
  let result = 1;
  // After step i, result is C(n - k + i, i). It only grows, so it can stop early.
  for (let i = 1; i <= k; i += 1) {
    result = (result * (n - k + i)) / i;
    if (result > limit) return Infinity;
  }
  return result;
}

/**
 * Sets that reach `target` credits and drop below it when any one course leaves. Each node of the
 * search is one step, and the search stops at the step cap: without that, n courses can cost 2^n nodes.
 */
function* minimalSets(
  codes: string[],
  credit: (code: string) => number,
  target: number,
  context: Context,
  start = 0,
  picked: string[] = [],
  total = 0,
): Generator<string[]> {
  context.steps += 1;
  if (total >= target) {
    if (picked.every((code) => total - credit(code) < target)) yield picked;
    return;
  }
  for (let index = start; index < codes.length && context.steps <= SEARCH_LIMIT; index += 1) {
    yield* minimalSets(codes, credit, target, context, index + 1, [...picked, codes[index]], total + credit(codes[index]));
  }
}

/** One minimal set without search: courses in order up to the target, then drop each course it does not need. */
function firstMinimalSet(codes: string[], credit: (code: string) => number, target: number): string[] {
  const picked: string[] = [];
  let total = 0;
  for (const code of codes) {
    if (total >= target) break;
    picked.push(code);
    total += credit(code);
  }
  const needed: string[] = [];
  for (const code of picked) {
    if (total - credit(code) >= target) total -= credit(code);
    else needed.push(code);
  }
  return needed;
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
  const position = new Map(codes.map((code, index) => [code, index]));
  const inOrder = (picked: string[]) => [...picked].sort((a, b) => position.get(a)! - position.get(b)!);
  const credit = (code: string) => context.credits.get(code) ?? 0;
  // A stable sort, so equal credits keep `order`.
  const mostCreditsFirst = (list: string[]) => [...list].sort((a, b) => credit(b) - credit(a));
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
      // Courses with more credits first, so the first sets are small and leave more courses free.
      // The split into "no later group lists it" and "a later group lists it" stays.
      const positive = order.filter((code) => credit(code) > 0);
      const byCredits = [
        ...mostCreditsFirst(positive.filter((code) => !later.has(code))),
        ...mostCreditsFirst(positive.filter((code) => later.has(code))),
      ];
      let found = false;
      for (const picked of minimalSets(byCredits, credit, leaf.credits, context)) {
        found = true;
        yield { codes: inOrder(picked), satisfied: true, areas: [] };
      }
      // The step cap stopped the search before it found a set. The candidates reach the target, so one exists.
      if (!found) yield { codes: inOrder(firstMinimalSet(byCredits, credit, leaf.credits)), satisfied: true, areas: [] };
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
      // A group with more combinations than the step cap cannot try them all. It tries courses with
      // more credits first, so the combinations that it reaches can meet the credits.
      const tryOrder = binomial(order.length, leaf.count, SEARCH_LIMIT) > SEARCH_LIMIT ? mostCreditsFirst(order) : order;
      const all: { codes: string[]; areas: string[]; credits: number }[] = [];
      // Combinations come one at a time, and each is one step. At the cap, keep the ones found so far.
      for (const combination of combinations(tryOrder, leaf.count)) {
        const picked = inOrder(combination);
        all.push({ codes: picked, areas: categoryMatching(picked, membership), credits: creditsOf(picked, context) });
        context.steps += 1;
        if (context.steps > SEARCH_LIMIT) break;
      }
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

const areaMembership = perGroup((leaf: Extract<Leaf, { kind: "choose-areas" }>): Map<string, string[]> => {
  const membership = new Map<string, string[]>();
  for (const area of leaf.areas) {
    for (const code of area.courses) membership.set(code, [...(membership.get(code) ?? []), area.id]);
  }
  return membership;
});

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
    Math.min(leaf.count, categoryMatching(codes, areaMembership(leaf), leaf.minAreas).length) >= leaf.minAreas &&
    best.reduce((sum, value) => sum + value, 0) >= leaf.credits
  );
}

/** True when `a` beats `b`: at the first group where they differ, `a` meets it. `a` is read lazily. */
function beats(a: (position: number) => boolean, b: boolean[]): boolean {
  for (let position = 0; position < b.length; position += 1) {
    const value = a(position);
    if (value !== b[position]) return value;
  }
  return false;
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
  // canMeet on every free course is a ceiling: no allocation meets a group that it says no to.
  // A result that meets every other group cannot be beaten, so the search stops there.
  const ceiling = leaves.map((leaf) => canMeet(leaf, free, context));
  const unbeatable = () => bestScore?.every((value, position) => value === ceiling[position]);
  const visit = (index: number, available: Set<string>, chosen: Pick[]) => {
    if (index === leaves.length) {
      const score = chosen.map((pick) => pick.satisfied);
      if (!bestScore || beats((position) => score[position], bestScore)) [best, bestScore] = [chosen, score];
      return;
    }
    if (bestScore) {
      // The best that this branch can still reach. canMeet runs only up to the first difference.
      const bound = (position: number) =>
        position < index ? chosen[position].satisfied : canMeet(leaves[position], available, context);
      if (!beats(bound, bestScore)) return;
    }
    for (const pick of selections(leaves[index], available, context)) {
      const rest = new Set(available);
      for (const code of pick.codes) rest.delete(code);
      visit(index + 1, rest, [...chosen, pick]);
      context.steps += 1;
      if (unbeatable() || context.steps > SEARCH_LIMIT) return;
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
  lastAuditSearch.steps = context.steps;
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
  return validatePlanV2(plan, catalog, catalog.requirements);
}
