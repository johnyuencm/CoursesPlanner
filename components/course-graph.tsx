"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Handle, MarkerType, Position, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowLeft, ArrowRight, CalendarPlus, ChevronDown, ChevronUp, Crosshair, Info, List, Maximize2, Minimize2, Network, Plus, RotateCcw, Search, X, ZoomIn, ZoomOut } from "lucide-react";
import {
  clampGraphZoom,
  compactGraphStatusLabel,
  graphCourseZIndex,
  graphZoomPercent,
  GRAPH_MAX_ZOOM,
  GRAPH_MIN_ZOOM,
  GRAPH_READABLE_ZOOM,
  GRAPH_SELECTED_EDGE_Z,
  mapFind,
  mapScene,
  PROGRAM_COL,
  programMapCodes,
  relationshipControlGroups,
  relationshipSelection,
  shouldClearLineFocusOnEscape,
  shouldRestoreGraphViewOnEscape,
  enterCourseConnectionsView,
  popGraphView,
  type GraphScope,
  type GraphViewSnapshot,
} from "@/lib/graph";
import type { Course } from "@/lib/types";
import { expressionLabel } from "@/lib/validation";
import { addableLineCourses } from "@/lib/plan";
import { useApp } from "./app-provider";
import { CodeLinks, courseStatus, requirementBadge } from "./course-card";
import { CatalogState } from "./catalog-state";
import { PageHeading, creditLabel } from "./ui";
import { GraphCanvas } from "./graph-canvas";

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

function graphStatus(course: Course | undefined, code: string, completed: Set<string>, waived: Set<string>, planned: Set<string>, prior: Set<string>) {
  if (!course) return { label: "Locked", className: "locked" };
  return courseStatus(course, completed.has(code), waived.has(code), planned.has(code), prior);
}

