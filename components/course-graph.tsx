"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, MiniMap, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowRight, ChevronDown, ChevronUp, Crosshair, Info, List, Maximize2, Network, Plus, Search } from "lucide-react";
import { catalogRelations, findCourses, PROGRAM_COL, PROGRAM_ROW, programFlowPositions, programMapCodes, selectedChainRelations, shouldAutoLocateFind, visibleGraphDistances, wrapFindIndex, type GraphRelation } from "@/lib/graph";
import { dependencyClosure, expressionLabel } from "@/lib/validation";
import { useApp } from "./app-provider";
import { CodeLinks, requirementBadge } from "./course-card";
import { CatalogState } from "./catalog-state";
import { PageHeading, creditLabel } from "./ui";

type GraphScope = "program" | "1" | "2" | "full";
type GraphData = {
  code: string; title: string; kind: string; nodeClass: string; credits: string; prerequisites: string; corequisites: string;
  relation: string; emphasized: boolean; focused: boolean; compact: boolean; hasIncoming: boolean; hasOutgoing: boolean;
  selectCourse: (code: string) => void; openCourse: (code: string) => void;
};
type GraphNode = Node<GraphData, "course">;
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
  return <div className={`graph-course-node ${data.nodeClass} ${data.emphasized ? "graph-emphasized" : ""} ${data.focused ? "graph-focused" : ""} ${data.compact ? "graph-compact" : ""}`}>
    <Handle type="target" position={Position.Left} className={data.hasIncoming ? undefined : "graph-handle-hidden"} />
    <button type="button" className="graph-node-main nodrag" onClick={() => data.selectCourse(data.code)} aria-label={`Select ${data.code}, ${data.title}. ${data.kind}.${data.relation ? ` ${data.relation}.` : ""}`}>
      <span className="graph-node-meta"><span>{data.kind}</span><span>{data.credits}</span></span>
      <strong>{data.code}</strong>
      <span className="graph-node-title">{data.title}</span>
    </button>
    <div className="graph-node-bottom">
      <span>{data.relation || "Catalog course"}</span>
      <button type="button" tabIndex={-1} className="nodrag" onClick={() => data.openCourse(data.code)} aria-label={`Course details for ${data.code}`}>Details <ArrowRight size={10} /></button>
    </div>
    <div className="graph-node-tooltip" role="tooltip">
      <strong>{data.code} · {data.credits}</strong>
      {data.relation ? <span>{data.relation}</span> : null}
      <span>Prerequisites: {data.prerequisites}</span>
      <span>Corequisites: {data.corequisites}</span>
    </div>
    <Handle type="source" position={Position.Right} className={data.hasOutgoing ? undefined : "graph-handle-hidden"} />
  </div>;
}
const nodeTypes = { course: CourseNode };

function FitToViewButton() {
  const { fitView } = useReactFlow();
  return <button className="button button-secondary button-small" type="button" onClick={() => { void fitView({ padding: 0.12 }); }}><Maximize2 size={14} /> Fit to view</button>;
}

function nodeClassFor(kind: string, completed: boolean) {
  if (completed) return "graph-completed";
  if (kind === "Required") return "graph-core";
  if (kind === "Breadth") return "graph-breadth";
  if (kind === "Elective") return "graph-elective";
  return "graph-external";
}

