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
