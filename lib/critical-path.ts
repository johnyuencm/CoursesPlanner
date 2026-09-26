import type { Course, Pathway, StudentPlan } from "./types";
import {
  earliestFeasibleTerm,
  nextAcademicTermName,
  parseTermName,
  prerequisitePathToTarget,
  targetPathSnapshot,
  termSlug,
  type TargetPath,
  type TargetPathNode,
  type TargetPathSnapshot,
} from "./target-path";
import { MAX_SEMESTERS } from "./plan";

export type CriticalPathSource = "course" | "pathway" | "none";

export type ResolvedTargetSet = {
  codes: string[];
  label: string;
  source: CriticalPathSource;
};

export type DelayImpact = {
  delayedCode: string;
  targetCode: string;
  fromTerm: string;
  toTerm: string;
  copy: string;
};

export type CriticalPathStatus =
  | "ok"
  | "no-target"
  | "unknown-course"
  | "cyclic"
  | "missing-data"
  | "already-recorded"
  | "no-academic-term"
  | "unscheduled";

export type CriticalPathAnalysis = {
  status: CriticalPathStatus;
  source: CriticalPathSource;
  label: string;
  targets: string[];
  controllingTarget: string | null;
  bottleneck: string[];
  nodes: TargetPathNode[];
  sequentialCount: number;
  earliestTermName: string | null;
  earliestSummary: string;
  delayImpacts: DelayImpact[];
  headline: string | null;
};

export function delayImpactCopy(delayedCode: string, targetCode: string, fromTerm: string, toTerm: string): string {
  return `delaying ${delayedCode} moves earliest ${targetCode} from ${fromTerm} → ${toTerm}`;
}

export function isBottleneckEdge(source: string, target: string, chain: readonly string[]): boolean {
  for (let index = 0; index < chain.length - 1; index++) {
    if (chain[index] === source && chain[index + 1] === target) return true;
  }
  return false;
}

export function pathwayCourseCodes(pathway: Pick<Pathway, "groups">): string[] {
  const seen = new Set<string>();
  const codes: string[] = [];
  for (const group of pathway.groups) {
    for (const code of group.courses) {
      if (seen.has(code)) continue;
      seen.add(code);
      codes.push(code);
    }
  }
  return codes;
}

export function resolveTargetSet(
  courseTargetCode: string | null | undefined,
  careerTargetId: string | null | undefined,
  pathways: readonly Pathway[],
): ResolvedTargetSet {
  const course = courseTargetCode?.trim();
  if (course) return { codes: [course], label: course, source: "course" };
  const pathway = pathways.find((item) => item.id === careerTargetId);
  if (pathway) {
    const codes = pathwayCourseCodes(pathway);
    return { codes, label: pathway.name, source: "pathway" };
  }
  return { codes: [], label: "", source: "none" };
}

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

function termRank(name: string | null | undefined): number {
  if (!name) return Number.POSITIVE_INFINITY;
  const parsed = parseTermName(name);
  if (!parsed) return Number.POSITIVE_INFINITY;
  const season = parsed.season === "Spring" ? 0 : parsed.season === "Summer" ? 1 : 2;
  return parsed.year * 10 + season;
}

function laterTerm(from: string, to: string): boolean {
  return termRank(to) > termRank(from);
}

function compareChains(left: string[], right: string[]): number {
  const length = right.length - left.length;
  if (length) return length;
  return left.join("|").localeCompare(right.join("|"), undefined, { numeric: true });
}