function typeOrder(code: string, courseMap: Map<string, { requirementType: string }>) {
  const course = courseMap.get(code);
  if (!course || course.requirementType === "external") return 3;
  if (course.requirementType === "core") return 0;
  if (course.requirementType === "breadth") return 1;
  return 2;
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
  const locateRef = useRef<(code: string, keepFind?: boolean) => void>(() => {});
  const cycleRef = useRef<(step: number) => void>(() => {});
  const matchesRef = useRef<{ code: string; title: string }[]>([]);
  const courseMap = useMemo(() => new Map(catalog?.courses.map((course) => [course.code, course]) ?? []), [catalog]);
  const history = useMemo(() => new Set([...plan.completedCourses, ...plan.waivedCourses]), [plan.completedCourses, plan.waivedCourses]);
  const recorded = useMemo(() => new Set([...history, ...plan.semesters.flatMap((semester) => semester.courses.map((course) => course.code))]), [history, plan.semesters]);
  const relations = useMemo(() => catalogRelations(catalog?.courses ?? []), [catalog]);
  const upstream = useMemo(() => dependencyClosure(selectedCode, catalog?.courses ?? [], "upstream"), [catalog, selectedCode]);
  const downstream = useMemo(() => dependencyClosure(selectedCode, catalog?.courses ?? [], "downstream"), [catalog, selectedCode]);
  const visible = useMemo(() => {
    if (!catalog) return new Map<string, number>();
    return visibleGraphDistances(depth, focusCode, catalog.courses, catalog.requirements, relations);
  }, [catalog, depth, focusCode, relations]);
  const graph = useMemo(() => {
    const highlighted = new Set([selectedCode, ...upstream, ...downstream]);
    const scoped = relations.filter((edge: GraphRelation) => visible.has(edge.source) && visible.has(edge.target));
    const drawn = depth === "program" ? selectedChainRelations(scoped, highlighted) : scoped;
    const incoming = new Set(drawn.map((edge) => edge.target));
    const outgoing = new Set(drawn.map((edge) => edge.source));
    const makeNode = (code: string, x: number, y: number): GraphNode => {
      const course = courseMap.get(code);
      const relation = code === selectedCode ? "Selected course" : upstream.has(code) ? "Upstream prerequisite" : downstream.has(code) ? "Downstream connection" : "";
      const kind = !course || course.requirementType === "external" ? "Locked / external" : course.requirementType === "core" ? "Required" : course.requirementType === "breadth" ? "Breadth" : "Elective";
      return { id: code, type: "course", position: { x, y }, data: { code, title: course?.title ?? "Metadata not in this catalog", kind, nodeClass: nodeClassFor(kind === "Locked / external" ? "external" : kind, history.has(code)), credits: course ? `${creditLabel(course)} cr` : "Unknown credits", prerequisites: nodeRequirementCopy(course, "prerequisites"), corequisites: nodeRequirementCopy(course, "corequisites"), relation, emphasized: !!relation, focused: code === selectedCode, compact: depth === "program", hasIncoming: incoming.has(code), hasOutgoing: outgoing.has(code), selectCourse: setSelectedCode, openCourse }, ariaLabel: `${code}: ${course?.title ?? "External reference"}` };
    };
    const nodes: GraphNode[] = [];
    if (depth === "program") {
      const compare = (left: string, right: string) => typeOrder(left, courseMap) - typeOrder(right, courseMap) || left.localeCompare(right, undefined, { numeric: true });
      for (const [code, point] of programFlowPositions(visible.keys(), relations, compare)) {
        nodes.push(makeNode(code, point.x, point.y));
      }
    } else {
      const focusUpstream = dependencyClosure(focusCode, catalog?.courses ?? [], "upstream");
      const columns = new Map<number, string[]>();
      for (const [code, distance] of visible) {
        const rank = code === focusCode ? 0 : focusUpstream.has(code) ? -distance : distance;
        const group = columns.get(rank) ?? [];
        group.push(code); columns.set(rank, group);
      }
      const wrap = 4;
      let columnX = 0;
      for (const rank of Array.from(columns.keys()).sort((a, b) => a - b)) {
        const codes = columns.get(rank)!.sort((left, right) => typeOrder(left, courseMap) - typeOrder(right, courseMap) || left.localeCompare(right, undefined, { numeric: true }));
        const width = Math.ceil(codes.length / wrap);
        codes.forEach((code, index) => nodes.push(makeNode(code, (columnX + Math.floor(index / wrap)) * 230, (index % wrap) * 148 + (codes.length === 1 ? 148 : 0))));
        columnX += width;
      }
    }
    const edges: Edge[] = drawn.map((edge, index) => {
      const active = highlighted.has(edge.source) && highlighted.has(edge.target);
      return { id: `${edge.source}-${edge.target}-${index}`, source: edge.source, target: edge.target, type: "smoothstep", markerEnd: edge.corequisite ? undefined : { type: MarkerType.ArrowClosed, width: 18, height: 18, color: active ? "#64748b" : "#98a2b3" }, style: { stroke: active ? "#64748b" : "#98a2b3", strokeWidth: active ? 1.8 : 1.2, strokeDasharray: edge.corequisite ? "5 4" : undefined }, ariaLabel: `${edge.source} ${edge.corequisite ? "is a corequisite of" : "is a prerequisite of"} ${edge.target}`, focusable: false };
    });
    return { nodes, edges };
  }, [visible, depth, focusCode, selectedCode, upstream, downstream, catalog, courseMap, relations, openCourse, history]);
  const programCodes = useMemo(
    () => (catalog ? programMapCodes(catalog.courses, catalog.requirements) : new Set<string>()),
    [catalog],
  );
  const matches = useMemo(
    () => findCourses(catalog?.courses ?? [], search, programCodes),
    [catalog, search, programCodes],
  );
  matchesRef.current = matches;
  useEffect(() => {
    if (!matches.length) {
      setFindIndex(-1);
      return;
    }
    if (!shouldAutoLocateFind(search, matches.length)) return;
    setFindIndex(0);
    locateRef.current(matches[0]!.code, true);
  }, [search, matches]);
  useEffect(() => {
    if (findIndex < 0) return;
    document.getElementById(`graph-find-hit-${findIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [findIndex]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("[role='dialog']")) return;
      const modifier = event.ctrlKey || event.metaKey;
      if ((event.key === "f" || event.key === "F") && modifier && !event.altKey) {
        event.preventDefault();
        const input = findInputRef.current;
        input?.focus();
        input?.select();
        return;
      }
      const findNext = event.key === "F3" || ((event.key === "g" || event.key === "G") && modifier);
      if (findNext && matchesRef.current.length) {
        event.preventDefault();
        cycleRef.current(event.shiftKey ? -1 : 1);
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
    const laid = graph.nodes.find((node) => node.id === code);
    if (laid) void setCenter(laid.position.x + (PROGRAM_COL - 12) / 2, laid.position.y + (PROGRAM_ROW - 8) / 2, { zoom: READABLE_ZOOM, duration: 180 });
  };
  const locate = (code: string, keepFind = false) => {
    const onMap = visible.has(code);
    setFocusCode(code);
    setSelectedCode(code);
    if (!onMap) {
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
    const next = wrapFindIndex(findIndex, matches.length, step);
    setFindIndex(next);
    const course = matches[next];
    if (course) locate(course.code, true);
  };
  locateRef.current = locate;
  cycleRef.current = cycle;
  const focus = (code: string) => locate(code, false);
  if (!catalog) return <CatalogState />;
  const selected = courseMap.get(selectedCode);
  const badge = selected ? requirementBadge(selected.requirementType) : null;
  const findStatus = !search.trim() ? "" : matches.length ? `${findIndex >= 0 ? findIndex + 1 : 0} of ${matches.length}` : "No matches";
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
    <div className="graph-legend" aria-label="Map legend"><span><i className="legend-node core" /> Required</span><span><i className="legend-node breadth" /> Breadth</span><span><i className="legend-node elective" /> Elective</span><span><i className="legend-node completed" /> Completed</span><span><i className="legend-node external" /> Locked / external</span><span><i className="legend-node emphasis" /> Linked to selected</span><span><i className="legend-line" /> Prerequisite relationship</span></div>
    <div className="graph-layout">
      <section className="graph-panel" aria-label="Course prerequisite relationships">
        <a className="graph-skip" href="#graph-inspector">Skip map to selected course</a>
        <div className="graph-panel-heading">
          <span>{depth === "program" ? <>Entire <strong>MSCS Seattle</strong> program</> : <><Crosshair size={15} /> Focused on <strong>{focusCode}</strong></>}</span>
          <span role="status">{graph.nodes.length} courses. {graph.edges.length} {graph.edges.length === 1 ? "arrow" : "arrows"} for {selectedCode}{depth === "program" ? "" : ` · focused on ${focusCode}`}.</span>
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
            onNodeClick={(_, node) => setSelectedCode(node.id)}
            proOptions={{ hideAttribution: false }}
            aria-label="Interactive prerequisite map. Press Control F to find a course, then Enter or F3 for the next match. Use zoom, pan, the minimap, or Fit to view to see the rest of the program."
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d5d9e0" />
            <MiniMap pannable zoomable aria-label="Overview of every course currently on the map" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div> : <div className="relationship-table-wrap">
          <table className="relationship-table">
            <caption className="sr-only">All courses in the selected neighborhood and their complete prerequisite and corequisite rules</caption>
            <thead><tr><th scope="col">Course</th><th scope="col">Role</th><th scope="col">Prerequisite rule</th><th scope="col">Take together</th></tr></thead>
            <tbody>{graph.nodes.map((node) => {
              const course = courseMap.get(node.id);
              return <tr key={node.id} id={tableRowId(node.id)} className={node.id === selectedCode ? "graph-find-current" : undefined}>
                <th scope="row"><button className="text-button" onClick={() => openCourse(node.id)}>{node.id}</button><span>{course?.title ?? "External reference — unknown metadata"}</span></th>
                <td>{node.data.kind}</td>
                <td>{node.data.prerequisites}<div className="detail-code-links"><CodeLinks codes={course?.prerequisiteCodes ?? []} limit={1000} /></div></td>
                <td>{node.data.corequisites}<div className="detail-code-links"><CodeLinks codes={course?.corequisiteCodes ?? []} limit={1000} /></div></td>
              </tr>;
            })}</tbody>
          </table>
        </div>}
        {view === "graph" && depth === "program" && <p className="graph-canvas-hint">Each arrow is a parsed prerequisite of the selected course, pointing at the course that lists it. Other program courses stay on the map without arrows. Courses with no cataloged links sit below.</p>}
      </section>
      <aside className="graph-inspector" id="graph-inspector" tabIndex={-1}>
        {badge && <span className={badge.className}>{badge.label}</span>}
        <h2>{selectedCode}</h2>
        <p className="inspector-course-title">{selected?.title ?? "External course reference"}</p>
        <p className="muted small-text">{selected ? `${creditLabel(selected)} credits` : "Credits unknown"}</p>
        {depth !== "program" && <button className="text-button inspector-focus" onClick={() => setDepth("program")}><Network size={14} /> Show entire program</button>}
        {depth !== "1" && <button className="text-button inspector-focus" onClick={() => { setFocusCode(selectedCode); setDepth("1"); }}><Crosshair size={14} /> Show neighborhood</button>}
        {depth !== "program" && focusCode !== selectedCode && <button className="text-button inspector-focus" onClick={() => focus(selectedCode)}><Crosshair size={14} /> Focus map here</button>}
        <div className="inspector-relationships">
          <h3>Prerequisites <span>{selected?.requirementType === "external" ? 0 : selected?.prerequisiteCodes.length ?? 0}</span></h3>
          {selected?.requirementType === "external" ? <p>{nodeRequirementCopy(selected, "prerequisites")}</p> : <>
            <p>{selected ? expressionLabel(selected.prerequisites) : "Unknown"}</p>
            {selected?.prerequisiteCodes.length ? <div className="detail-code-links"><CodeLinks codes={selected.prerequisiteCodes} limit={1000} onSelect={focus} /></div> : <span className="muted small-text">No parsed prerequisites.</span>}
          </>}
          <h3>Unlocks <span>{selected?.unlocks.length ?? downstream.size}</span></h3>
          {selected?.unlocks.length ? <div className="detail-code-links"><CodeLinks codes={selected.unlocks} limit={1000} onSelect={focus} /></div> : <span className="muted small-text">No linked downstream courses in this catalog.</span>}
        </div>
        <div className="inspector-actions">
          {!recorded.has(selectedCode) && selected && selected.requirementType !== "external" && <button className="button button-primary" onClick={() => openPicker(undefined, selectedCode)}><Plus size={15} /> Add to Plan</button>}
          <button className="button button-secondary" onClick={() => openCourse(selectedCode)}>Full course details <ArrowRight size={14} /></button>
        </div>
        <div className="inspector-tip"><Info size={16} /><p>Each arrow is a parsed prerequisite of the selected course, not an AND rule. Locked/external codes appear because a program course named them; their department catalog is not cached here. Offerings are not listed because they are unknown.</p></div>
      </aside>
    </div>
    <p className="page-footnote">The default map is every course listed on the official MSCS Seattle requirements page, plus cataloged external prerequisites those courses name. Select a course to see only that course&apos;s arrows. A connection does not verify course availability.</p>
  </>;
}

export default function CourseGraph() {
  return <ReactFlowProvider><GraphWorkspace /></ReactFlowProvider>;
}
