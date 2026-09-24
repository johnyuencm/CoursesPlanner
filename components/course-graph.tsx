"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowLeft, ArrowRight, CalendarPlus, Check, ChevronDown, ChevronUp, Crosshair, Info, List, Maximize2, Minimize2, Network, Plus, RotateCcw, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import pathwayConfig from "@/config/pathways.json";
import {
  clampGraphZoom,
  compactGraphStatusLabel,
  earliestTakeTerm,
  GRAPH_FOCUS_STATUS_LEGEND,
  graphCourseZIndex,
  graphFocusStatus,
  graphInspectorLinkAction,
  graphZoomPercent,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_READABLE_ZOOM,
  GRAPH_SELECTED_EDGE_Z,
  initialGraphNavigation,
  isFocusNeighborhoodEdge,
  mapFind,
  mapScene,
  pathwayRelevance,
  plannedOnlyKeep,
  PROGRAM_COL,
  prerequisiteBusMeta,
  prerequisiteChecks,
  recordGraphNavigation,
  relationshipControlGroups,
  relationshipSelection,
  restoreGraphNavigation,
  enterCourseConnectionsView,
  popGraphView,
  shouldClearLineFocusOnEscape,
  shouldRestoreGraphViewOnEscape,
  type GraphNavigationEntry,
  type GraphScope,
  type GraphViewSnapshot,
  type RelationshipSelection,
} from "@/lib/graph";
import type { Course, Pathway, ProgramRoadmap, StudentPlan } from "@/lib/types";
import { expressionLabel, getEligibility } from "@/lib/validation";
import { addableLineCourses } from "@/lib/plan";
import { resolveGraphCourses, resolveProgramScope, roadmapFocusCourse, roadmapProgramLabel } from "@/lib/roadmaps";
import { routes } from "@/lib/routes";
import { useApp } from "./app-provider";
import { CodeLinks, requirementBadge } from "./course-card";
import { CatalogState } from "./catalog-state";
import { TargetPathCard, SetAsTargetButton } from "./target-path";
import { PageHeading, creditLabel } from "./ui";
import { GraphCanvas } from "./graph-canvas";

const pathways = pathwayConfig as Pathway[];

type GraphData = {
  code: string;
  title: string;
  badgeLabel: string;
  badgeClass: string;
  statusLabel: string;
  statusClass: string;
  credits: string;
  prerequisites: string;
  corequisites: string;
  core: boolean;
  locked: boolean;
  emphasized: boolean;
  dimmed: boolean;
  focused: boolean;
  compact: boolean;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  selectCourse: (code: string) => void;
  enterConnections: (code: string) => void;
};
type BandData = { label: string };
type GraphNode = Node<GraphData, "course">;
type BandNode = Node<BandData, "band">;
type FlowNode = GraphNode | BandNode;
const GRAPH_ZOOM_STEP = 0.25;
const tableRowId = (code: string) => `graph-row-${code.replaceAll(" ", "-")}`;

function CourseNode({ data }: NodeProps<GraphNode>) {
  return <div className={`graph-course-node ${data.core ? "core-course" : ""} ${data.locked ? "graph-locked" : ""} ${data.emphasized ? "graph-emphasized" : ""} ${data.dimmed ? "graph-dimmed" : ""} ${data.focused ? "graph-focused" : ""} ${data.compact ? "graph-compact" : ""}`}>
    <Handle type="target" position={Position.Left} className={data.hasIncoming ? undefined : "graph-handle-hidden"} />
    <button type="button" className="graph-node-main nodrag" onClick={() => data.selectCourse(data.code)} onDoubleClick={(event) => { event.preventDefault(); data.enterConnections(data.code); }} aria-label={`Select ${data.code}, ${data.title}. ${data.badgeLabel}. ${data.statusLabel}. Double-click to show this course's connections.`}>
      <span className="graph-node-meta">
        <span className={data.badgeClass}>{data.badgeLabel}</span>
        <span className={`status-pill ${data.statusClass}`}>{data.compact ? compactGraphStatusLabel(data.statusLabel) : data.statusLabel}</span>
      </span>
      <strong className="course-code">{data.code}</strong>
      <span className="graph-node-title">{data.title}</span>
      <span className="credits">{data.credits}</span>
    </button>
    <Handle type="source" position={Position.Right} className={data.hasOutgoing ? undefined : "graph-handle-hidden"} />
  </div>;
}

function BandLabelNode({ data }: NodeProps<BandNode>) {
  return <div className="graph-band-label">{data.label}</div>;
}

const nodeTypes = { course: CourseNode, band: BandLabelNode };

function nodeRequirementCopy(course: { requirementType: string; unlocks: string[]; prerequisites: Parameters<typeof expressionLabel>[0]; corequisites: Parameters<typeof expressionLabel>[0] } | undefined, kind: "prerequisites" | "corequisites") {
  if (!course) return "Unknown";
  if (course.requirementType === "external") {
    if (kind === "corequisites") return "Not listed in this catalog.";
    if (course.unlocks.length) return `Not in this catalog. Named as a prerequisite by ${course.unlocks.join(", ")}.`;
    return "Not in this catalog. No course here lists this code.";
  }
  return expressionLabel(kind === "prerequisites" ? course.prerequisites : course.corequisites);
}

