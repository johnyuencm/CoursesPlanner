import type { Course, DegreeRequirement } from "./types";

export type ClassifiableCourse = Pick<Course, "code" | "requirementType" | "prerequisites">;

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

export const PROGRAM_COL = 188;
export const PROGRAM_ROW = 104;
export const PROGRAM_ISOLATE_GAP = 80;
export const PROGRAM_BAND_LABEL_ROW = 40;
export const PROGRAM_BAND_COPY = {
  "no-prerequisite": "No prerequisite required",
  unlinked: "Unlinked in this catalog",
} as const;
export type ProgramBandId = keyof typeof PROGRAM_BAND_COPY;
export type ProgramBandLabel = { id: ProgramBandId; label: string; x: number; y: number };

export function selectedChainRelations(relations: GraphRelation[], chain: Iterable<string>): GraphRelation[] {
  const keep = new Set(chain);
  return relations.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
}

export function directedPrerequisiteRelations(relations: readonly GraphRelation[]): GraphRelation[] {
  return relations.filter((edge) => !edge.corequisite);
}

export function classifyUnlinkedProgramCodes(
  codes: Iterable<string>,
  relations: readonly GraphRelation[],
  courses: Iterable<ClassifiableCourse>,
): { noPrerequisite: string[]; unlinked: string[] } {
  const keep = new Set(codes);
  const courseByCode = new Map<string, ClassifiableCourse>();
  for (const course of courses) courseByCode.set(course.code, course);

  const linked = new Set<string>();
  for (const edge of directedPrerequisiteRelations(relations)) {
    if (!keep.has(edge.source) || !keep.has(edge.target)) continue;
    linked.add(edge.source);
    linked.add(edge.target);
  }

  const noPrerequisite: string[] = [];
  const unlinked: string[] = [];
  for (const code of keep) {
    if (linked.has(code)) continue;
    const course = courseByCode.get(code);
    if (course && course.requirementType !== "external" && course.prerequisites.type === "none") {
      noPrerequisite.push(code);
    } else {
      unlinked.push(code);
    }
  }
  return { noPrerequisite, unlinked };
}

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