/** Longest sequential (non-concurrent) remaining chain ending at the target. */
export function longestSequentialChain(path: TargetPath): string[] {
  if (path.status === "unknown-course") return [];
  const keep = new Set(
    unique([
      path.target,
      ...path.remainingCodes,
      ...path.nodes
        .filter((node) => node.role === "remaining" || node.role === "planned" || node.role === "target")
        .map((node) => node.code),
    ]),
  );
  const outgoing = new Map<string, string[]>();
  for (const code of keep) outgoing.set(code, []);
  for (const edge of path.edges) {
    if (edge.concurrent || !keep.has(edge.from) || !keep.has(edge.to) || edge.from === edge.to) continue;
    outgoing.get(edge.from)?.push(edge.to);
  }
  for (const neighbors of outgoing.values()) {
    neighbors.sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  }
  const memo = new Map<string, string[]>();
  const visiting = new Set<string>();
  const from = (code: string): string[] => {
    const cached = memo.get(code);
    if (cached) return cached;
    if (visiting.has(code)) return [code];
    visiting.add(code);
    let best = [code];
    for (const next of outgoing.get(code) ?? []) {
      const chain = [code, ...from(next)];
      if (compareChains(best, chain) > 0) best = chain;
    }
    visiting.delete(code);
    memo.set(code, best);
    return best;
  };
  let best: string[] = keep.has(path.target) ? [path.target] : [];
  for (const code of keep) {
    const chain = from(code);
    if (!chain.includes(path.target)) continue;
    if (compareChains(best, chain) > 0) best = chain;
  }
  return best;
}

function snapshotTermOf(code: string, snapshot: TargetPathSnapshot, plan: StudentPlan): string | null {
  const placement = snapshot.earliest.placements.find((item) => item.code === code);
  if (placement) return placement.termName;
  if (code === snapshot.path.target && snapshot.earliest.termName) return snapshot.earliest.termName;
  const planned = plan.semesters.find((semester) => semester.courses.some((course) => course.code === code));
  return planned?.name ?? null;
}

function planWithDelayedCourse(
  plan: StudentPlan,
  code: string,
  fromTermName: string,
  courses: readonly Course[],
): StudentPlan | null {
  const delayedName = nextAcademicTermName(fromTermName);
  if (!delayedName || delayedName === fromTermName || !laterTerm(fromTermName, delayedName)) return null;
  const credits = courses.find((course) => course.code === code)?.credits;
  const stripped: StudentPlan = {
    ...plan,
    semesters: plan.semesters.map((semester) => ({
      ...semester,
      courses: semester.courses.filter((item) => item.code !== code),
    })),
  };
  const existing = stripped.semesters.find((semester) => semester.name === delayedName && semester.type === "academic");
  const item = credits === undefined ? { code } : { code, credits };
  if (existing) {
    return {
      ...stripped,
      semesters: stripped.semesters.map((semester) =>
        semester.id === existing.id ? { ...semester, courses: [...semester.courses, item] } : semester,
      ),
    };
  }
  if (stripped.semesters.length >= MAX_SEMESTERS) return null;
  let id = termSlug(delayedName);
  if (stripped.semesters.some((semester) => semester.id === id)) id = `${id}-${stripped.semesters.length}`;
  return {
    ...stripped,
    semesters: [...stripped.semesters, { id, name: delayedName, type: "academic", courses: [item] }],
  };
}

function delayImpactsFor(
  delayedCodes: readonly string[],
  targetCode: string,
  baseline: TargetPathSnapshot,
  courses: readonly Course[],
  plan: StudentPlan,
): DelayImpact[] {
  const fromTerm = baseline.earliest.termName;
  if (!fromTerm || baseline.earliest.reason !== "ok") return [];
  const history = new Set([...plan.completedCourses, ...plan.waivedCourses]);
  const impacts: DelayImpact[] = [];
  for (const delayedCode of delayedCodes) {
    if (delayedCode === targetCode || history.has(delayedCode)) continue;
    const currentTerm = snapshotTermOf(delayedCode, baseline, plan);
    if (!currentTerm) continue;
    const delayedPlan = planWithDelayedCourse(plan, delayedCode, currentTerm, courses);
    if (!delayedPlan) continue;
    const next = earliestFeasibleTerm(prerequisitePathToTarget(targetCode, courses, delayedPlan), courses, delayedPlan);
    if (next.reason !== "ok" || !next.termName || !laterTerm(fromTerm, next.termName)) continue;
    impacts.push({
      delayedCode,
      targetCode,
      fromTerm,
      toTerm: next.termName,
      copy: delayImpactCopy(delayedCode, targetCode, fromTerm, next.termName),
    });
  }
  return impacts;
}