export function graphStudentFacts(overrideActive: boolean, plan: StudentPlan) {
  if (overrideActive) {
    return {
      completed: new Set<string>(),
      waived: new Set<string>(),
      planned: new Set<string>(),
      history: new Set<string>(),
      recorded: new Set<string>(),
      plannedByCode: new Map<string, { id: string; name: string }>(),
      currentTermId: null as string | null,
      firstAcademicTermName: null as string | null,
    };
  }
  const completed = new Set(plan.completedCourses);
  const waived = new Set(plan.waivedCourses);
  const history = new Set([...completed, ...waived]);
  const planned = new Set<string>();
  const plannedByCode = new Map<string, { id: string; name: string }>();
  for (const semester of plan.semesters) {
    for (const course of semester.courses) {
      planned.add(course.code);
      if (!plannedByCode.has(course.code)) plannedByCode.set(course.code, { id: semester.id, name: semester.name });
    }
  }
  const currentTerm = plan.semesters.find((semester) => semester.type === "academic") ?? plan.semesters[0];
  return {
    completed,
    waived,
    planned,
    history,
    recorded: new Set([...history, ...planned]),
    plannedByCode,
    currentTermId: currentTerm?.id ?? null,
    firstAcademicTermName: currentTerm?.name ?? null,
  };
}

export function graphStatus(
  course: Course | undefined,
  code: string,
  facts: ReturnType<typeof graphStudentFacts>,
) {
  if (!course) return graphFocusStatus({ completed: false, waived: false, eligibility: "locked" });
  return graphFocusStatus({
    completed: facts.completed.has(code),
    waived: facts.waived.has(code),
    plannedTermId: facts.plannedByCode.get(code)?.id ?? null,
    currentTermId: facts.currentTermId,
    eligibility: getEligibility(course, facts.history).status,
  });
}

export type GraphInspectorActionsProps = {
  overrideActive: boolean;
  selected: Course | undefined;
  recorded: boolean;
  onAddToPlan: () => void;
  onOpenCourse: () => void;
};

export function GraphInspectorActions({
  overrideActive,
  selected,
  recorded,
  onAddToPlan,
  onOpenCourse,
}: GraphInspectorActionsProps) {
  if (overrideActive) return null;
  return <div className="inspector-actions">
    {!recorded && selected && selected.requirementType !== "external" && <button className="button button-primary" onClick={onAddToPlan}><Plus size={15} /> Add to Plan</button>}
    <button className="button button-secondary" onClick={onOpenCourse}>Full course details <ArrowRight size={14} /></button>
  </div>;
}