export function layoutProgramFlow(
  codes: Iterable<string>,
  relations: GraphRelation[],
  courses: Iterable<ClassifiableCourse> = [],
  compare: (left: string, right: string) => number = (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  nodeWidth = PROGRAM_COL,
  nodeHeight = PROGRAM_ROW,
  isolateGap = PROGRAM_ISOLATE_GAP,
): { positions: Map<string, { x: number; y: number }>; bands: ProgramBandLabel[] } {
  const keep = new Set(codes);
  const scoped = relations.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
  const prereqEdges = directedPrerequisiteRelations(scoped);
  const ranks = topologicalRanks(keep, prereqEdges);
  const linked = new Set<string>();
  for (const edge of prereqEdges) {
    linked.add(edge.source);
    linked.add(edge.target);
  }
  const connectedByRank = new Map<number, string[]>();
  for (const code of keep) {
    if (!linked.has(code)) continue;
    const rank = ranks.get(code) ?? 0;
    const group = connectedByRank.get(rank) ?? [];
    group.push(code);
    connectedByRank.set(rank, group);
  }
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of prereqEdges) {
    const outs = outgoing.get(edge.source) ?? [];
    outs.push(edge.target);
    outgoing.set(edge.source, outs);
    const ins = incoming.get(edge.target) ?? [];
    ins.push(edge.source);
    incoming.set(edge.target, ins);
  }
  const rankKeys = [...connectedByRank.keys()].sort((left, right) => left - right);
  const order = new Map<number, string[]>();
  for (const rank of rankKeys) order.set(rank, [...connectedByRank.get(rank)!].sort(compare));
  const indexInRank = (code: string) => {
    const group = order.get(ranks.get(code) ?? 0);
    if (!group) return 0;
    const index = group.indexOf(code);
    return index < 0 ? 0 : index;
  };
  for (let pass = 0; pass < 4; pass++) {
    for (const rank of rankKeys) {
      const group = order.get(rank)!;
      const score = (code: string) => {
        const neighbors = pass % 2 === 0 ? outgoing.get(code) ?? [] : incoming.get(code) ?? [];
        if (!neighbors.length) return indexInRank(code);
        return neighbors.reduce((sum, neighbor) => sum + indexInRank(neighbor), 0) / neighbors.length;
      };
      group.sort((left, right) => score(left) - score(right) || compare(left, right));
    }
  }
  const positions = new Map<string, { x: number; y: number }>();
  let flowBottom = 0;
  for (let column = rankKeys.length - 1; column >= 0; column--) {
    const rank = rankKeys[column]!;
    const group = order.get(rank)!;
    const x = column * nodeWidth;
    const used = new Set<number>();
    const aligned = group
      .map((code) => {
        const children = (outgoing.get(code) ?? []).filter((child) => positions.has(child));
        if (!children.length) return null;
        const ys = children.map((child) => positions.get(child)!.y).sort((left, right) => left - right);
        return { code, y: ys[Math.floor((ys.length - 1) / 2)]! };
      })
      .filter((item): item is { code: string; y: number } => item !== null)
      .sort((left, right) => left.y - right.y || compare(left.code, right.code));
    const childCount = (code: string) => (outgoing.get(code) ?? []).filter((child) => positions.has(child)).length;
    const exclusive = aligned.filter((item) => childCount(item.code) === 1);
    const multi = aligned.filter((item) => childCount(item.code) !== 1);
    for (const item of [...exclusive, ...multi]) {
      let y = item.y;
      while (used.has(y)) y += nodeHeight;
      used.add(y);
      positions.set(item.code, { x, y });
      flowBottom = Math.max(flowBottom, y + nodeHeight);
    }
    let y = 0;
    for (const code of group.filter((code) => !positions.has(code)).sort(compare)) {
      while (used.has(y)) y += nodeHeight;
      used.add(y);
      positions.set(code, { x, y });
      flowBottom = Math.max(flowBottom, y + nodeHeight);
      y += nodeHeight;
    }
  }
  const classified = classifyUnlinkedProgramCodes(keep, relations, courses);
  const bands: ProgramBandLabel[] = [];
  let cursor = positions.size ? flowBottom + isolateGap : 0;
  const packBand = (id: ProgramBandId, bandCodes: string[]) => {
    if (!bandCodes.length) return;
    bands.push({ id, label: PROGRAM_BAND_COPY[id], x: 0, y: cursor });
    cursor += PROGRAM_BAND_LABEL_ROW;
    const { columns } = programGridDimensions(bandCodes.length, nodeWidth, nodeHeight);
    [...bandCodes].sort(compare).forEach((code, index) => {
      const y = cursor + Math.floor(index / columns) * nodeHeight;
      positions.set(code, { x: (index % columns) * nodeWidth, y });
    });
    cursor += Math.ceil(bandCodes.length / columns) * nodeHeight + isolateGap;
  };
  packBand("no-prerequisite", classified.noPrerequisite);
  packBand("unlinked", classified.unlinked);
  return { positions, bands };
}

export function programFlowPositions(
  codes: Iterable<string>,
  relations: GraphRelation[],
  compare: (left: string, right: string) => number = (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  nodeWidth = PROGRAM_COL,
  nodeHeight = PROGRAM_ROW,
  isolateGap = PROGRAM_ISOLATE_GAP,
): Map<string, { x: number; y: number }> {
  return layoutProgramFlow(codes, relations, [], compare, nodeWidth, nodeHeight, isolateGap).positions;
}

export function normalizeFindNeedle(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, "");
}

export type FindableCourse = { code: string; title: string };

export function findCourses<T extends FindableCourse>(
  courses: readonly T[],
  query: string,
  onMap: Iterable<string> = [],
): T[] {
  const needle = normalizeFindNeedle(query);
  if (!needle) return [];
  const visible = onMap instanceof Set ? onMap : new Set(onMap);
  const scored: { course: T; score: number }[] = [];
  for (const course of courses) {
    const code = normalizeFindNeedle(course.code);
    const title = normalizeFindNeedle(course.title);
    if (!code.includes(needle) && !title.includes(needle)) continue;
    let score = 0;
    if (visible.has(course.code)) score += 1000;
    if (code === needle) score += 400;
    else if (code.startsWith(needle)) score += 200;
    else if (code.includes(needle)) score += 20;
    if (title.startsWith(needle)) score += 50;
    scored.push({ course, score });
  }
  scored.sort(
    (left, right) =>
      right.score - left.score || left.course.code.localeCompare(right.course.code, undefined, { numeric: true }),
  );
  return scored.map((item) => item.course);
}

export function wrapFindIndex(current: number, count: number, step: number): number {
  if (count <= 0) return -1;
  if (current < 0) return step < 0 ? count - 1 : 0;
  return (current + step + count) % count;
}

export function shouldAutoLocateFind(query: string, matchCount: number): boolean {
  if (matchCount <= 0) return false;
  return matchCount === 1 || normalizeFindNeedle(query).length >= 4;
}
