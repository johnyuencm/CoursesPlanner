"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowRight, ChevronDown, ChevronUp, Crosshair, Info, List, Maximize2, Network, Plus, Search } from "lucide-react";
import {
  compactGraphStatusLabel,
  mapFind,
  mapScene,
  PROGRAM_COL,
  PROGRAM_ROW,
  programMapCodes,
  type GraphScope,
} from "@/lib/graph";
import type { Course } from "@/lib/types";
import { expressionLabel } from "@/lib/validation";
import { useApp } from "./app-provider";
import { CodeLinks, courseStatus, requirementBadge } from "./course-card";
import { CatalogState } from "./catalog-state";
import { PageHeading, creditLabel } from "./ui";

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
  focused: boolean;
  compact: boolean;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  selectCourse: (code: string) => void;
};
type BandData = { label: string };
type GraphNode = Node<GraphData, "course">;
type BandNode = Node<BandData, "band">;
type FlowNode = GraphNode | BandNode;
const READABLE_ZOOM = 1;
const tableRowId = (code: string) => `graph-row-${code.replaceAll(" ", "-")}`;

function centerNode(
  getNode: (id: string) => { position: { x: number; y: number }; measured?: { width?: number; height?: number } } | undefined,
  setCenter: (x: number, y: number, options?: { zoom?: number; duration?: number }) => unknown,
  code: string,
  zoom = READABLE_ZOOM,
) {
  const node = getNode(code);
  if (!node) return;
  const width = node.measured?.width ?? PROGRAM_COL - 12;
  const height = node.measured?.height ?? PROGRAM_ROW - 8;
  void setCenter(node.position.x + width / 2, node.position.y + height / 2, { zoom, duration: 180 });
}