function statusFromSnapshot(snapshot: TargetPathSnapshot): CriticalPathStatus {
  if (snapshot.path.status === "unknown-course") return "unknown-course";
  if (snapshot.path.status === "cyclic") return "cyclic";
  if (snapshot.path.status === "missing-data") return "missing-data";
  if (snapshot.earliest.reason === "already-recorded") return "already-recorded";
  if (snapshot.earliest.reason === "no-academic-term") return "no-academic-term";
  if (snapshot.earliest.reason !== "ok") return "unscheduled";
  return "ok";
}

function emptyAnalysis(
  status: CriticalPathStatus,
  resolved: ResolvedTargetSet,
  extras: Partial<CriticalPathAnalysis> = {},
): CriticalPathAnalysis {
  return {
    status,
    source: resolved.source,
    label: resolved.label,
    targets: resolved.codes,
    controllingTarget: null,
    bottleneck: [],
    nodes: [],
    sequentialCount: 0,
    earliestTermName: null,
    earliestSummary:
      status === "no-target"
        ? "Choose a target course or career direction to see the bottleneck chain."
        : extras.earliestSummary ?? "",
    delayImpacts: [],
    headline: null,
    ...extras,
  };
}

function compareCandidates(
  left: { chain: string[]; snapshot: TargetPathSnapshot; code: string },
  right: { chain: string[]; snapshot: TargetPathSnapshot; code: string },
): number {
  const length = right.chain.length - left.chain.length;
  if (length) return length;
  const term = termRank(right.snapshot.earliest.termName) - termRank(left.snapshot.earliest.termName);
  if (term) return term;
  const remaining = right.snapshot.path.remainingCodes.length - left.snapshot.path.remainingCodes.length;
  if (remaining) return remaining;
  return left.code.localeCompare(right.code, undefined, { numeric: true });
}

export function analyzeCriticalPath(
  targets: readonly string[],
  courses: readonly Course[],
  plan: StudentPlan,
  resolved: ResolvedTargetSet = {
    codes: [...targets],
    label: targets.length === 1 ? (targets[0] ?? "") : `${targets.length} targets`,
    source: targets.length ? "course" : "none",
  },
): CriticalPathAnalysis {
  if (!targets.length) return emptyAnalysis("no-target", { ...resolved, codes: [], source: resolved.source === "none" ? "none" : resolved.source, label: resolved.label });
  const snapshots = targets.map((code) => ({ code, snapshot: targetPathSnapshot(code, courses, plan) }));
  const schedulable = snapshots.filter(
    (item) => item.snapshot.path.status === "ok" && item.snapshot.earliest.reason === "ok",
  );
  if (!schedulable.length) {
    const first = snapshots[0]!.snapshot;
    return emptyAnalysis(statusFromSnapshot(first), resolved, {
      controllingTarget: snapshots[0]!.code,
      earliestTermName: first.earliest.termName,
      earliestSummary: first.earliest.summary,
      nodes: first.path.nodes,
    });
  }
  const ranked = schedulable.map((item) => ({
    ...item,
    chain: longestSequentialChain(item.snapshot.path),
  }));
  ranked.sort(compareCandidates);
  const winner = ranked[0]!;
  const delayImpacts = delayImpactsFor(winner.chain, winner.code, winner.snapshot, courses, plan);
  const bottleneckNodes = winner.chain.map((code) => {
    const existing = winner.snapshot.path.nodes.find((node) => node.code === code);
    if (existing) return existing;
    return { code, role: code === winner.code ? ("target" as const) : ("remaining" as const) };
  });
  return {
    status: "ok",
    source: resolved.source,
    label: resolved.label,
    targets: [...targets],
    controllingTarget: winner.code,
    bottleneck: winner.chain,
    nodes: bottleneckNodes,
    sequentialCount: winner.chain.length,
    earliestTermName: winner.snapshot.earliest.termName,
    earliestSummary: winner.snapshot.earliest.summary,
    delayImpacts,
    headline: delayImpacts[0]?.copy ?? null,
  };
}

export function analyzeResolvedCriticalPath(
  courseTargetCode: string | null | undefined,
  careerTargetId: string | null | undefined,
  pathways: readonly Pathway[],
  courses: readonly Course[],
  plan: StudentPlan,
): CriticalPathAnalysis {
  const resolved = resolveTargetSet(courseTargetCode, careerTargetId, pathways);
  return analyzeCriticalPath(resolved.codes, courses, plan, resolved);
}
