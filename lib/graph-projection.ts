import { dependencyClosure } from "./validation";
import type { Course, DegreeRequirement } from "./types";
import {
  catalogRelations,
  programFlowPositions,
  selectedChainRelations,
  visibleGraphDistances,
  type GraphRelation,
} from "./graph";

export type GraphScope = "program" | "1" | "2" | "full";

export type ProjectedGraphNode = {
  code: string;
  position: { x: number; y: number };
};

export type GraphProjection = {
  visible: Map<string, number>;
  upstream: Set<string>;
  downstream: Set<string>;
  nodes: ProjectedGraphNode[];
  relations: GraphRelation[];
};

function courseTypeOrder(code: string, courses: Map<string, Course>) {
  const course = courses.get(code);
  if (!course || course.requirementType === "external") return 3;
  if (course.requirementType === "core") return 0;
  if (course.requirementType === "breadth") return 1;
  return 2;
}

export function buildGraphProjection({
  courses,
  requirements,
  scope,
  focusCode,
  selectedCode,
}: {
  courses: Course[];
  requirements: DegreeRequirement;
  scope: GraphScope;
  focusCode: string;
  selectedCode: string;
}): GraphProjection {
  const courseMap = new Map(courses.map((course) => [course.code, course]));
  const relations = catalogRelations(courses);
  const visible = visibleGraphDistances(scope, focusCode, courses, requirements, relations);
  const upstream = dependencyClosure(selectedCode, courses, "upstream");
  const downstream = dependencyClosure(selectedCode, courses, "downstream");
  const highlighted = new Set([selectedCode, ...upstream, ...downstream]);
  const scoped = relations.filter((relation) => visible.has(relation.source) && visible.has(relation.target));
  const drawn = scope === "program" ? selectedChainRelations(scoped, highlighted) : scoped;
  const compare = (left: string, right: string) =>
    courseTypeOrder(left, courseMap) - courseTypeOrder(right, courseMap) || left.localeCompare(right, undefined, { numeric: true });

  if (scope === "program") {
    return {
      visible,
      upstream,
      downstream,
      relations: drawn,
      nodes: [...programFlowPositions(visible.keys(), relations, compare)].map(([code, position]) => ({ code, position })),
    };
  }

  const focusUpstream = dependencyClosure(focusCode, courses, "upstream");
  const columns = new Map<number, string[]>();
  for (const [code, distance] of visible) {
    const rank = code === focusCode ? 0 : focusUpstream.has(code) ? -distance : distance;
    const group = columns.get(rank) ?? [];
    group.push(code);
    columns.set(rank, group);
  }
  const nodes: ProjectedGraphNode[] = [];
  const wrap = 4;
  let columnX = 0;
  for (const rank of [...columns.keys()].sort((left, right) => left - right)) {
    const codes = columns.get(rank)!.sort(compare);
    const width = Math.ceil(codes.length / wrap);
    codes.forEach((code, index) => {
      nodes.push({
        code,
        position: {
          x: (columnX + Math.floor(index / wrap)) * 230,
          y: (index % wrap) * 148 + (codes.length === 1 ? 148 : 0),
        },
      });
    });
    columnX += width;
  }
  return { visible, upstream, downstream, nodes, relations: drawn };
}