function GraphWorkspace({ roadmap }: { roadmap: ProgramRoadmap | null }) {
  const { catalog, openCourse, openPicker, plan, addCourses, hydrated, careerTargetId, workspaceSelection, setWorkspaceSelection } = useApp();
  const overrideActive = roadmap !== null;
  const courses = useMemo(() => resolveGraphCourses(catalog, roadmap), [catalog, roadmap]);
  const programCodes = useMemo(() => resolveProgramScope(catalog, roadmap), [catalog, roadmap]);
  const programLabel = roadmapProgramLabel(roadmap);
  const initialFocusCode = roadmap ? (roadmapFocusCourse(roadmap) || "CS 5010") : workspaceSelection.focusCode;
  const initialSelectedCode = roadmap ? initialFocusCode : workspaceSelection.selectedCode;
  const [focusCode, setFocusCode] = useState(initialFocusCode);
  const [selectedCode, setSelectedCode] = useState(initialSelectedCode);
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipSelection | null>(null);
  const [search, setSearch] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const [depth, setDepth] = useState<GraphScope>("course");
  const [plannedOnly, setPlannedOnly] = useState(false);
  const [view, setView] = useState<"graph" | "table">("graph");
  const [zoom, setZoom] = useState(GRAPH_READABLE_ZOOM);
  const [fitRequest, setFitRequest] = useState(0);
  const acknowledgedFitRequest = useRef(0);
  const [fullscreenBusy, setFullscreenBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const [navigation, setNavigation] = useState(() => initialGraphNavigation(initialSelectedCode, initialFocusCode));
  const [viewStack, setViewStack] = useState<GraphViewSnapshot[]>([]);
  const graphLayoutRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const wasFullscreenRef = useRef(false);
  const findInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef(search);
  searchRef.current = search;
  const [lineSemesterId, setLineSemesterId] = useState("");
  const locateRef = useRef<(code: string, keepFind?: boolean) => void>(() => {});
  const inspectRef = useRef<(code: string) => void>(() => {});
  const enterConnectionsRef = useRef<(code: string) => void>(() => {});
  const cycleRef = useRef<(step: number) => void>(() => {});
  const matchesRef = useRef<{ code: string; title: string }[]>([]);
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.code, course])), [courses]);
  const facts = useMemo(() => graphStudentFacts(overrideActive, plan), [overrideActive, plan.completedCourses, plan.waivedCourses, plan.semesters]);
  const { completed, waived, planned, history, recorded, plannedByCode, firstAcademicTermName } = facts;
  const scene = useMemo(() => {
    if (!catalog) {
      return {
        visible: new Map<string, number>(),
        positions: new Map<string, { x: number; y: number }>(),
        bands: [],
        arrows: [],
        chain: new Set<string>(),
        neighborhood: new Set<string>(),
        focusPrerequisites: [] as string[],
        focusUnlocks: [] as string[],
      };
    }
    return mapScene({
      courses,
      requirements: catalog.requirements,
      scope: depth,
      focusCode,
      selectedCode,
      programCodes,
      keep: overrideActive || !plannedOnly ? undefined : plannedOnlyKeep(recorded, [selectedCode, focusCode]),
    });
  }, [catalog, courses, programCodes, depth, focusCode, selectedCode, plannedOnly, recorded, overrideActive]);
  const visible = scene.visible;
  const neighborhood = scene.neighborhood;
  const graph = useMemo(() => {
    const incoming = new Set(scene.arrows.map((edge) => edge.target));
    const outgoing = new Set(scene.arrows.map((edge) => edge.source));
    const makeNode = (code: string, x: number, y: number): GraphNode => {
      const course = courseMap.get(code);
      const emphasized = selectedRelationship ? selectedRelationship.codes.has(code) : neighborhood.has(code);
      const focused = code === selectedCode;
      const badge = requirementBadge(course?.requirementType ?? "external");
      const status = graphStatus(course, code, facts);
      const locked = status.id === "blocked";
      return {
        id: code,
        type: "course",
        position: { x, y },
        zIndex: graphCourseZIndex({ focused, emphasized }),
        data: {
          code,
          title: course?.title ?? "Metadata not in this catalog",
          badgeLabel: badge.label,
          badgeClass: badge.className,
          statusLabel: status.label,
          statusClass: status.className,
          core: course?.requirementType === "core",
          locked,
          credits: course ? `${creditLabel(course)} cr` : "Unknown credits",
          prerequisites: nodeRequirementCopy(course, "prerequisites"),
          corequisites: nodeRequirementCopy(course, "corequisites"),
          emphasized,
          dimmed: selectedRelationship ? !selectedRelationship.codes.has(code) : !neighborhood.has(code),
          focused,
          compact: true,
          hasIncoming: incoming.has(code),
          hasOutgoing: outgoing.has(code),
          selectCourse: (code) => inspectRef.current(code),
          enterConnections: (code) => enterConnectionsRef.current(code),
        },
        ariaLabel: `${code}: ${course?.title ?? "External reference"}`,
      };
    };
    const nodes: FlowNode[] = [];
    for (const [code, point] of scene.positions) nodes.push(makeNode(code, point.x, point.y));
    for (const band of scene.bands) {
      nodes.push({
        id: `band:${band.id}`,
        type: "band",
        position: { x: band.x, y: band.y },
        data: { label: band.label },
        selectable: false,
        draggable: false,
        connectable: false,
        focusable: false,
        zIndex: 0,
        style: { width: Math.max(PROGRAM_COL * 3, 420) },
      });
    }
    const targetTracks = new Map<string, number>();
    const columnTracks = new Map<number, number>();
    for (const target of [...incoming].sort((a, b) => (scene.positions.get(a)?.y ?? 0) - (scene.positions.get(b)?.y ?? 0) || a.localeCompare(b))) {
      const x = scene.positions.get(target)?.x ?? 0;
      const track = columnTracks.get(x) ?? 0;
      targetTracks.set(target, 36 + track * 10);
      columnTracks.set(x, track + 1);
    }
    const busMeta = prerequisiteBusMeta(scene.arrows, scene.positions);
    const edges: Edge[] = scene.arrows.map((edge, index) => {
      const stroke = edge.stroke;
      const selected = relationshipSelection.isSelected(selectedRelationship, edge.source, edge.target);
      const neighborhoodEdge = isFocusNeighborhoodEdge(edge.source, edge.target, selectedCode, neighborhood);
      const bus = busMeta.get(edge.target);
      return {
        id: `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        type: "prerequisite",
        data: {
          busOffset: targetTracks.get(edge.target) ?? 36,
          busStartY: bus?.busStartY,
          busEndY: bus?.busEndY,
          isBusOwner: bus?.busOwner === edge.source,
          selected,
          onSelectBranch: () => setSelectedRelationship(relationshipSelection.branch(edge.source, edge.target)),
          onSelectBus: () => setSelectedRelationship(relationshipSelection.bus(scene.arrows, edge.target)),
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
        style: {
          stroke,
          strokeWidth: selected || neighborhoodEdge ? 2.5 : 1.25,
          opacity: selectedRelationship ? (selected ? 1 : 0.18) : neighborhoodEdge ? 1 : 0.18,
        },
        zIndex: selected || neighborhoodEdge ? GRAPH_SELECTED_EDGE_Z : 0,
        ariaLabel: `${edge.source} unlocks ${edge.target}`,
        focusable: false,
        selectable: true,
      };
    });
    const courseNodes = nodes.filter((node): node is GraphNode => node.type === "course");
    return { nodes, edges, courseNodes };
  }, [scene, neighborhood, selectedCode, selectedRelationship, courseMap, facts]);
  const found = useMemo(
    () => mapFind.query(courses, search, programCodes),
    [courses, search, programCodes],
  );
  const matches = found.matches;
  matchesRef.current = matches;
  useEffect(() => {
    if (!matches.length) {
      setFindIndex(-1);
      return;
    }
    if (!found.autoLocate) return;
    setFindIndex(0);
    locateRef.current(matches[0]!.code, true);
  }, [search, matches, found.autoLocate]);
  useEffect(() => {
    if (findIndex < 0) return;
    document.getElementById(`graph-find-hit-${findIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [findIndex]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const intent = mapFind.intent(event, searchRef.current);
      if (intent.type === "skip" || intent.type === "none") return;
      if (intent.type === "focus") {
        event.preventDefault();
        const input = findInputRef.current;
        input?.focus();
        input?.select();
        return;
      }
      if (intent.type === "clear") {
        event.preventDefault();
        setSearch("");
        setFindIndex(-1);
        return;
      }
      if (intent.type === "cycle" && matchesRef.current.length) {
        event.preventDefault();
        cycleRef.current(intent.step);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  useEffect(() => {
    const syncFullscreen = () => {
      const active = document.fullscreenElement === graphLayoutRef.current;
      setIsFullscreen(active);
      if (!active && wasFullscreenRef.current) fullscreenButtonRef.current?.focus();
      wasFullscreenRef.current = active;
    };
    setFullscreenSupported(typeof document.documentElement.requestFullscreen === "function" && typeof document.exitFullscreen === "function");
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (shouldClearLineFocusOnEscape(event, { active: Boolean(selectedRelationship), findQuery: searchRef.current, fullscreen: isFullscreen })) {
        event.preventDefault();
        setSelectedRelationship(null);
        return;
      }
      if (!shouldRestoreGraphViewOnEscape(event, { canRestore: viewStack.length > 0, lineFocus: Boolean(selectedRelationship), findQuery: searchRef.current, fullscreen: isFullscreen })) return;
      event.preventDefault();
      const restored = popGraphView(viewStack);
      if (!restored.view) return;
      setViewStack(restored.rest);
      setSelectedRelationship(null);
      setDepth(restored.view.depth);
      setFocusCode(restored.view.focusCode);
      setZoom(restored.view.zoom);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [selectedRelationship, isFullscreen, viewStack]);
  useEffect(() => {
    if (overrideActive) return;
    setSelectedCode(workspaceSelection.selectedCode);
    setFocusCode(workspaceSelection.focusCode);
  }, [overrideActive, workspaceSelection.selectedCode, workspaceSelection.focusCode]);
  const rememberSelection = (nextSelected: string, nextFocus: string) => {
    if (overrideActive) return;
    setWorkspaceSelection({ selectedCode: nextSelected, focusCode: nextFocus });
  };
  const liveNavigation = (): GraphNavigationEntry => ({ selectedCode, focusCode, depth });
  const applyNavigation = (entry: GraphNavigationEntry) => {
    setSelectedCode(entry.selectedCode);
    setFocusCode(entry.focusCode);
    rememberSelection(entry.selectedCode, entry.focusCode);
    setDepth(entry.depth);
    setSelectedRelationship(null);
    if (view === "table") {
      requestAnimationFrame(() => document.getElementById(tableRowId(entry.selectedCode))?.scrollIntoView({ block: "nearest" }));
    }
    requestAnimationFrame(() => document.getElementById("graph-inspector")?.focus({ preventScroll: true }));
  };
  const locate = (code: string, keepFind = false) => {
    const next: GraphNavigationEntry = { selectedCode: code, focusCode: code, depth: "course" };
    setNavigation((previous) => recordGraphNavigation(previous, liveNavigation(), next));
    setViewStack([]);
    setFocusCode(code);
    setSelectedCode(code);
    rememberSelection(code, code);
    setSelectedRelationship(null);
    setDepth("course");
    if (view === "table") {
      requestAnimationFrame(() => document.getElementById(tableRowId(code))?.scrollIntoView({ block: "nearest" }));
    }
    if (!keepFind) {
      setSearch("");
      setFindIndex(-1);
      requestAnimationFrame(() => {
        document.getElementById("graph-inspector")?.focus({ preventScroll: true });
      });
      return;
    }
    requestAnimationFrame(() => findInputRef.current?.focus());
  };
  const inspectCourse = (code: string) => {
    const next: GraphNavigationEntry = { selectedCode: code, focusCode, depth };
    setNavigation((previous) => recordGraphNavigation(previous, liveNavigation(), next));
    setSelectedCode(code);
    rememberSelection(code, focusCode);
    setSelectedRelationship(null);
    requestAnimationFrame(() => document.getElementById("graph-inspector")?.focus({ preventScroll: true }));
  };
  const applyFocusScope = (scope: GraphScope) => {
    setViewStack([]);
    setSelectedRelationship(null);
    if (scope !== "program") {
      setFocusCode(selectedCode);
      rememberSelection(selectedCode, selectedCode);
    }
    setDepth(scope);
  };
  const goNavigation = (index: number) => {
    const restored = restoreGraphNavigation(navigation, liveNavigation(), index);
    if (!restored) return;
    setViewStack([]);
    setNavigation(restored.navigation);
    applyNavigation(restored.entry);
  };
  const enterConnections = (code: string) => {
    const entered = enterCourseConnectionsView({ depth, focusCode, zoom }, code, GRAPH_READABLE_ZOOM);
    const previousView = entered.previous;
    if (previousView) setViewStack((stack) => [...stack, previousView]);
    const next: GraphNavigationEntry = { selectedCode: code, focusCode: entered.next.focusCode, depth: entered.next.depth };
    setNavigation((previous) => recordGraphNavigation(previous, liveNavigation(), next));
    setSelectedCode(code);
    rememberSelection(code, entered.next.focusCode);
    setSelectedRelationship(null);
    setFocusCode(entered.next.focusCode);
    setDepth(entered.next.depth);
    setZoom(entered.next.zoom);
    requestAnimationFrame(() => document.getElementById("graph-inspector")?.focus({ preventScroll: true }));
  };
  const restorePreviousView = () => {
    const restored = popGraphView(viewStack);
    if (!restored.view) return;
    setViewStack(restored.rest);
    setSelectedRelationship(null);
    setDepth(restored.view.depth);
    setFocusCode(restored.view.focusCode);
    setZoom(restored.view.zoom);
  };
  const cycle = (step: number) => {
    if (!matches.length) return;
    const next = mapFind.cycleIndex(findIndex, matches.length, step);
    setFindIndex(next);
    const course = matches[next];
    if (course) locate(course.code, true);
  };
  locateRef.current = locate;
  inspectRef.current = inspectCourse;
  enterConnectionsRef.current = enterConnections;
  cycleRef.current = cycle;
  const focus = (code: string) => locate(code, false);
  const selectRelated = (code: string) => {
    if (graphInspectorLinkAction(code, visible) === "locate") focus(code);
    else inspectCourse(code);
  };
  const setManualZoom = useCallback((next: number) => setZoom(clampGraphZoom(next)), []);
  const setCanvasZoom = useCallback((next: number) => setZoom(clampGraphZoom(next, 0.05, GRAPH_MAX_ZOOM)), []);
  const changeZoom = (step: number) => setZoom((current) => clampGraphZoom(current + step));
  const toggleFullscreen = async () => {
    if (fullscreenBusy) return;
    if (!fullscreenSupported) {
      setFullscreenMessage("Full screen is not available in this browser.");
      return;
    }
    const element = graphLayoutRef.current;
    if (!element) return;
    setFullscreenBusy(true);
    try {
      setFullscreenMessage("");
      if (document.fullscreenElement === element) {
        await document.exitFullscreen();
      } else {
        setView("graph");
        await element.requestFullscreen();
      }
    } catch {
      setFullscreenMessage("Full screen was blocked. You can still zoom and scroll the map here.");
    } finally {
      setFullscreenBusy(false);
    }
  };
  if (!catalog) return <CatalogState />;
  const selected = courseMap.get(selectedCode);
  const relationshipTarget = selectedRelationship ? courseMap.get(selectedRelationship.target) : undefined;
  const badge = selected ? requirementBadge(selected.requirementType) : requirementBadge("external");
  const selectedStatus = graphStatus(selected, selectedCode, facts);
  const selectedEligibility = selected ? getEligibility(selected, facts.history) : { status: "locked" as const, missing: [] as string[], reasons: [] as string[] };
  const takeTerm = earliestTakeTerm({
    completed: completed.has(selectedCode),
    waived: waived.has(selectedCode),
    plannedTermName: plannedByCode.get(selectedCode)?.name ?? null,
    eligibility: selectedEligibility.status,
    missing: selectedEligibility.missing,
    firstAcademicTermName,
  });
  const pathway = pathwayRelevance(selectedCode, pathways, careerTargetId);
  const prereqItems = prerequisiteChecks(
    selected?.requirementType === "external" ? [] : selected?.prerequisiteCodes ?? scene.focusPrerequisites,
    history,
  );
  const unlockCodes = selected?.unlocks.length ? selected.unlocks : scene.focusUnlocks;
  const findStatus = !search.trim() ? "" : matches.length ? `${findIndex >= 0 ? findIndex + 1 : 0} of ${matches.length}` : "No matches";
  const showCorequisites = Boolean(selected?.corequisiteCodes.length);
  const relationshipGroups = relationshipControlGroups(scene.arrows);
  const lineSemester = plan.semesters.some((semester) => semester.id === lineSemesterId) ? lineSemesterId : (plan.semesters[0]?.id ?? "");
  const lineItems = selectedRelationship && catalog ? addableLineCourses(selectedRelationship.codes, catalog.courses, recorded) : [];
  const lineLabel = selectedRelationship?.kind === "branch"
    ? `${selectedRelationship.source} → ${selectedRelationship.target}`
    : selectedRelationship ? `${selectedRelationship.target} shared prerequisite bus` : "";
  const clearLineFocus = () => setSelectedRelationship(null);
  return <>
    <PageHeading title="Explore the course map" description="Understand what every course unlocks. Select a course to see what it needs and what it opens next." />
    <div className="graph-legend" aria-label="Map legend">
      <span><i className="legend-node core" /> Core</span>
      <span><i className="legend-node breadth" /> Breadth</span>
      <span><i className="legend-node elective" /> Elective</span>
      {GRAPH_FOCUS_STATUS_LEGEND.map((status) => (
        <span key={status.id}><span className={`status-pill ${status.className}`}>{status.label}</span></span>
      ))}
      <span><i className="legend-arrow" aria-hidden="true" /> Unlocks after this course</span>
      {depth === "program" && <span><span className="legend-band">No prerequisite required</span> Startable, unlinked</span>}
    </div>
    <div className="graph-layout" ref={graphLayoutRef}>
      <section className="graph-panel" aria-label="Course prerequisite relationships">
        <a className="graph-skip" href="#graph-inspector">Skip map to selected course</a>
        <div className="graph-panel-heading">
          <div className="graph-search-wrap">
            <div className="search-field graph-find-field">
              <Search size={16} />
              <input
                id="graph-find"
                ref={findInputRef}
                type="search"
                autoComplete="off"
                aria-label="Find a course on the map"
                aria-keyshortcuts="Control+F Meta+F"
                aria-controls="graph-find-results"
                aria-describedby="graph-find-status"
                placeholder="Find a course (Ctrl+F)"
                value={search}
                onChange={(event) => { setSearch(event.target.value); setFindIndex(-1); }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    cycle(event.shiftKey ? -1 : 1);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    setSearch("");
                    setFindIndex(-1);
                    event.currentTarget.blur();
                  } else if (event.key === "ArrowDown") {
                    event.preventDefault();
                    cycle(1);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    cycle(-1);
                  }
                }}
              />
              {search.trim() ? <span id="graph-find-status" className="graph-find-count" role="status">{findStatus}</span> : <kbd className="graph-find-kbd" aria-hidden="true">Ctrl+F</kbd>}
              <div className="graph-find-nav">
                <button type="button" aria-label="Previous match" disabled={!matches.length} onClick={() => cycle(-1)}><ChevronUp size={14} /></button>
                <button type="button" aria-label="Next match" disabled={!matches.length} onClick={() => cycle(1)}><ChevronDown size={14} /></button>
              </div>
            </div>
            {search.trim() ? <div className="graph-search-results" id="graph-find-results">
              {matches.length ? matches.map((course, index) => (
                <button
                  key={course.code}
                  type="button"
                  id={`graph-find-hit-${index}`}
                  aria-current={index === findIndex ? "true" : undefined}
                  className={index === findIndex ? "graph-find-current" : undefined}
                  onClick={() => { setFindIndex(index); locate(course.code, true); }}
                >
                  <strong>{course.code}</strong>
                  <span>{course.title}{visible.has(course.code) ? "" : " · outside current view"}</span>
                  <Crosshair size={14} />
                </button>
              )) : <p>No matching courses. Try another code or title.</p>}
            </div> : null}
          </div>
          <div className="graph-history" aria-label="Course navigation">
            <button type="button" className="button button-secondary button-small" aria-label="Previous course" disabled={navigation.index === 0} onClick={() => goNavigation(navigation.index - 1)}><ArrowLeft size={14} /> Back</button>
            <button type="button" className="button button-secondary button-small" aria-label="Next course in history" disabled={navigation.index === navigation.entries.length - 1} onClick={() => goNavigation(navigation.index + 1)}><ArrowRight size={14} /></button>
          </div>
          <span>{depth === "program" ? <>Entire <strong>{programLabel}</strong> program</> : depth === "1" ? <><Crosshair size={15} /> Connections for <strong>{focusCode}</strong></> : depth === "unlocks" ? <>Unlocks of <strong>{focusCode}</strong></> : depth === "prerequisites" ? <>Prerequisites of <strong>{focusCode}</strong></> : <><Crosshair size={15} /> Course chain for <strong>{focusCode}</strong></>}</span>
          <span role="status">{graph.courseNodes.length} courses. {graph.edges.length} {graph.edges.length === 1 ? "unlock arrow" : "unlock arrows"}. Selected {selectedCode} · {neighborhood.size} in focus{selectedRelationship ? ` · ${selectedRelationship.kind === "branch" ? `${selectedRelationship.source} unlocks ${selectedRelationship.target}` : `${selectedRelationship.sources.join(", ")} unlock ${selectedRelationship.target}`}` : ""}.</span>
          <div className="segmented-control" aria-label="Map display">
            <button type="button" aria-pressed={view === "graph"} className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}><Network size={15} /> Map</button>
            <button type="button" aria-pressed={view === "table"} className={view === "table" ? "selected" : ""} onClick={() => setView("table")}><List size={15} /> Table</button>
          </div>
          <label className="graph-depth-label">Show
            <select value={depth} onChange={(event) => applyFocusScope(event.target.value as GraphScope)}>
              <option value="prerequisites">Show prerequisites</option>
              <option value="unlocks">Show unlocks</option>
              <option value="course">Full dependency tree</option>
              <option value="1">This course’s connections</option>
              <option value="2">Two connections away</option>
              <option value="program">Entire program</option>
              <option value="full">Full connected component</option>
            </select>
          </label>
          <div className="graph-focus-stubs" aria-label="Graph filters">
            {!overrideActive && <button type="button" className={`button button-secondary button-small ${plannedOnly ? "selected" : ""}`} aria-pressed={plannedOnly} onClick={() => setPlannedOnly((on) => !on)}>Only my planned</button>}
            <button type="button" className="button button-secondary button-small" disabled title="Follow-up johnyuencm/harness#54">Critical path to target</button>
          </div>
          <div className="graph-view-toolbar" aria-label="Map zoom and display controls">
            <button type="button" className="icon-button" aria-label="Zoom out" disabled={zoom <= GRAPH_MIN_ZOOM} onClick={() => changeZoom(-GRAPH_ZOOM_STEP)}><ZoomOut size={15} /></button>
            <span className="graph-zoom-readout" aria-live="polite">{graphZoomPercent(zoom)}%</span>
            <button type="button" className="icon-button" aria-label="Zoom in" disabled={zoom >= GRAPH_MAX_ZOOM} onClick={() => changeZoom(GRAPH_ZOOM_STEP)}><ZoomIn size={15} /></button>
            <button type="button" className="button button-secondary button-small" onClick={() => setManualZoom(GRAPH_READABLE_ZOOM)}><RotateCcw size={14} /> 100%</button>
            <button type="button" className="button button-secondary button-small" onClick={() => { setView("graph"); setFitRequest((request) => request + 1); }}><Crosshair size={14} /> Fit</button>
            <button
              type="button"
              ref={fullscreenButtonRef}
              className="button button-secondary button-small graph-fullscreen-toggle"
              aria-pressed={isFullscreen}
              aria-busy={fullscreenBusy}
              disabled={!fullscreenSupported || fullscreenBusy}
              title={fullscreenSupported ? undefined : "Full screen is not available in this browser"}
              onClick={toggleFullscreen}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />} {isFullscreen ? "Exit full screen" : "Full screen"}
            </button>
          </div>
          {fullscreenMessage ? <span className="graph-fullscreen-status" role="status">{fullscreenMessage}</span> : null}
        </div>
        {view === "graph" ? <GraphCanvas nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} selectedCode={selectedCode} zoom={zoom} fitRequest={fitRequest} acknowledgedFitRequest={acknowledgedFitRequest} onZoomChange={setCanvasZoom} onClearLineFocus={clearLineFocus} /> : <div className="relationship-table-wrap">
          <table className="relationship-table">
            <caption className="sr-only">All courses in the selected neighborhood and their complete prerequisite and corequisite rules</caption>
            <thead><tr><th scope="col">Course</th><th scope="col">Role</th><th scope="col">Prerequisite rule</th><th scope="col">Take together</th></tr></thead>
            <tbody>{graph.courseNodes.map((node) => {
              const course = courseMap.get(node.id);
              return <tr key={node.id} id={tableRowId(node.id)} className={node.id === selectedCode ? "graph-find-current" : undefined}>
                <th scope="row"><button className="text-button" onClick={() => inspectCourse(node.id)} onDoubleClick={(event) => { event.preventDefault(); enterConnections(node.id); }}>{node.id}</button><span>{course?.title ?? "External reference — unknown metadata"}</span></th>
                <td>{node.data.badgeLabel} · {node.data.statusLabel}</td>
                <td>{node.data.prerequisites}<div className="detail-code-links"><CodeLinks codes={course?.prerequisiteCodes ?? []} limit={1000} onSelect={overrideActive ? focus : undefined} /></div></td>
                <td>{node.data.corequisites}<div className="detail-code-links"><CodeLinks codes={course?.corequisiteCodes ?? []} limit={1000} onSelect={overrideActive ? focus : undefined} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {view === "graph" && <p className="graph-canvas-hint">Click a course to isolate its prerequisites and unlocks. The rest of the map stays visible but de-emphasized. Double-click a course to show its connections, then press Escape to return to the previous view. Select a colored branch for that exact relationship, or its shared bus for every visible prerequisite of that destination. Empty map / Exit line focus restores every relationship. Only my planned hides courses that are not completed, waived, or on your plan. Critical path to target is johnyuencm/harness#54.</p>}
      </section>
      <aside className="graph-inspector" id="graph-inspector" tabIndex={-1}>
        {overrideActive ? null : <TargetPathCard compact />}
        {selectedRelationship ? <div className="line-focus-banner">
          <div className="line-focus-banner-copy">
            <p><strong>Line focus</strong> {lineLabel}</p>
            <p className="muted small-text">The current map stays put. Exit to restore every visible relationship.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={clearLineFocus}><X size={15} /> Exit line focus</button>
          {!overrideActive && (plan.semesters.length ? <div className="line-focus-plan">
            <label className="field-label" htmlFor="line-focus-semester">Add this line to a semester</label>
            <div className="input-action-row">
              <select id="line-focus-semester" value={lineSemester} onChange={(event) => setLineSemesterId(event.target.value)}>
                {plan.semesters.map((term) => <option key={term.id} value={term.id}>{term.name}{term.type === "coop" ? " · co-op" : ""}</option>)}
              </select>
              <button type="button" className="button button-primary" disabled={!hydrated || !lineItems.length || !lineSemester} onClick={() => { if (lineSemester) addCourses(selectedRelationship.codes, lineSemester); }}><CalendarPlus size={15} /> Add {lineItems.length === 1 ? "1 course" : `${lineItems.length} courses`}</button>
            </div>
            <p className="muted small-text">{lineItems.length ? `Will add ${lineItems.map((item) => item.code).join(", ")}.` : "Every course on this line is already in your plan or history, or is an external catalog reference."}</p>
          </div> : <p className="muted small-text">Create a semester on Build My Plan before adding this line.</p>)}
        </div> : null}
        <div className="inspector-heading-meta">
          <span className={badge.className}>{badge.label}</span>
          <span className={`status-pill ${selectedStatus.className}`}>{selectedStatus.label}</span>
          {waived.has(selectedCode) ? <span className="muted small-text">Waived</span> : null}
        </div>
        <h2>{selectedCode}</h2>
        <p className="inspector-course-title">{selected?.title ?? "External course reference"}</p>
        <p className="muted small-text">{selected ? `${creditLabel(selected)} credits` : "Credits unknown"}</p>
        {selected?.description ? <p className="inspector-description">{selected.description}</p> : <p className="muted small-text">No catalog description is cached for this code.</p>}
        <dl className="inspector-facts">
          <div>
            <dt>Status</dt>
            <dd><span className={`status-pill ${selectedStatus.className}`}>{selectedStatus.label}</span></dd>
          </div>
          <div>
            <dt>Earliest take term</dt>
            <dd>{takeTerm.label}<span className="muted small-text">{takeTerm.detail}</span></dd>
          </div>
          <div>
            <dt>Pathway relevance</dt>
            <dd>{pathway.summary}</dd>
          </div>
        </dl>
        <div className="graph-focus-controls" aria-label="Course focus controls">
          <button type="button" className="text-button inspector-focus" aria-pressed={depth === "prerequisites"} onClick={() => applyFocusScope("prerequisites")}><ArrowLeft size={14} /> Show prerequisites</button>
          <button type="button" className="text-button inspector-focus" aria-pressed={depth === "unlocks"} onClick={() => applyFocusScope("unlocks")}><ArrowRight size={14} /> Show unlocks</button>
          <button type="button" className="text-button inspector-focus" aria-pressed={depth === "course"} onClick={() => applyFocusScope("course")}><Network size={14} /> Full dependency tree</button>
          {depth !== "program" && <button type="button" className="text-button inspector-focus" onClick={() => applyFocusScope("program")}><Network size={14} /> Show entire program</button>}
          {depth !== "1" && <button type="button" className="text-button inspector-focus" onClick={() => enterConnections(selectedCode)}><Crosshair size={14} /> Show this course's connections</button>}
          {depth !== "program" && focusCode !== selectedCode && <button type="button" className="text-button inspector-focus" onClick={() => focus(selectedCode)}><Crosshair size={14} /> Focus map here</button>}
          {!overrideActive && <button type="button" className="text-button inspector-focus" aria-pressed={plannedOnly} onClick={() => setPlannedOnly((on) => !on)}>Only my planned</button>}
          {!overrideActive && <button type="button" className="text-button inspector-focus" disabled title="Follow-up johnyuencm/harness#54">Critical path to target</button>}
          {viewStack.length ? <button type="button" className="text-button inspector-focus" aria-keyshortcuts="Escape" onClick={restorePreviousView}><ArrowLeft size={14} /> Return to previous view</button> : null}
        </div>
        <div className="inspector-relationships">
          {selectedRelationship ? <div className="graph-relationship-explanation"><h3>{selectedRelationship.kind === "branch" ? `${selectedRelationship.source} → ${selectedRelationship.target}` : `${selectedRelationship.target} shared prerequisite bus`}</h3><p>{selectedRelationship.kind === "branch" ? `${selectedRelationship.source} is named as a prerequisite of ${selectedRelationship.target}.` : `Visible incoming prerequisites: ${selectedRelationship.sources.join(", ")}.`}</p><p><strong>{selectedRelationship.target} catalog rule:</strong> {nodeRequirementCopy(relationshipTarget, "prerequisites")}</p><p className="muted small-text">A line records a named catalog link; the rule above states whether prerequisites are AND, OR, or need review.</p></div> : null}
          {scene.arrows.length ? <><h3>Visible map relationships</h3><div className="graph-relationship-buttons">{relationshipGroups.map((group) => <Fragment key={group.target}>
            <button key={`${group.target}-bus`} type="button" className="text-button" aria-pressed={selectedRelationship?.kind === "bus" && selectedRelationship.target === group.target} aria-label={`Select every visible prerequisite of ${group.target}: ${group.sources.join(", ")}`} onClick={() => setSelectedRelationship(relationshipSelection.bus(scene.arrows, group.target))}>All into {group.target}</button>
            {group.branches.map((edge) => <button key={`${edge.source}-${edge.target}`} type="button" className="text-button" aria-pressed={selectedRelationship?.kind === "branch" && selectedRelationship.source === edge.source && selectedRelationship.target === edge.target} aria-label={`Select exact relationship ${edge.source} unlocks ${edge.target}`} onClick={() => setSelectedRelationship(relationshipSelection.branch(edge.source, edge.target))}>{edge.source} → {edge.target}</button>)}
          </Fragment>)}</div></> : <p className="muted small-text">This course has no prerequisite or unlock relationships in this catalog.</p>}
          <h3>Prerequisites <span>{prereqItems.length}</span></h3>
          {selected?.requirementType === "external" ? <p>{nodeRequirementCopy(selected, "prerequisites")}</p> : <>
            <p>{selected ? expressionLabel(selected.prerequisites) : "Unknown"}</p>
            {prereqItems.length ? <ul className="inspector-prereq-list">{prereqItems.map((item) => (
              <li key={item.code} className={item.met ? "met" : undefined}>
                <span className="inspector-prereq-mark" aria-hidden="true">{item.met ? <Check size={13} /> : null}</span>
                <button type="button" className="code-chip" onClick={() => selectRelated(item.code)}>{item.code}</button>
                <span className="sr-only">{item.met ? "completed or waived" : "still needed"}</span>
              </li>
            ))}</ul> : <span className="muted small-text">No parsed prerequisites.</span>}
          </>}
          <h3>Unlocks <span>{unlockCodes.length}</span></h3>
          {unlockCodes.length ? <div className="detail-code-links"><CodeLinks codes={unlockCodes} limit={1000} onSelect={selectRelated} /></div> : <span className="muted small-text">No linked downstream courses in this catalog.</span>}
          {showCorequisites ? <>
            <h3>Corequisites <span>{selected?.corequisiteCodes.length ?? 0}</span></h3>
            <p>{nodeRequirementCopy(selected, "corequisites")}</p>
            <div className="detail-code-links"><CodeLinks codes={selected?.corequisiteCodes ?? []} limit={1000} onSelect={selectRelated} /></div>
          </> : null}
        </div>
        {overrideActive ? null : <div className="inspector-actions">
          <SetAsTargetButton code={selectedCode} />
          {!recorded.has(selectedCode) && selected && selected.requirementType !== "external" && plan.semesters.length ? <div className="inspector-add-plan">
            <label className="field-label" htmlFor="inspector-add-semester">Add to a semester</label>
            <div className="input-action-row">
              <select id="inspector-add-semester" value={lineSemester} onChange={(event) => setLineSemesterId(event.target.value)}>
                {plan.semesters.map((term) => <option key={term.id} value={term.id}>{term.name}{term.type === "coop" ? " · co-op" : ""}</option>)}
              </select>
              <button type="button" className="button button-primary" disabled={!hydrated || !lineSemester} onClick={() => { if (lineSemester) addCourses([selectedCode], lineSemester); }}><Plus size={15} /> Add to {plan.semesters.find((term) => term.id === lineSemester)?.name ?? "plan"}</button>
            </div>
            <button type="button" className="text-button" onClick={() => openPicker(lineSemester || undefined, selectedCode)}>Choose credits or a new term</button>
          </div> : !recorded.has(selectedCode) && selected && selected.requirementType !== "external" ? <button className="button button-primary" onClick={() => openPicker(undefined, selectedCode)}><Plus size={15} /> Add to plan</button> : recorded.has(selectedCode) ? <p className="muted small-text">{completed.has(selectedCode) ? "In your completed history." : waived.has(selectedCode) ? "Waived on this plan." : `Planned in ${plannedByCode.get(selectedCode)?.name ?? "your plan"}.`}{planned.has(selectedCode) ? <> <Link className="text-link" href={routes.plan}>View in Plan</Link></> : null}</p> : null}
          <button className="button button-secondary" onClick={() => openCourse(selectedCode)}>Full course details <ArrowRight size={14} /></button>
        </div>}
        <div className="inspector-tip"><Info size={16} /><p>Selected course, its prerequisites, and its unlocks stay readable; everything else is de-emphasized. Blocked cards still need earlier courses. Offerings are not listed because they are unknown. The path card above shows remaining prerequisites and earliest term for your target.</p></div>
      </aside>
    </div>
    <p className="page-footnote">The default map follows the selected course through its cataloged prerequisites and unlocks; it does not add a downstream course’s other prerequisite branches. Choose Entire program to browse all listed {programLabel} courses and their cataloged external prerequisites. A shared color groups lines by destination, not by AND/OR satisfaction; read the catalog rule in the inspector. A connection does not verify course availability.</p>
  </>;
}

export default function CourseGraph({ roadmap = null }: { roadmap?: ProgramRoadmap | null }) {
  const graphKey = roadmap ? `${roadmap.universityId}:${roadmap.programId}` : "default";
  return <GraphWorkspace key={graphKey} roadmap={roadmap} />;
}
