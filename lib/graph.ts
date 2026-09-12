import type { Course, DegreeRequirement } from "./types";

export type GraphRelation = { source: string; target: string; corequisite: boolean };

export function listedProgramCodes(requirements: DegreeRequirement): string[] {
  return [
    ...new Set([
      ...requirements.coreCourses,
      ...requirements.eligibleElectives,
      ...requirements.breadthRequirements.categories.flatMap((category) => category.courses),
    ]),
  ];
}

export function programMapCodes(courses: Course[], requirements: DegreeRequirement): Set<string> {
  const listed = new Set(listedProgramCodes(requirements));
  const present = new Set(courses.map((course) => course.code));
  const visible = new Set<string>();
  for (const course of courses) {
    if (!listed.has(course.code)) continue;
    visible.add(course.code);
    for (const dependency of [...course.prerequisiteCodes, ...course.corequisiteCodes]) {
      if (present.has(dependency)) visible.add(dependency);
    }
  }
  return visible;
}

export function catalogRelations(courses: Course[]): GraphRelation[] {
  const result: GraphRelation[] = [];
  const coreqPairs = new Set<string>();
  for (const course of courses) {
    for (const code of course.prerequisiteCodes) {
      result.push({ source: code, target: course.code, corequisite: false });
    }
    for (const code of course.corequisiteCodes) {
      const pair = [course.code, code].sort().join("|");
      if (coreqPairs.has(pair)) continue;
      result.push({ source: code, target: course.code, corequisite: true });
      coreqPairs.add(pair);
    }
  }
  return result;
}

export function neighborhoodDistances(
  focusCode: string,
  relations: GraphRelation[],
  maxDepth: number,
): Map<string, number> {
  const distances = new Map<string, number>([[focusCode, 0]]);
  let frontier = [focusCode];
  for (let step = 0; step < maxDepth && frontier.length; step++) {
    const next: string[] = [];
    for (const code of frontier) {
      for (const edge of relations) {
        const neighbor = edge.source === code ? edge.target : edge.target === code ? edge.source : null;
        if (neighbor && !distances.has(neighbor)) {
          distances.set(neighbor, step + 1);
          next.push(neighbor);
        }
      }
    }
    frontier = next;
  }
  return distances;
}

export function topologicalRanks(codes: Iterable<string>, relations: GraphRelation[]): Map<string, number> {
  const keep = new Set(codes);
  const incoming = new Map<string, string[]>();
  for (const code of keep) incoming.set(code, []);
  for (const edge of relations) {
    if (!keep.has(edge.source) || !keep.has(edge.target)) continue;
    incoming.get(edge.target)?.push(edge.source);
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
  for (const code of keep) rankOf(code);
  return memo;
}

export function visibleGraphDistances(
  scope: "program" | "1" | "2" | "full",
  focusCode: string,
  courses: Course[],
  requirements: DegreeRequirement,
  relations: GraphRelation[],
): Map<string, number> {
  if (scope === "program") {
    return topologicalRanks(programMapCodes(courses, requirements), relations);
  }
  const maxDepth = scope === "full" ? relations.length + 1 : Number(scope);
  return neighborhoodDistances(focusCode, relations, maxDepth);
}

export const PROGRAM_COL = 164;
export const PROGRAM_ROW = 64;
export const PROGRAM_WRAP_ROWS = 10;
export const PROGRAM_ISOLATE_GAP = 80;

export function programGridDimensions(
  count: number,
  nodeWidth = 176,
  nodeHeight = 92,
  canvasAspect = 10 / 7,
): { columns: number; rows: number } {
  if (count <= 0) return { columns: 1, rows: 1 };
  const columns = Math.max(1, Math.round(Math.sqrt(count * canvasAspect * (nodeHeight / nodeWidth))));
  const rows = Math.max(1, Math.ceil(count / columns));
  return { columns, rows };
}

export function programFlowPositions(
  codes: Iterable<string>,
  relations: GraphRelation[],
  compare: (left: string, right: string) => number = (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  nodeWidth = PROGRAM_COL,
  nodeHeight = PROGRAM_ROW,
  wrapRows = PROGRAM_WRAP_ROWS,
  isolateGap = PROGRAM_ISOLATE_GAP,
): Map<string, { x: number; y: number }> {
  const keep = new Set(codes);
  const scoped = relations.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
  const ranks = topologicalRanks(keep, scoped.filter((edge) => !edge.corequisite));
  for (const edge of scoped) {
    if (!edge.corequisite) continue;
    const shared = Math.min(ranks.get(edge.source) ?? 0, ranks.get(edge.target) ?? 0);
    ranks.set(edge.source, shared);
    ranks.set(edge.target, shared);
  }
  const linked = new Set<string>();
  for (const edge of scoped) {
    linked.add(edge.source);
    linked.add(edge.target);
  }
  const connectedByRank = new Map<number, string[]>();
  const isolates: string[] = [];
  for (const code of keep) {
    if (!linked.has(code)) {
      isolates.push(code);
      continue;
    }
    const rank = ranks.get(code) ?? 0;
    const group = connectedByRank.get(rank) ?? [];
    group.push(code);
    connectedByRank.set(rank, group);
  }
  const positions = new Map<string, { x: number; y: number }>();
  let columnX = 0;
  let flowBottom = 0;
  for (const rank of [...connectedByRank.keys()].sort((left, right) => left - right)) {
    const group = connectedByRank.get(rank)!.sort(compare);
    group.forEach((code, index) => {
      const x = (columnX + Math.floor(index / wrapRows)) * nodeWidth;
      const y = (index % wrapRows) * nodeHeight;
      positions.set(code, { x, y });
      flowBottom = Math.max(flowBottom, y + nodeHeight);
    });
    columnX += Math.max(1, Math.ceil(group.length / wrapRows));
  }
  const isolateStartY = positions.size ? flowBottom + isolateGap : 0;
  const { columns } = programGridDimensions(isolates.length, nodeWidth, nodeHeight);
  isolates.sort(compare).forEach((code, index) => {
    positions.set(code, {
      x: (index % columns) * nodeWidth,
      y: isolateStartY + Math.floor(index / columns) * nodeHeight,
    });
  });
  return positions;
}
