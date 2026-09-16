import type { Course, DegreeRequirement } from "./types";

export { prerequisitePathToTarget, type TargetPath, type TargetPathNode } from "./target-path";

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

function neighborhoodDistances(
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

function topologicalRanks(codes: Iterable<string>, relations: GraphRelation[]): Map<string, number> {
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

export type GraphScope = "course" | "program" | "1" | "2" | "full" | "prerequisites" | "unlocks";

export function visibleGraphDistances(
  scope: GraphScope,
  focusCode: string,
  courses: Course[],
  requirements: DegreeRequirement,
  relations: GraphRelation[],
): Map<string, number> {
  if (scope === "course") {
    return new Map([...directedCourseChain(relations, focusCode)].map((code) => [code, 0]));
  }
  if (scope === "program") {
    return topologicalRanks(programMapCodes(courses, requirements), relations);
  }
  if (scope === "prerequisites") {
    const incoming = new Map<string, Set<string>>();
    for (const edge of relations) {
      if (!edge.corequisite) addRelation(incoming, edge.target, edge.source);
    }
    return new Map([focusCode, ...walkRelations(focusCode, incoming)].map((code) => [code, 0]));
  }
  if (scope === "unlocks") {
    const outgoing = new Map<string, Set<string>>();
    for (const edge of relations) {
      if (!edge.corequisite) addRelation(outgoing, edge.source, edge.target);
    }
    return new Map([focusCode, ...walkRelations(focusCode, outgoing)].map((code) => [code, 0]));
  }
  const maxDepth = scope === "full" ? relations.length + 1 : Number(scope);
  return neighborhoodDistances(focusCode, relations, maxDepth);
}

export const PROGRAM_COL = 360;
export const PROGRAM_ROW = 160;
export const PROGRAM_ISOLATE_GAP = 80;
export const PROGRAM_BAND_LABEL_ROW = 40;
export const PROGRAM_BAND_COPY = {
  "no-prerequisite": "No prerequisite required",
  unlinked: "Unlinked in this catalog",
} as const;
export type ProgramBandId = keyof typeof PROGRAM_BAND_COPY;
export type ProgramBandLabel = { id: ProgramBandId; label: string; x: number; y: number };

function selectedChainRelations(relations: GraphRelation[], chain: Iterable<string>): GraphRelation[] {
  const keep = new Set(chain);
  return relations.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
}

function directedPrerequisiteRelations(relations: readonly GraphRelation[]): GraphRelation[] {
  return relations.filter((edge) => !edge.corequisite);
}

export type UnlockArrow = {
  source: string;
  target: string;
  emphasized: boolean;
  stroke: string;
};

export const GRAPH_HIT_TARGET_WIDTH = 18;
export const GRAPH_HIT_TARGET_GAP = 4;
export const GRAPH_SELECTED_EDGE_Z = 4;
export const GRAPH_NODE_Z = { dimmed: 5, emphasized: 6, focused: 12 } as const;
export const GRAPH_READABLE_ZOOM = 1;
export const GRAPH_MIN_ZOOM = 0.25;
export const GRAPH_MAX_ZOOM = 2;
export const GRAPH_FIT_MIN_ZOOM = 0.05;
export const GRAPH_FIT_PADDING = 20;
export const GRAPH_CARD_WIDTH = 224;
export const GRAPH_CARD_HEIGHT = 116;

export type GraphViewport = {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
};

export function clampGraphZoom(zoom: number, min = GRAPH_MIN_ZOOM, max = GRAPH_MAX_ZOOM): number {
  if (!Number.isFinite(zoom)) return GRAPH_READABLE_ZOOM;
  return Math.min(max, Math.max(min, zoom));
}

export function graphZoomPercent(zoom: number): number {
  return Math.round((Number.isFinite(zoom) ? zoom : GRAPH_READABLE_ZOOM) * 100);
}

export function graphCourseZIndex(input: { focused: boolean; emphasized: boolean }): number {
  if (input.focused) return GRAPH_NODE_Z.focused;
  if (input.emphasized) return GRAPH_NODE_Z.emphasized;
  return GRAPH_NODE_Z.dimmed;
}

export function graphFitZoom(
  container: { width: number; height: number },
  map: { width: number; height: number },
  padding = GRAPH_FIT_PADDING,
): number {
  if (container.width <= padding || container.height <= padding || map.width <= 0 || map.height <= 0) return GRAPH_READABLE_ZOOM;
  const fit = Math.min((container.width - padding) / map.width, (container.height - padding) / map.height);
  return Math.min(GRAPH_READABLE_ZOOM, Math.max(GRAPH_FIT_MIN_ZOOM, fit));
}

// The acknowledgment belongs to the workspace, so remounting the map cannot
// swallow a pending request or replay one that was already applied.
export function consumeGraphFitRequest(
  request: number,
  acknowledged: { current: number },
  container: { width: number; height: number },
  map: { width: number; height: number },
): number | null {
  if (request <= acknowledged.current || container.width <= 0 || container.height <= 0) return null;
  acknowledged.current = request;
  return graphFitZoom(container, map);
}

export function centeredGraphZoomScroll(viewport: GraphViewport, previousZoom: number, nextZoom: number): { left: number; top: number } {
  const ratio = nextZoom / Math.max(GRAPH_FIT_MIN_ZOOM, previousZoom);
  return {
    left: Math.max(0, (viewport.scrollLeft + viewport.clientWidth / 2) * ratio - viewport.clientWidth / 2),
    top: Math.max(0, (viewport.scrollTop + viewport.clientHeight / 2) * ratio - viewport.clientHeight / 2),
  };
}

export function selectedGraphScroll(
  point: { x: number; y: number },
  zoom: number,
  viewport: GraphViewport,
): { left: number; top: number } {
  const left = (point.x + 32) * zoom;
  const top = (point.y + 32) * zoom;
  const width = GRAPH_CARD_WIDTH * zoom;
  const height = GRAPH_CARD_HEIGHT * zoom;
  const outsideX = left < viewport.scrollLeft || left + width > viewport.scrollLeft + viewport.clientWidth;
  const outsideY = top < viewport.scrollTop || top + height > viewport.scrollTop + viewport.clientHeight;
  return {
    left: outsideX ? Math.max(0, left - (viewport.clientWidth - width) / 2) : viewport.scrollLeft,
    top: outsideY ? Math.max(0, top - (viewport.clientHeight - height) / 2) : viewport.scrollTop,
  };
}

const GRAPH_NODE_WIDTH = 224;
const GRAPH_HANDLE_Y = 58;
const SHORT_PREREQUISITE_DX = 180;
const LONG_PREREQUISITE_LANE_DY = 82;

function isShortPrerequisiteEdge(sourceX: number, targetX: number) {
  return targetX - sourceX <= SHORT_PREREQUISITE_DX && targetX > sourceX;
}

function prerequisiteEntryY(source: { x: number; y: number }, target: { x: number; y: number }) {
  return isShortPrerequisiteEdge(source.x + GRAPH_NODE_WIDTH, target.x)
    ? source.y + GRAPH_HANDLE_Y
    : source.y + GRAPH_HANDLE_Y + LONG_PREREQUISITE_LANE_DY;
}

export type PrerequisiteBusMeta = {
  busOwner: string;
  busStartY: number;
  busEndY: number;
};

/**
 * Per-destination bus owner (lexicographically least source) and the vertical
 * span covering every incoming entry Y plus the target handle.
 */
export function prerequisiteBusMeta(
  edges: readonly { source: string; target: string }[],
  positions: ReadonlyMap<string, { x: number; y: number }>,
): Map<string, PrerequisiteBusMeta> {
  const owners = new Map<string, string>();
  const bounds = new Map<string, { start: number; end: number }>();
  for (const edge of edges) {
    const owner = owners.get(edge.target);
    if (!owner || edge.source.localeCompare(owner, undefined, { numeric: true }) < 0) {
      owners.set(edge.target, edge.source);
    }
    const source = positions.get(edge.source);
    const target = positions.get(edge.target);
    if (!source || !target) continue;
    const entryY = prerequisiteEntryY(source, target);
    const handleY = target.y + GRAPH_HANDLE_Y;
    const previous = bounds.get(edge.target);
    bounds.set(edge.target, {
      start: Math.min(previous?.start ?? entryY, entryY, handleY),
      end: Math.max(previous?.end ?? entryY, entryY, handleY),
    });
  }
  const result = new Map<string, PrerequisiteBusMeta>();
  for (const [target, busOwner] of owners) {
    const span = bounds.get(target);
    if (!span) continue;
    result.set(target, { busOwner, busStartY: span.start, busEndY: span.end });
  }
  return result;
}

/**
 * The visible connector joins at the bus, while its two interaction regions
 * stop short / start at the junction. Their 18px hit strokes therefore never
 * overlap, regardless of edge render order or selection z-index.
 */
export function prerequisiteHitPaths(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  busOffset: number,
  busStartY: number,
  busEndY: number,
): { branch: string; bus: string } {
  const busX = targetX - busOffset;
  const branchEndX = busX - GRAPH_HIT_TARGET_WIDTH - GRAPH_HIT_TARGET_GAP;
  const branch = isShortPrerequisiteEdge(sourceX, targetX)
    ? `M ${sourceX} ${sourceY} H ${branchEndX}`
    : `M ${sourceX} ${sourceY} H ${sourceX + 20} V ${sourceY + LONG_PREREQUISITE_LANE_DY} H ${branchEndX}`;
  return { branch, bus: `M ${busX} ${busStartY} V ${busEndY} M ${busX} ${targetY} H ${targetX}` };
}

const DESTINATION_COLORS = ["#2d6a9f", "#8b5a2b", "#7b4f9e", "#24756d", "#a64253", "#566c2d", "#8a4d74"];

export function stableDestinationColor(destination: string): string {
  let hash = 0;
  for (const character of destination) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return DESTINATION_COLORS[hash % DESTINATION_COLORS.length]!;
}

export type RelationshipSelection =
  | { kind: "branch"; source: string; target: string; codes: Set<string> }
  | { kind: "bus"; target: string; sources: string[]; codes: Set<string> };

type RelationInput = { source: string; target: string; corequisite?: boolean };

export type RelationshipControlGroup = {
  target: string;
  sources: string[];
  branches: RelationInput[];
};

export function relationshipControlGroups(relations: readonly RelationInput[]): RelationshipControlGroup[] {
  const groups = new Map<string, RelationInput[]>();
  for (const relation of relations) {
    if (relation.corequisite) continue;
    const target = groups.get(relation.target) ?? [];
    target.push(relation);
    groups.set(relation.target, target);
  }
  return [...groups.entries()]
    .map(([target, branches]) => {
      const sorted = [...branches].sort((left, right) => left.source.localeCompare(right.source, undefined, { numeric: true }));
      return { target, sources: sorted.map((branch) => branch.source), branches: sorted };
    })
    .sort((left, right) => left.target.localeCompare(right.target, undefined, { numeric: true }));
}

export const relationshipSelection = {
  branch(source: string, target: string): RelationshipSelection {
    return { kind: "branch", source, target, codes: new Set([source, target]) };
  },
  bus(relations: readonly RelationInput[], target: string): RelationshipSelection {
    const sources = relations.filter((edge) => !edge.corequisite && edge.target === target).map((edge) => edge.source).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
    return { kind: "bus", target, sources, codes: new Set([...sources, target]) };
  },
  isSelected(selection: RelationshipSelection | null, source: string, target: string) {
    if (!selection) return false;
    return selection.kind === "branch"
      ? selection.source === source && selection.target === target
      : selection.target === target;
  },
};

export function unlockArrowView(
  relations: readonly GraphRelation[],
  chainCodes: Iterable<string>,
  visible?: Iterable<string>,
): UnlockArrow[] {
  const keep = visible ? new Set(visible) : null;
  const directed = directedPrerequisiteRelations(relations).filter(
    (edge) => !keep || (keep.has(edge.source) && keep.has(edge.target)),
  );
  const chainKeys = new Set(
    selectedChainRelations(directed, chainCodes).map((edge) => `${edge.source}->${edge.target}`),
  );
  return directed.map((edge) => {
    const emphasized = chainKeys.has(`${edge.source}->${edge.target}`);
    return {
      source: edge.source,
      target: edge.target,
      emphasized,
      stroke: stableDestinationColor(edge.target),
    };
  });
}

function classifyUnlinkedProgramCodes(
  codes: Iterable<string>,
  relations: readonly GraphRelation[],
  courses: Iterable<ClassifiableCourse>,
): { noPrerequisite: string[]; unlinked: string[] } {
  const keep = new Set(codes);
  const courseByCode = new Map<string, ClassifiableCourse>();
  for (const course of courses) courseByCode.set(course.code, course);

  const linked = new Set<string>();
  for (const edge of relations) {
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

function programGridDimensions(
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

export type MapScene = {
  visible: Map<string, number>;
  positions: Map<string, { x: number; y: number }>;
  bands: ProgramBandLabel[];
  arrows: UnlockArrow[];
  chain: Set<string>;
  neighborhood: Set<string>;
  focusPrerequisites: string[];
  focusUnlocks: string[];
};

export type MapSceneInput = {
  courses: Course[];
  requirements: DegreeRequirement;
  scope: GraphScope;
  focusCode: string;
  selectedCode: string;
  compare?: (left: string, right: string) => number;
  /** When set, drop every other visible node before layout. Used by Only my planned. */
  keep?: Iterable<string>;
};

export function restrictVisibleDistances(
  visible: Map<string, number>,
  keep: Iterable<string> | undefined,
): Map<string, number> {
  if (!keep) return visible;
  const allowed = keep instanceof Set ? keep : new Set(keep);
  const next = new Map<string, number>();
  for (const [code, distance] of visible) {
    if (allowed.has(code)) next.set(code, distance);
  }
  return next;
}

export function plannedOnlyKeep(
  recorded: Iterable<string>,
  extras: Iterable<string> = [],
): Set<string> {
  return new Set([...recorded, ...extras]);
}

function addRelation(graph: Map<string, Set<string>>, from: string, to: string) {
  const next = graph.get(from) ?? new Set<string>();
  next.add(to);
  graph.set(from, next);
}

function walkRelations(start: string, graph: Map<string, Set<string>>): Set<string> {
  const result = new Set<string>();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of graph.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      result.add(next);
      queue.push(next);
    }
  }
  return result;
}

export function directedCourseChain(relations: readonly GraphRelation[], selectedCode: string): Set<string> {
  const upstream = new Map<string, Set<string>>();
  const downstream = new Map<string, Set<string>>();
  for (const edge of relations) {
    if (edge.corequisite) continue;
    addRelation(upstream, edge.target, edge.source);
    addRelation(downstream, edge.source, edge.target);
  }
  return new Set([
    selectedCode,
    ...walkRelations(selectedCode, upstream),
    ...walkRelations(selectedCode, downstream),
  ]);
}

export type CourseFocusNeighborhood = {
  selected: string;
  prerequisites: string[];
  unlocks: string[];
  codes: Set<string>;
};

function sortedCodes(codes: Iterable<string>): string[] {
  return [...codes].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

/** Immediate named prerequisites and unlocks of one course, excluding corequisites. */
export function courseFocusNeighborhood(
  relations: readonly GraphRelation[],
  selectedCode: string,
): CourseFocusNeighborhood {
  const prerequisites = new Set<string>();
  const unlocks = new Set<string>();
  for (const edge of relations) {
    if (edge.corequisite) continue;
    if (edge.target === selectedCode && edge.source !== selectedCode) prerequisites.add(edge.source);
    if (edge.source === selectedCode && edge.target !== selectedCode) unlocks.add(edge.target);
  }
  const prerequisiteList = sortedCodes(prerequisites);
  const unlockList = sortedCodes(unlocks);
  return {
    selected: selectedCode,
    prerequisites: prerequisiteList,
    unlocks: unlockList,
    codes: new Set([selectedCode, ...prerequisiteList, ...unlockList]),
  };
}

export function isFocusNeighborhoodEdge(
  source: string,
  target: string,
  selectedCode: string,
  neighborhood: ReadonlySet<string>,
): boolean {
  if (!neighborhood.has(source) || !neighborhood.has(target)) return false;
  return source === selectedCode || target === selectedCode;
}

export function prerequisiteChecks(
  codes: readonly string[],
  satisfied: Iterable<string>,
): { code: string; met: boolean }[] {
  const done = satisfied instanceof Set ? satisfied : new Set(satisfied);
  return sortedCodes(new Set(codes)).map((code) => ({ code, met: done.has(code) }));
}

function requirementTypeOrder(code: string, courses: Map<string, Pick<Course, "requirementType">>) {
  const course = courses.get(code);
  if (!course || course.requirementType === "external") return 3;
  if (course.requirementType === "core") return 0;
  if (course.requirementType === "breadth") return 1;
  return 2;
}

export function mapScene(input: MapSceneInput): MapScene {
  const relations = catalogRelations(input.courses);
  const visible = restrictVisibleDistances(
    visibleGraphDistances(
      input.scope,
      input.focusCode,
      input.courses,
      input.requirements,
      relations,
    ),
    input.keep,
  );
  const chain = directedCourseChain(relations, input.selectedCode);
  const courseByCode = new Map(input.courses.map((course) => [course.code, course] as const));
  const compare =
    input.compare ??
    ((left, right) =>
      requirementTypeOrder(left, courseByCode) - requirementTypeOrder(right, courseByCode) ||
      left.localeCompare(right, undefined, { numeric: true }));
  const layout = layoutProgramFlow(visible.keys(), relations, input.courses, compare);
  const arrows = unlockArrowView(relations, chain, visible.keys());
  const neighborhood = courseFocusNeighborhood(relations, input.selectedCode);
  // Reserve a separate vertical track for each destination, so unrelated buses
  // cannot merge into one ambiguous line in the gutter between columns.
  const destinations = new Map<number, Set<string>>();
  for (const arrow of arrows) {
    const x = layout.positions.get(arrow.target)?.x;
    if (x === undefined) continue;
    const column = destinations.get(x) ?? new Set<string>();
    column.add(arrow.target);
    destinations.set(x, column);
  }
  const columnWidth = Math.max(PROGRAM_COL, 304 + 10 * Math.max(0, ...[...destinations.values()].map((column) => column.size)));
  for (const point of layout.positions.values()) point.x = point.x / PROGRAM_COL * columnWidth;
  return {
    visible,
    positions: layout.positions,
    bands: input.scope === "program" ? layout.bands : [],
    arrows,
    chain,
    neighborhood: neighborhood.codes,
    focusPrerequisites: neighborhood.prerequisites,
    focusUnlocks: neighborhood.unlocks,
  };
}

/** Orthogonal incoming bus; long edges travel in the gutter below their source row. */
export function prerequisiteConnector(sourceX: number, sourceY: number, targetX: number, targetY: number, busOffset = 36): string {
  const busX = targetX - busOffset;
  if (isShortPrerequisiteEdge(sourceX, targetX)) {
    return `M ${sourceX} ${sourceY} H ${busX} V ${targetY} H ${targetX}`;
  }
  const laneY = sourceY + LONG_PREREQUISITE_LANE_DY;
  return `M ${sourceX} ${sourceY} H ${sourceX + 20} V ${laneY} H ${busX} V ${targetY} H ${targetX}`;
}

export function layoutProgramFlow(
  codes: Iterable<string>,
  relations: GraphRelation[],
  courses: Iterable<ClassifiableCourse>,
  compare: (left: string, right: string) => number = (left, right) => left.localeCompare(right, undefined, { numeric: true }),
  nodeWidth = PROGRAM_COL,
  nodeHeight = PROGRAM_ROW,
  isolateGap = PROGRAM_ISOLATE_GAP,
): { positions: Map<string, { x: number; y: number }>; bands: ProgramBandLabel[] } {
  const keep = new Set(codes);
  const scoped = relations.filter((edge) => keep.has(edge.source) && keep.has(edge.target));
  const prereqEdges = directedPrerequisiteRelations(scoped);
  const ranks = topologicalRanks(keep, prereqEdges);
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
  for (const code of keep) {
    if (!linked.has(code)) continue;
    const rank = ranks.get(code) ?? 0;
    const group = connectedByRank.get(rank) ?? [];
    group.push(code);
    connectedByRank.set(rank, group);
  }
  const coreqPartners = new Map<string, string[]>();
  for (const edge of scoped) {
    if (!edge.corequisite) continue;
    const add = (from: string, to: string) => {
      const partners = coreqPartners.get(from) ?? [];
      partners.push(to);
      coreqPartners.set(from, partners);
    };
    add(edge.source, edge.target);
    add(edge.target, edge.source);
  }
  for (const partners of coreqPartners.values()) partners.sort(compare);
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
    const occupy = (code: string, preferredY: number) => {
      if (positions.has(code)) return;
      let y = preferredY;
      while (used.has(y)) y += nodeHeight;
      used.add(y);
      positions.set(code, { x, y });
      flowBottom = Math.max(flowBottom, y + nodeHeight);
      let partnerY = y + nodeHeight;
      for (const partner of coreqPartners.get(code) ?? []) {
        if (positions.has(partner)) continue;
        if ((ranks.get(partner) ?? 0) !== rank) continue;
        while (used.has(partnerY)) partnerY += nodeHeight;
        used.add(partnerY);
        positions.set(partner, { x, y: partnerY });
        flowBottom = Math.max(flowBottom, partnerY + nodeHeight);
        partnerY += nodeHeight;
      }
    };
    for (const item of [...exclusive, ...multi]) occupy(item.code, item.y);
    let y = 0;
    for (const code of group.filter((code) => !positions.has(code)).sort(compare)) {
      if (positions.has(code)) continue;
      occupy(code, y);
      y = (positions.get(code)?.y ?? y) + nodeHeight;
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

function normalizeFindNeedle(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, "");
}

export type FindableCourse = { code: string; title: string };

function findCourses<T extends FindableCourse>(
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

function wrapFindIndex(current: number, count: number, step: number): number {
  if (count <= 0) return -1;
  if (current < 0) return step < 0 ? count - 1 : 0;
  return (current + step + count) % count;
}

function shouldAutoLocateFind(query: string, matchCount: number): boolean {
  if (matchCount <= 0) return false;
  return matchCount === 1 || normalizeFindNeedle(query).length >= 4;
}

function elementWithClosest(target: EventTarget | null): { closest: (selector: string) => unknown } | null {
  if (target === null || typeof target !== "object" || !("closest" in target)) return null;
  const closest = (target as { closest: unknown }).closest;
  return typeof closest === "function" ? (target as { closest: (selector: string) => unknown }) : null;
}

function isGraphFindSkipTarget(target: EventTarget | null): boolean {
  const element = elementWithClosest(target);
  if (!element) return false;
  return Boolean(element.closest("dialog, [role='dialog']"));
}

function tagNameOf(target: EventTarget | null): string {
  if (target === null || typeof target !== "object") return "";
  const tag = (target as { tagName?: unknown }).tagName;
  return typeof tag === "string" ? tag.toLowerCase() : "";
}

function isGraphFindEscapeScope(target: EventTarget | null): boolean {
  const element = elementWithClosest(target);
  if (!element) return true;
  if (element.closest(".graph-search-wrap, #graph-find, .flow-canvas")) return true;
  const tag = tagNameOf(target);
  if (tag === "input" || tag === "select" || tag === "textarea" || tag === "option") return false;
  return Boolean(element.closest(".graph-panel"));
}

function shouldClearGraphFindOnEscape(
  key: string,
  findQuery: string,
  target: EventTarget | null,
): boolean {
  if (key !== "Escape") return false;
  if (!findQuery.trim()) return false;
  if (isGraphFindSkipTarget(target)) return false;
  return isGraphFindEscapeScope(target);
}

export function shouldClearLineFocusOnEscape(
  event: { key: string; target?: EventTarget | null },
  input: { active: boolean; findQuery: string; fullscreen: boolean },
): boolean {
  const target = event.target ?? null;
  if (event.key !== "Escape") return false;
  if (!input.active || input.fullscreen) return false;
  if (isGraphFindSkipTarget(target)) return false;
  if (shouldClearGraphFindOnEscape(event.key, input.findQuery, target)) return false;
  const tag = tagNameOf(target);
  if (tag === "input" || tag === "select" || tag === "textarea" || tag === "option") return false;
  const element = elementWithClosest(target);
  if (!element) return true;
  return Boolean(element.closest(".graph-layout"));
}

export type MapFindKeyEvent = {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  target?: EventTarget | null;
};

export type MapFindIntent =
  | { type: "none" }
  | { type: "skip" }
  | { type: "focus" }
  | { type: "clear" }
  | { type: "cycle"; step: number };

function visibleCodes(visible: Iterable<string> | Map<string, unknown> | Set<string>): Set<string> {
  if (visible instanceof Set) return visible;
  if (visible instanceof Map) return new Set(visible.keys());
  return new Set(visible);
}

export const mapFind = {
  query<T extends FindableCourse>(courses: readonly T[], query: string, onMap: Iterable<string> = []) {
    const matches = findCourses(courses, query, onMap);
    return { matches, autoLocate: shouldAutoLocateFind(query, matches.length) };
  },
  intent(event: MapFindKeyEvent, query: string): MapFindIntent {
    const target = event.target ?? null;
    if (isGraphFindSkipTarget(target)) return { type: "skip" };
    const modifier = Boolean(event.ctrlKey || event.metaKey);
    if ((event.key === "f" || event.key === "F") && modifier && !event.altKey) return { type: "focus" };
    if (shouldClearGraphFindOnEscape(event.key, query, target)) return { type: "clear" };
    const findNext = event.key === "F3" || ((event.key === "g" || event.key === "G") && modifier);
    if (findNext) return { type: "cycle", step: event.shiftKey ? -1 : 1 };
    return { type: "none" };
  },
  cycleIndex: wrapFindIndex,
  reveal(code: string, visible: Iterable<string> | Map<string, unknown> | Set<string>) {
    return { code, neighborhood: !visibleCodes(visible).has(code) };
  },
};

/** Inspector prereq/unlock/coreq chips: inspect when the course is on the current map, otherwise locate. */
export function graphInspectorLinkAction(
  code: string,
  visible: Iterable<string> | Map<string, unknown> | Set<string>,
): "inspect" | "locate" {
  return visibleCodes(visible).has(code) ? "inspect" : "locate";
}

export function compactGraphStatusLabel(fullLabel: string): string {
  return fullLabel === "Prerequisite eligible" ? "Eligible" : fullLabel;
}

export type GraphFocusStatusId = "completed" | "in-progress" | "available" | "planned" | "blocked" | "review";

export type GraphFocusStatus = {
  id: GraphFocusStatusId;
  label: string;
  className: string;
};

export const GRAPH_FOCUS_STATUS_LEGEND = [
  { id: "completed", label: "Completed", className: "completed" },
  { id: "in-progress", label: "In progress", className: "in-progress" },
  { id: "available", label: "Available", className: "available" },
  { id: "planned", label: "Planned", className: "planned" },
  { id: "blocked", label: "Blocked", className: "blocked" },
] as const;

export function graphFocusStatus(input: {
  completed: boolean;
  waived: boolean;
  plannedTermId?: string | null;
  currentTermId?: string | null;
  eligibility: "eligible" | "locked" | "uncertain";
}): GraphFocusStatus {
  if (input.completed || input.waived) return { id: "completed", label: "Completed", className: "completed" };
  if (input.plannedTermId) {
    if (input.currentTermId && input.plannedTermId === input.currentTermId) {
      return { id: "in-progress", label: "In progress", className: "in-progress" };
    }
    return { id: "planned", label: "Planned", className: "planned" };
  }
  if (input.eligibility === "eligible") return { id: "available", label: "Available", className: "available" };
  if (input.eligibility === "uncertain") return { id: "review", label: "Needs review", className: "review" };
  return { id: "blocked", label: "Blocked", className: "blocked" };
}

export function earliestTakeTerm(input: {
  completed: boolean;
  waived: boolean;
  plannedTermName?: string | null;
  eligibility: "eligible" | "locked" | "uncertain";
  missing: readonly string[];
  firstAcademicTermName?: string | null;
}): { label: string; detail: string } {
  if (input.completed) return { label: "Already completed", detail: "This course is in your completed history." };
  if (input.waived) {
    return { label: "Waived", detail: "The requirement is waived. Offerings and credits are not implied." };
  }
  if (input.plannedTermName) {
    return { label: input.plannedTermName, detail: "Already on your plan. Catalog offerings are not verified." };
  }
  if (input.eligibility === "eligible") {
    return {
      label: input.firstAcademicTermName ?? "Available now",
      detail: "Prerequisites are met from your completed history. Catalog offerings are unknown.",
    };
  }
  if (input.eligibility === "uncertain") {
    return { label: "Needs review", detail: "Prerequisite text could not be fully verified." };
  }
  const missing = input.missing.length ? `After ${input.missing.join(", ")}` : "After prerequisites";
  return {
    label: missing,
    detail: "Blocked until listed prerequisites are completed or waived. Catalog offerings are not verified.",
  };
}

export type PathwayRelevanceHit = { pathwayId: string; pathwayName: string; groupLabel: string };

export function pathwayRelevance(
  code: string,
  pathways: readonly { id: string; name: string; groups: readonly { label: string; courses: readonly string[] }[] }[],
  preferredId?: string | null,
): { hits: PathwayRelevanceHit[]; summary: string } {
  const hits: PathwayRelevanceHit[] = [];
  for (const pathway of pathways) {
    for (const group of pathway.groups) {
      if (group.courses.includes(code)) {
        hits.push({ pathwayId: pathway.id, pathwayName: pathway.name, groupLabel: group.label });
      }
    }
  }
  hits.sort((left, right) => {
    const preferred = Number(right.pathwayId === preferredId) - Number(left.pathwayId === preferredId);
    return preferred || left.pathwayName.localeCompare(right.pathwayName) || left.groupLabel.localeCompare(right.groupLabel);
  });
  if (!hits.length) return { hits, summary: "Not on a suggested pathway" };
  const preferredHits = preferredId ? hits.filter((hit) => hit.pathwayId === preferredId) : [];
  if (preferredHits.length) {
    const groups = [...new Set(preferredHits.map((hit) => hit.groupLabel))];
    return { hits, summary: `${preferredHits[0]!.pathwayName} · ${groups.join(", ")}` };
  }
  const names = [...new Set(hits.map((hit) => hit.pathwayName))];
  if (preferredId) return { hits, summary: `Not on your current target. Listed on ${names.join(", ")}` };
  return { hits, summary: names.join(", ") };
}

export type GraphNavigationEntry = {
  selectedCode: string;
  focusCode: string;
  depth: GraphScope;
};

export type GraphNavigation = {
  entries: GraphNavigationEntry[];
  index: number;
};

export function sameGraphNavigationEntry(a: GraphNavigationEntry, b: GraphNavigationEntry): boolean {
  return a.selectedCode === b.selectedCode && a.focusCode === b.focusCode && a.depth === b.depth;
}

export function initialGraphNavigation(code = "CS 5010", focusCode = code): GraphNavigation {
  return { entries: [{ selectedCode: code, focusCode, depth: "course" }], index: 0 };
}

export const WORKSPACE_SELECTION_KEY = "neu-mscs-workspace-selection-v1";

export type WorkspaceSelection = {
  selectedCode: string;
  focusCode: string;
};

export const DEFAULT_WORKSPACE_SELECTION: WorkspaceSelection = {
  selectedCode: "CS 5010",
  focusCode: "CS 5010",
};

export function parseWorkspaceSelection(input: unknown): WorkspaceSelection {
  if (!input || typeof input !== "object") return DEFAULT_WORKSPACE_SELECTION;
  const value = input as Record<string, unknown>;
  const selectedCode =
    typeof value.selectedCode === "string" && value.selectedCode.trim()
      ? value.selectedCode
      : DEFAULT_WORKSPACE_SELECTION.selectedCode;
  const focusCode =
    typeof value.focusCode === "string" && value.focusCode.trim() ? value.focusCode : selectedCode;
  return { selectedCode, focusCode };
}

export function sameWorkspaceSelection(left: WorkspaceSelection, right: WorkspaceSelection): boolean {
  return left.selectedCode === right.selectedCode && left.focusCode === right.focusCode;
}

export function recordGraphNavigation(
  navigation: GraphNavigation,
  live: GraphNavigationEntry,
  next: GraphNavigationEntry,
): GraphNavigation {
  const current = navigation.entries[navigation.index];
  if (current && sameGraphNavigationEntry(live, next) && sameGraphNavigationEntry(current, live)) return navigation;
  const entries = navigation.entries.slice(0, navigation.index + 1);
  entries[navigation.index] = live;
  if (sameGraphNavigationEntry(live, next)) return { entries, index: navigation.index };
  return { entries: [...entries, next], index: navigation.index + 1 };
}

export function restoreGraphNavigation(
  navigation: GraphNavigation,
  live: GraphNavigationEntry,
  index: number,
): { navigation: GraphNavigation; entry: GraphNavigationEntry } | undefined {
  const entry = navigation.entries[index];
  if (!entry || index === navigation.index) return undefined;
  const entries = navigation.entries.slice();
  entries[navigation.index] = live;
  return { navigation: { entries, index }, entry };
}