function CourseNode({ data }: NodeProps<GraphNode>) {
  return <div className={`graph-course-node ${data.core ? "core-course" : ""} ${data.locked ? "graph-locked" : ""} ${data.emphasized ? "graph-emphasized" : ""} ${data.focused ? "graph-focused" : ""} ${data.compact ? "graph-compact" : ""}`}>
    <Handle type="target" position={Position.Left} className={data.hasIncoming ? undefined : "graph-handle-hidden"} />
    <button type="button" className="graph-node-main nodrag" onClick={() => data.selectCourse(data.code)} aria-label={`Select ${data.code}, ${data.title}. ${data.badgeLabel}. ${data.statusLabel}.`}>
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

function FitToViewButton() {
  const { fitView } = useReactFlow();
  return <button className="button button-secondary button-small" type="button" onClick={() => { void fitView({ padding: 0.12 }); }}><Maximize2 size={14} /> Fit to view</button>;
}

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
  const { catalog, openCourse, openPicker, plan } = useApp();
  const { getNode, setCenter } = useReactFlow();
  const [focusCode, setFocusCode] = useState("CS 5010");
  const [selectedCode, setSelectedCode] = useState("CS 5010");
  const [search, setSearch] = useState("");
  const [findIndex, setFindIndex] = useState(-1);
  const [depth, setDepth] = useState<GraphScope>("program");
  const [view, setView] = useState<"graph" | "table">("graph");
  const findInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef(search);
  searchRef.current = search;
  const locateRef = useRef<(code: string, keepFind?: boolean) => void>(() => {});
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
      const emphasized = highlighted.has(code);
      const focused = code === selectedCode;
      const badge = requirementBadge(course?.requirementType ?? "external");
      const status = graphStatus(course, code, completed, waived, planned, history);
      const locked = status.className === "locked";
      return {
        id: code,
        type: "course",
        position: { x, y },
        zIndex: focused ? 12 : emphasized ? 6 : 1,
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
          focused,
          compact: true,
          hasIncoming: incoming.has(code),
          hasOutgoing: outgoing.has(code),
          selectCourse: setSelectedCode,
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
    const edges: Edge[] = scene.arrows.map((edge, index) => {
      const stroke = edge.stroke;
      return {
        id: `${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
        style: { stroke, strokeWidth: edge.emphasized ? 2.2 : 1.15 },
        zIndex: edge.emphasized ? 4 : 0,
        ariaLabel: `${edge.source} unlocks ${edge.target}`,
        focusable: false,
      };
    });
    const courseNodes = nodes.filter((node): node is GraphNode => node.type === "course");
    return { nodes, edges, courseNodes };
  }, [scene, highlighted, selectedCode, courseMap, history, completed, waived, planned]);
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
  const panTo = (code: string) => {
    if (getNode(code)) {
      centerNode(getNode, setCenter, code);
      return;
    }
    const laid = graph.courseNodes.find((node) => node.id === code);
    if (laid) void setCenter(laid.position.x + (PROGRAM_COL - 12) / 2, laid.position.y + (PROGRAM_ROW - 8) / 2, { zoom: READABLE_ZOOM, duration: 180 });
  };
  const locate = (code: string, keepFind = false) => {
    const reveal = mapFind.reveal(code, visible);
    setFocusCode(code);
    setSelectedCode(code);
    if (reveal.neighborhood) {
      setDepth("1");
    } else if (view === "table") {
      requestAnimationFrame(() => document.getElementById(tableRowId(code))?.scrollIntoView({ block: "nearest" }));
    } else {
      panTo(code);
      requestAnimationFrame(() => panTo(code));
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
  const cycle = (step: number) => {
    if (!matches.length) return;
    const next = mapFind.cycleIndex(findIndex, matches.length, step);
    setFindIndex(next);
    const course = matches[next];
    if (course) locate(course.code, true);
  };
  locateRef.current = locate;
  cycleRef.current = cycle;
  const focus = (code: string) => locate(code, false);
  if (!catalog) return <CatalogState />;
  const selected = courseMap.get(selectedCode);
  const badge = selected ? requirementBadge(selected.requirementType) : requirementBadge("external");
  const selectedStatus = graphStatus(selected, selectedCode, completed, waived, planned, history);
  const findStatus = !search.trim() ? "" : matches.length ? `${findIndex >= 0 ? findIndex + 1 : 0} of ${matches.length}` : "No matches";
  const showCorequisites = Boolean(selected?.corequisiteCodes.length);
  return <>
    <PageHeading title="Prerequisite Graph" description="Explore every official MSCS Seattle course and the cataloged prerequisites that connect them. Press Ctrl+F to find a course on the map." actions={<div className="graph-toolbar">
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
              <span>{course.title}{visible.has(course.code) ? "" : " · not on this view — opens neighborhood"}</span>
              <Crosshair size={14} />
            </button>
          )) : <p>No matching courses. Try another code or title.</p>}
        </div> : null}
      </div>
      <FitToViewButton />
    </div>} />
    <div className="graph-legend" aria-label="Map legend">
      <span><i className="legend-node core" /> Core</span>
      <span><i className="legend-node breadth" /> Breadth</span>
      <span><i className="legend-node elective" /> Elective</span>
      <span><span className="status-pill completed">Completed</span></span>
      <span><span className="status-pill eligible">Prerequisite eligible</span></span>
      <span><span className="status-pill planned">Planned</span></span>
      <span><span className="status-pill locked">Locked</span></span>
      <span><i className="legend-arrow" aria-hidden="true" /> Unlocks after this course</span>
      <span><span className="legend-band">No prerequisite required</span> Startable, unlinked</span>
    </div>
    <div className="graph-layout">
      <section className="graph-panel" aria-label="Course prerequisite relationships">
        <a className="graph-skip" href="#graph-inspector">Skip map to selected course</a>
        <div className="graph-panel-heading">
          <span>{depth === "program" ? <>Entire <strong>MSCS Seattle</strong> program</> : <><Crosshair size={15} /> Focused on <strong>{focusCode}</strong></>}</span>
          <span role="status">{graph.courseNodes.length} courses. {graph.edges.length} {graph.edges.length === 1 ? "unlock arrow" : "unlock arrows"}. Selected {selectedCode}{depth === "program" ? "" : ` · focused on ${focusCode}`}.</span>
          <div className="segmented-control" aria-label="Map display">
            <button type="button" aria-pressed={view === "graph"} className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}><Network size={15} /> Map</button>
            <button type="button" aria-pressed={view === "table"} className={view === "table" ? "selected" : ""} onClick={() => setView("table")}><List size={15} /> Table</button>
          </div>
          <label className="graph-depth-label">Show
            <select value={depth} onChange={(event) => setDepth(event.target.value as GraphScope)}>
              <option value="program">Entire program</option>
              <option value="1">Immediate neighborhood</option>
              <option value="2">Two connections away</option>
              <option value="full">Full connected component</option>
            </select>
          </label>
        </div>
        {view === "graph" ? <div className="flow-canvas">
          <ReactFlow
            key={depth === "program" ? "program" : `${focusCode}-${depth}`}
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView={depth !== "program"}
            fitViewOptions={{ padding: 0.15 }}
            defaultViewport={{ x: 28, y: 20, zoom: READABLE_ZOOM }}
            onInit={(instance) => {
              if (depth !== "program") return;
              centerNode((id) => instance.getNode(id), instance.setCenter, selectedCode, READABLE_ZOOM);
            }}
            minZoom={0.15}
            maxZoom={1.8}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            elementsSelectable
            onlyRenderVisibleElements
            onNodeClick={(_, node) => { if (node.type === "course") setSelectedCode(node.id); }}
            proOptions={{ hideAttribution: false }}
            aria-label="Interactive prerequisite map. Press Control F to find a course, then Enter or F3 for the next match. Use zoom, pan, or Fit to view to see the rest of the program."
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d5d9e0" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div> : <div className="relationship-table-wrap">
          <table className="relationship-table">
            <caption className="sr-only">All courses in the selected neighborhood and their complete prerequisite and corequisite rules</caption>
            <thead><tr><th scope="col">Course</th><th scope="col">Role</th><th scope="col">Prerequisite rule</th><th scope="col">Take together</th></tr></thead>
            <tbody>{graph.courseNodes.map((node) => {
              const course = courseMap.get(node.id);
              return <tr key={node.id} id={tableRowId(node.id)} className={node.id === selectedCode ? "graph-find-current" : undefined}>
                <th scope="row"><button className="text-button" onClick={() => openCourse(node.id)}>{node.id}</button><span>{course?.title ?? "External reference — unknown metadata"}</span></th>
                <td>{node.data.badgeLabel} · {node.data.statusLabel}</td>
                <td>{node.data.prerequisites}<div className="detail-code-links"><CodeLinks codes={course?.prerequisiteCodes ?? []} limit={1000} /></div></td>
                <td>{node.data.corequisites}<div className="detail-code-links"><CodeLinks codes={course?.corequisiteCodes ?? []} limit={1000} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {view === "graph" && depth === "program" && <p className="graph-canvas-hint">Arrows point at the course that lists the prerequisite. Locked cards need earlier courses first. The No prerequisite required band is startable electives and other courses with no parsed prerequisite and no links on this map.</p>}
      </section>
      <aside className="graph-inspector" id="graph-inspector" tabIndex={-1}>
        <div className="inspector-heading-meta">
          <span className={badge.className}>{badge.label}</span>
          <span className={`status-pill ${selectedStatus.className}`}>{selectedStatus.label}</span>
        </div>
        <h2>{selectedCode}</h2>
        <p className="inspector-course-title">{selected?.title ?? "External course reference"}</p>
        <p className="muted small-text">{selected ? `${creditLabel(selected)} credits` : "Credits unknown"}</p>
        {selected?.description ? <p className="inspector-description">{selected.description}</p> : <p className="muted small-text">No catalog description is cached for this code.</p>}
        {depth !== "program" && <button className="text-button inspector-focus" onClick={() => setDepth("program")}><Network size={14} /> Show entire program</button>}
        {depth !== "1" && <button className="text-button inspector-focus" onClick={() => { setFocusCode(selectedCode); setDepth("1"); }}><Crosshair size={14} /> Show neighborhood</button>}
        {depth !== "program" && focusCode !== selectedCode && <button className="text-button inspector-focus" onClick={() => focus(selectedCode)}><Crosshair size={14} /> Focus map here</button>}
        <div className="inspector-relationships">
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
    <p className="page-footnote">The default map is every course listed on the official MSCS Seattle requirements page, plus cataloged external prerequisites those courses name. All in-scope prerequisite arrows stay on the map; selecting a course emphasizes its chain. A connection does not verify course availability.</p>
  </>;
}

export default function CourseGraph() {
  return <ReactFlowProvider><GraphWorkspace /></ReactFlowProvider>;
}