function GraphWorkspace() {
  const { catalog, openCourse, openPicker, plan, addCourses, hydrated } = useApp();
  const [focusCode, setFocusCode] = useState("CS 5010");
  const [selectedCode, setSelectedCode] = useState("CS 5010");
  const [selectedRelationship, setSelectedRelationship] = useState<ReturnType<typeof relationshipSelection.branch> | ReturnType<typeof relationshipSelection.bus> | null>(null);
  const [search, setSearch] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const [depth, setDepth] = useState<GraphScope>("course");
  const [view, setView] = useState<"graph" | "table">("graph");
  const [zoom, setZoom] = useState(GRAPH_READABLE_ZOOM);
  const [fitRequest, setFitRequest] = useState(0);
  const acknowledgedFitRequest = useRef(0);
  const [fullscreenBusy, setFullscreenBusy] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");
  const [navigation, setNavigation] = useState({ codes: ["CS 5010"], index: 0 });
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
  const courseMap = useMemo(() => new Map(catalog?.courses.map((course) => [course.code, course]) ?? []), [catalog]);
  const history = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses]), [plan.completedCourses, plan.waivedCourses]);
  const completed = useMemo(() => new Set(plan.completedCourses), [plan.completedCourses]);
  const waived = useMemo(() => new Set(plan.waivedCourses), [plan.waivedCourses]);
  const planned = useMemo(() => new Set(plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code))), [plan.semesters]);
  const recorded = useMemo(() => new Set([...history, ...planned]), [history, planned]);
  const scene = useMemo(() => {
    if (!catalog) {
      return {
        visible: new Map<string, number>(),
        positions: new Map<string, { x: number; y: number }>(),
        bands: [],
        arrows: [],
        chain: new Set<string>(),
      };
    }
    return mapScene({
      courses: catalog.courses,
      requirements: catalog.requirements,
      scope: depth,
      focusCode,
      selectedCode,
    });
  }, [catalog, depth, focusCode, selectedCode]);
  const visible = scene.visible;
  const highlighted = scene.chain;
  const graph = useMemo(() => {
    const incoming = new Set(scene.arrows.map((edge) => edge.target));
    const outgoing = new Set(scene.arrows.map((edge) => edge.source));
    const makeNode = (code: string, x: number, y: number): GraphNode => {
      const course = courseMap.get(code);
      const emphasized = selectedRelationship ? selectedRelationship.codes.has(code) : highlighted.has(code);
      const focused = code === selectedCode;
      const badge = requirementBadge(course?.requirementType ?? "external");
      const status = graphStatus(course, code, completed, waived, planned, history);
      const locked = status.className === "locked";
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
          dimmed: Boolean(selectedRelationship && !selectedRelationship.codes.has(code)),
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
    const busOwners = new Map<string, string>();
    const busBounds = new Map<string, { start: number; end: number }>();
    for (const edge of scene.arrows) {
      const owner = busOwners.get(edge.target);
      if (!owner || edge.source.localeCompare(owner, undefined, { numeric: true }) < 0) busOwners.set(edge.target, edge.source);
      const source = scene.positions.get(edge.source);
      const target = scene.positions.get(edge.target);
      if (!source || !target) continue;
      const sourceX = source.x + 224;
      const targetX = target.x;
      const entryY = targetX - sourceX <= 180 && targetX > sourceX ? source.y + 58 : source.y + 140;
      const previous = busBounds.get(edge.target);
      busBounds.set(edge.target, {
        start: Math.min(previous?.start ?? entryY, entryY, target.y + 58),
        end: Math.max(previous?.end ?? entryY, entryY, target.y + 58),
      });
    }
    const edges: Edge[] = scene.arrows.map((edge, index) => {
      const stroke = edge.stroke;
      const selected = selectedRelationship?.kind === "branch"
        ? selectedRelationship.source === edge.source && selectedRelationship.target === edge.target
        : selectedRelationship?.kind === "bus" ? selectedRelationship.target === edge.target : false;
      return {
        id: `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        type: "prerequisite",
        data: {
          busOffset: targetTracks.get(edge.target) ?? 36,
          busStartY: busBounds.get(edge.target)?.start,
          busEndY: busBounds.get(edge.target)?.end,
          isBusOwner: busOwners.get(edge.target) === edge.source,
          selected,
          onSelectBranch: () => setSelectedRelationship(relationshipSelection.branch(edge.source, edge.target)),
          onSelectBus: () => setSelectedRelationship(relationshipSelection.bus(scene.arrows.map((arrow) => ({ ...arrow, corequisite: false })), edge.target)),
        },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
        style: { stroke, strokeWidth: selected || edge.emphasized ? 2.5 : 1.25, opacity: selectedRelationship && !selected ? 0.18 : 1 },
        zIndex: selected || edge.emphasized ? GRAPH_SELECTED_EDGE_Z : 0,
        ariaLabel: `${edge.source} unlocks ${edge.target}`,
        focusable: false,
        selectable: true,
      };
    });
    const courseNodes = nodes.filter((node): node is GraphNode => node.type === "course");
    return { nodes, edges, courseNodes };
  }, [scene, highlighted, selectedCode, selectedRelationship, courseMap, history, completed, waived, planned]);
  const programCodes = useMemo(
    () => (catalog ? programMapCodes(catalog.courses, catalog.requirements) : new Set<string>()),
    [catalog],
  );
  const found = useMemo(
    () => mapFind.query(catalog?.courses ?? [], search, programCodes),
    [catalog, search, programCodes],
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
  const locate = (code: string, keepFind = false, record = true) => {
    if (record && code !== selectedCode) {
      setNavigation((previous) => ({ codes: [...previous.codes.slice(0, previous.index + 1), code], index: previous.index + 1 }));
    }
    setViewStack([]);
    setFocusCode(code);
    setSelectedCode(code);
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
  const inspectCourse = (code: string, record = true) => {
    if (record && code !== selectedCode) {
      setNavigation((previous) => ({ codes: [...previous.codes.slice(0, previous.index + 1), code], index: previous.index + 1 }));
    }
    setSelectedCode(code);
    setSelectedRelationship(null);
    requestAnimationFrame(() => document.getElementById("graph-inspector")?.focus({ preventScroll: true }));
  };
  const enterConnections = (code: string) => {
    const entered = enterCourseConnectionsView({ depth, focusCode, zoom }, code, GRAPH_READABLE_ZOOM);
    const previousView = entered.previous;
    if (previousView) setViewStack((stack) => [...stack, previousView]);
    if (code !== selectedCode) {
      setNavigation((previous) => ({ codes: [...previous.codes.slice(0, previous.index + 1), code], index: previous.index + 1 }));
    }
    setSelectedCode(code);
    setSelectedRelationship(null);
    setFocusCode(entered.next.focusCode);
    setDepth(entered.next.depth);
    setZoom(entered.next.zoom);
    requestAnimationFrame(() => document.getElementById("graph-inspector")?.focus({ preventScroll: true }));
  };
  const chooseScope = (next: GraphScope, nextFocus?: string) => {
    setViewStack([]);
    setSelectedRelationship(null);
    if (nextFocus) setFocusCode(nextFocus);
    setDepth(next);
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
  const selectedStatus = graphStatus(selected, selectedCode, completed, waived, planned, history);
  const findStatus = !search.trim() ? "" : matches.length ? `${findIndex >= 0 ? findIndex + 1 : 0} of ${matches.length}` : "No matches";
  const showCorequisites = Boolean(selected?.corequisiteCodes.length);
  const relationshipGroups = relationshipControlGroups(scene.arrows.map((arrow) => ({ ...arrow, corequisite: false })));
  const lineSemester = plan.semesters.some((semester) => semester.id === lineSemesterId) ? lineSemesterId : (plan.semesters[0]?.id ?? "");
  const lineItems = selectedRelationship && catalog ? addableLineCourses(selectedRelationship.codes, catalog.courses, recorded) : [];
  const lineLabel = selectedRelationship?.kind === "branch"
    ? `${selectedRelationship.source} → ${selectedRelationship.target}`
    : selectedRelationship ? `${selectedRelationship.target} shared prerequisite bus` : "";
  const clearLineFocus = () => setSelectedRelationship(null);
  return <>
    <PageHeading title="Prerequisite Graph" description="See what a course needs and what it unlocks. Select a course to explore its connections." />
    <div className="graph-legend" aria-label="Map legend">
      <span><i className="legend-node core" /> Core</span>
      <span><i className="legend-node breadth" /> Breadth</span>
      <span><i className="legend-node elective" /> Elective</span>
      <span><span className="status-pill completed">Completed</span></span>
      <span><span className="status-pill eligible">Prerequisite eligible</span></span>
      <span><span className="status-pill planned">Planned</span></span>
      <span><span className="status-pill locked">Locked</span></span>
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
            <button type="button" className="button button-secondary button-small" aria-label="Previous course" disabled={navigation.index === 0} onClick={() => { const index = navigation.index - 1; inspectCourse(navigation.codes[index]!, false); setNavigation({ ...navigation, index }); }}><ArrowLeft size={14} /> Back</button>
            <button type="button" className="button button-secondary button-small" aria-label="Next course in history" disabled={navigation.index === navigation.codes.length - 1} onClick={() => { const index = navigation.index + 1; inspectCourse(navigation.codes[index]!, false); setNavigation({ ...navigation, index }); }}><ArrowRight size={14} /></button>
          </div>
          <span>{depth === "program" ? <>Entire <strong>MSCS Seattle</strong> program</> : depth === "1" ? <><Crosshair size={15} /> Connections for <strong>{focusCode}</strong></> : <><Crosshair size={15} /> Course chain for <strong>{focusCode}</strong></>}</span>
          <span role="status">{graph.courseNodes.length} courses. {graph.edges.length} {graph.edges.length === 1 ? "unlock arrow" : "unlock arrows"}. Selected {selectedCode}{selectedRelationship ? ` · ${selectedRelationship.kind === "branch" ? `${selectedRelationship.source} unlocks ${selectedRelationship.target}` : `${selectedRelationship.sources.join(", ")} unlock ${selectedRelationship.target}`}` : ""}.</span>
          <div className="segmented-control" aria-label="Map display">
            <button type="button" aria-pressed={view === "graph"} className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}><Network size={15} /> Map</button>
            <button type="button" aria-pressed={view === "table"} className={view === "table" ? "selected" : ""} onClick={() => setView("table")}><List size={15} /> Table</button>
          </div>
          <label className="graph-depth-label">Show
            <select value={depth} onChange={(event) => chooseScope(event.target.value as GraphScope)}>
              <option value="course">This course’s full chain</option>
              <option value="program">Entire program</option>
              <option value="1">This course’s connections</option>
              <option value="2">Two connections away</option>
              <option value="full">Full connected component</option>
              <option value="prerequisites">All prerequisites</option>
            </select>
          </label>
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
                <td>{node.data.prerequisites}<div className="detail-code-links"><CodeLinks codes={course?.prerequisiteCodes ?? []} limit={1000} /></div></td>
                <td>{node.data.corequisites}<div className="detail-code-links"><CodeLinks codes={course?.corequisiteCodes ?? []} limit={1000} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {view === "graph" && <p className="graph-canvas-hint">Arrows point at the course that lists the prerequisite. Select a colored branch for that exact relationship, or its shared bus for every visible prerequisite of that destination. Click a course card for details. Double-click a course to show its connections, then press Escape to return to the previous view. Click empty map or Exit line focus to show every relationship again.</p>}
      </section>
      <aside className="graph-inspector" id="graph-inspector" tabIndex={-1}>
        {selectedRelationship ? <div className="line-focus-banner">
          <div className="line-focus-banner-copy">
            <p><strong>Line focus</strong> {lineLabel}</p>
            <p className="muted small-text">The current map stays put. Exit to restore every visible relationship.</p>
          </div>
          <button type="button" className="button button-secondary" onClick={clearLineFocus}><X size={15} /> Exit line focus</button>
          {plan.semesters.length ? <div className="line-focus-plan">
            <label className="field-label" htmlFor="line-focus-semester">Add this line to a semester</label>
            <div className="input-action-row">
              <select id="line-focus-semester" value={lineSemester} onChange={(event) => setLineSemesterId(event.target.value)}>
                {plan.semesters.map((term) => <option key={term.id} value={term.id}>{term.name}{term.type === "coop" ? " · co-op" : ""}</option>)}
              </select>
              <button type="button" className="button button-primary" disabled={!hydrated || !lineItems.length || !lineSemester} onClick={() => { if (lineSemester) addCourses(selectedRelationship.codes, lineSemester); }}><CalendarPlus size={15} /> Add {lineItems.length === 1 ? "1 course" : `${lineItems.length} courses`}</button>
            </div>
            <p className="muted small-text">{lineItems.length ? `Will add ${lineItems.map((item) => item.code).join(", ")}.` : "Every course on this line is already in your plan or history, or is an external catalog reference."}</p>
          </div> : <p className="muted small-text">Create a semester on Build My Plan before adding this line.</p>}
        </div> : null}
        <div className="inspector-heading-meta">
          <span className={badge.className}>{badge.label}</span>
          <span className={`status-pill ${selectedStatus.className}`}>{selectedStatus.label}</span>
        </div>
        <h2>{selectedCode}</h2>
        <p className="inspector-course-title">{selected?.title ?? "External course reference"}</p>
        <p className="muted small-text">{selected ? `${creditLabel(selected)} credits` : "Credits unknown"}</p>
        {selected?.description ? <p className="inspector-description">{selected.description}</p> : <p className="muted small-text">No catalog description is cached for this code.</p>}
        {depth !== "program" && <button className="text-button inspector-focus" onClick={() => chooseScope("program")}><Network size={14} /> Show entire program</button>}
        {depth !== "1" && <button className="text-button inspector-focus" onClick={() => enterConnections(selectedCode)}><Crosshair size={14} /> Show neighborhood</button>}
        {depth !== "program" && focusCode !== selectedCode && <button className="text-button inspector-focus" onClick={() => focus(selectedCode)}><Crosshair size={14} /> Focus map here</button>}
        <button className="text-button inspector-focus" onClick={() => chooseScope("prerequisites", selectedCode)}><ArrowLeft size={14} /> Trace all prerequisites</button>
        {viewStack.length ? <button type="button" className="text-button inspector-focus" aria-keyshortcuts="Escape" onClick={restorePreviousView}><ArrowLeft size={14} /> Return to previous view</button> : null}
        <div className="inspector-relationships">
          {selectedRelationship ? <div className="graph-relationship-explanation"><h3>{selectedRelationship.kind === "branch" ? `${selectedRelationship.source} → ${selectedRelationship.target}` : `${selectedRelationship.target} shared prerequisite bus`}</h3><p>{selectedRelationship.kind === "branch" ? `${selectedRelationship.source} is named as a prerequisite of ${selectedRelationship.target}.` : `Visible incoming prerequisites: ${selectedRelationship.sources.join(", ")}.`}</p><p><strong>{selectedRelationship.target} catalog rule:</strong> {nodeRequirementCopy(relationshipTarget, "prerequisites")}</p><p className="muted small-text">A line records a named catalog link; the rule above states whether prerequisites are AND, OR, or need review.</p></div> : null}
          {scene.arrows.length ? <><h3>Visible map relationships</h3><div className="graph-relationship-buttons">{relationshipGroups.map((group) => <Fragment key={group.target}>
            <button key={`${group.target}-bus`} type="button" className="text-button" aria-pressed={selectedRelationship?.kind === "bus" && selectedRelationship.target === group.target} aria-label={`Select every visible prerequisite of ${group.target}: ${group.sources.join(", ")}`} onClick={() => setSelectedRelationship(relationshipSelection.bus(scene.arrows.map((arrow) => ({ ...arrow, corequisite: false })), group.target))}>All into {group.target}</button>
            {group.branches.map((edge) => <button key={`${edge.source}-${edge.target}`} type="button" className="text-button" aria-pressed={selectedRelationship?.kind === "branch" && selectedRelationship.source === edge.source && selectedRelationship.target === edge.target} aria-label={`Select exact relationship ${edge.source} unlocks ${edge.target}`} onClick={() => setSelectedRelationship(relationshipSelection.branch(edge.source, edge.target))}>{edge.source} → {edge.target}</button>)}
          </Fragment>)}</div></> : <p className="muted small-text">This course has no prerequisite or unlock relationships in this catalog.</p>}
          <h3>Prerequisites <span>{selected?.requirementType === "external" ? 0 : selected?.prerequisiteCodes.length ?? 0}</span></h3>
          {selected?.requirementType === "external" ? <p>{nodeRequirementCopy(selected, "prerequisites")}</p> : <>
            <p>{selected ? expressionLabel(selected.prerequisites) : "Unknown"}</p>
            {selected?.prerequisiteCodes.length ? <div className="detail-code-links"><CodeLinks codes={selected.prerequisiteCodes} limit={1000} onSelect={focus} /></div> : <span className="muted small-text">No parsed prerequisites.</span>}
          </>}
          <h3>Unlocks <span>{selected?.unlocks.length ?? 0}</span></h3>
          {selected?.unlocks.length ? <div className="detail-code-links"><CodeLinks codes={selected.unlocks} limit={1000} onSelect={focus} /></div> : <span className="muted small-text">No linked downstream courses in this catalog.</span>}
          {showCorequisites ? <>
            <h3>Corequisites <span>{selected?.corequisiteCodes.length ?? 0}</span></h3>
            <p>{nodeRequirementCopy(selected, "corequisites")}</p>
            <div className="detail-code-links"><CodeLinks codes={selected?.corequisiteCodes ?? []} limit={1000} onSelect={focus} /></div>
          </> : null}
        </div>
        <div className="inspector-actions">
          {!recorded.has(selectedCode) && selected && selected.requirementType !== "external" && <button className="button button-primary" onClick={() => openPicker(undefined, selectedCode)}><Plus size={15} /> Add to Plan</button>}
          <button className="button button-secondary" onClick={() => openCourse(selectedCode)}>Full course details <ArrowRight size={14} /></button>
        </div>
        <div className="inspector-tip"><Info size={16} /><p>Arrows point at the course that lists the prerequisite. Locked cards need earlier courses first. Open Full course details for the complete catalog description. Offerings are not listed because they are unknown.</p></div>
      </aside>
    </div>
    <p className="page-footnote">The default map follows the selected course through its cataloged prerequisites and unlocks; it does not add a downstream course’s other prerequisite branches. Choose Entire program to browse all listed MSCS Seattle courses and their cataloged external prerequisites. A shared color groups lines by destination, not by AND/OR satisfaction; read the catalog rule in the inspector. A connection does not verify course availability.</p>
  </>;
}

export default function CourseGraph() {
  return <GraphWorkspace />;
}
