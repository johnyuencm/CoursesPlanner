"use client";

import { useMemo, useState } from "react";
import { Background, BackgroundVariant, Controls, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, useReactFlow, type Edge, type Node, type NodeProps } from "@xyflow/react";
import { ArrowRight, Crosshair, Info, List, Maximize2, Network, Plus, Search } from "lucide-react";
import { catalogRelations, visibleGraphDistances, type GraphRelation } from "@/lib/graph";
import { dependencyClosure, expressionLabel } from "@/lib/validation";
import { useApp } from "./app-provider";
import { CodeLinks, requirementBadge } from "./course-card";
import { CatalogState } from "./catalog-state";
import { PageHeading, creditLabel } from "./ui";

type GraphScope = "program" | "1" | "2" | "full";
type GraphData = {
  code: string; title: string; kind: string; nodeClass: string; credits: string; prerequisites: string; corequisites: string;
  relation: string; emphasized: boolean; focused: boolean;
  selectCourse: (code: string) => void; openCourse: (code: string) => void;
};
type GraphNode = Node<GraphData, "course">;

function CourseNode({ data }: NodeProps<GraphNode>) {
  return <div className={`graph-course-node ${data.nodeClass} ${data.emphasized ? "graph-emphasized" : ""} ${data.focused ? "graph-focused" : ""}`}>
    <Handle type="target" position={Position.Left} /><button className="graph-node-main nodrag" onClick={() => data.selectCourse(data.code)} aria-label={`Select ${data.code}, ${data.title}. ${data.kind}.`}><span className="graph-node-meta"><span>{data.kind}</span><span>{data.credits}</span></span><strong>{data.code}</strong><span className="graph-node-title">{data.title}</span></button><div className="graph-node-bottom"><span>{data.relation || "Catalog course"}</span><button className="nodrag" onClick={() => data.openCourse(data.code)} aria-label={`Course details for ${data.code}`}>Details <ArrowRight size={10} /></button></div><div className="graph-node-tooltip" role="tooltip"><strong>{data.code} · {data.credits}</strong><span>Prerequisites: {data.prerequisites}</span><span>Corequisites: {data.corequisites}</span></div><Handle type="source" position={Position.Right} />
  </div>;
}
const nodeTypes = { course: CourseNode };

function FitToViewButton() {
  const { fitView } = useReactFlow();
  return <button className="button button-secondary button-small" type="button" onClick={() => { void fitView({ padding: 0.15 }); }}><Maximize2 size={14} /> Fit to view</button>;
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
  if (!course || course.requirementType === "external") return 0;
  if (course.requirementType === "core") return 1;
  if (course.requirementType === "breadth") return 2;
  return 3;
}

function GraphWorkspace() {
  const { catalog, openCourse, openPicker, plan } = useApp();
  const [focusCode, setFocusCode] = useState("CS 5010");
  const [selectedCode, setSelectedCode] = useState("CS 5010");
  const [search, setSearch] = useState("");
  const [depth, setDepth] = useState<GraphScope>("program");
  const [view, setView] = useState<"graph" | "table">("graph");
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
    const focusUpstream = dependencyClosure(focusCode, catalog?.courses ?? [], "upstream");
    const columns = new Map<number, string[]>();
    for (const [code, distance] of visible) {
      const rank = depth === "program" ? distance : code === focusCode ? 0 : focusUpstream.has(code) ? -distance : distance;
      const group = columns.get(rank) ?? [];
      group.push(code); columns.set(rank, group);
    }
    const nodes: GraphNode[] = [];
    const wrap = depth === "program" ? 6 : 4;
    let columnX = 0;
    for (const rank of Array.from(columns.keys()).sort((a, b) => a - b)) {
      const codes = columns.get(rank)!.sort((left, right) => typeOrder(left, courseMap) - typeOrder(right, courseMap) || left.localeCompare(right, undefined, { numeric: true }));
      const width = Math.ceil(codes.length / wrap);
      codes.forEach((code, index) => {
        const course = courseMap.get(code);
        const relation = code === selectedCode ? "Selected course" : upstream.has(code) ? "Upstream prerequisite" : downstream.has(code) ? "Downstream connection" : "";
        const kind = !course || course.requirementType === "external" ? "Locked / external" : course.requirementType === "core" ? "Required" : course.requirementType === "breadth" ? "Breadth" : "Elective";
        nodes.push({ id: code, type: "course", position: { x: (columnX + Math.floor(index / wrap)) * 230, y: (index % wrap) * 148 + (codes.length === 1 ? 148 : 0) }, data: { code, title: course?.title ?? "Metadata not in this catalog", kind, nodeClass: nodeClassFor(kind === "Locked / external" ? "external" : kind, history.has(code)), credits: course ? `${creditLabel(course)} cr` : "Unknown credits", prerequisites: course ? expressionLabel(course.prerequisites) : "Unknown", corequisites: course ? expressionLabel(course.corequisites) : "Unknown", relation, emphasized: !!relation, focused: code === selectedCode, selectCourse: setSelectedCode, openCourse: (value) => openCourse(value) }, ariaLabel: `${code}: ${course?.title ?? "External reference"}` });
      });
      columnX += width;
    }
    const highlighted = new Set([selectedCode, ...upstream, ...downstream]);
    const edges: Edge[] = relations.filter((edge: GraphRelation) => visible.has(edge.source) && visible.has(edge.target)).map((edge, index) => {
      const active = highlighted.has(edge.source) && highlighted.has(edge.target);
      return { id: `${edge.source}-${edge.target}-${index}`, source: edge.source, target: edge.target, type: "smoothstep", markerEnd: edge.corequisite ? undefined : { type: MarkerType.ArrowClosed, width: 18, height: 18, color: active ? "#64748b" : "#98a2b3" }, style: { stroke: active ? "#64748b" : "#98a2b3", strokeWidth: active ? 1.8 : 1.2, strokeDasharray: edge.corequisite ? "5 4" : undefined }, ariaLabel: `${edge.source} ${edge.corequisite ? "is a corequisite of" : "is a prerequisite reference for"} ${edge.target}`, focusable: true };
    });
    return { nodes, edges };
  }, [visible, depth, focusCode, selectedCode, upstream, downstream, catalog, courseMap, relations, openCourse, history]);
  if (!catalog) return <CatalogState />;
  const needle = search.toLowerCase().replace(/\s/g, "");
  const matches = search.trim() ? catalog.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().replace(/\s/g, "").includes(needle)).sort((left, right) => Number(visible.has(right.code)) - Number(visible.has(left.code)) || left.code.localeCompare(right.code, undefined, { numeric: true })).slice(0, 8) : [];
  const selected = courseMap.get(selectedCode);
  const badge = selected ? requirementBadge(selected.requirementType) : null;
  const focus = (code: string) => { setFocusCode(code); setSelectedCode(code); setSearch(""); };
  return <>
    <PageHeading title="Prerequisite Graph" description="Explore every official MSCS Seattle course and the cataloged prerequisites that connect them." actions={<div className="graph-toolbar"><div className="graph-search-wrap"><div className="search-field"><Search size={16} /><input type="search" aria-label="Search courses in graph" placeholder="Search courses in graph…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>{search && <div className="graph-search-results">{matches.length ? matches.map((course) => <button key={course.code} onClick={() => focus(course.code)}><strong>{course.code}</strong><span>{course.title}</span><Crosshair size={14} /></button>) : <p>No matching courses. Try another code or title.</p>}</div>}</div><FitToViewButton /></div>} />
    <div className="graph-legend" aria-label="Map legend"><span><i className="legend-node core" /> Required</span><span><i className="legend-node breadth" /> Breadth</span><span><i className="legend-node elective" /> Elective</span><span><i className="legend-node completed" /> Completed</span><span><i className="legend-node external" /> Locked / external</span><span><i className="legend-line" /> Prerequisite relationship</span></div>
    <div className="graph-layout"><section className="graph-panel" aria-label="Course prerequisite relationships"><div className="graph-panel-heading"><span>{depth === "program" ? <>Entire <strong>MSCS Seattle</strong> program</> : <><Crosshair size={15} /> Focused on <strong>{focusCode}</strong></>}</span><span>{graph.nodes.length} courses · {graph.edges.length} links</span><div className="segmented-control" aria-label="Map display"><button aria-pressed={view === "graph"} className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}><Network size={15} /> Map</button><button aria-pressed={view === "table"} className={view === "table" ? "selected" : ""} onClick={() => setView("table")}><List size={15} /> Table</button></div><label className="graph-depth-label">Show<select value={depth} onChange={(event) => setDepth(event.target.value as GraphScope)}><option value="program">Entire program</option><option value="1">Immediate neighborhood</option><option value="2">Two connections away</option><option value="full">Full connected component</option></select></label></div>{view === "graph" ? <div className="flow-canvas"><ReactFlow key={depth === "program" ? "program" : `${focusCode}-${depth}`} nodes={graph.nodes} edges={graph.edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.12 }} minZoom={0.08} maxZoom={1.8} nodesDraggable={false} nodesConnectable={false} elementsSelectable onNodeClick={(_, node) => setSelectedCode(node.id)} proOptions={{ hideAttribution: false }} aria-label="Interactive prerequisite map. Tab to a course, select it, or open its details. Use the zoom controls to navigate."><Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d5d9e0" /><Controls showInteractive={false} /></ReactFlow></div> : <div className="relationship-table-wrap"><table className="relationship-table"><caption className="sr-only">All courses in the selected neighborhood and their complete prerequisite and corequisite rules</caption><thead><tr><th scope="col">Course</th><th scope="col">Role</th><th scope="col">Prerequisite rule</th><th scope="col">Take together</th></tr></thead><tbody>{graph.nodes.map((node) => { const course = courseMap.get(node.id); return <tr key={node.id}><th scope="row"><button className="text-button" onClick={() => openCourse(node.id)}>{node.id}</button><span>{course?.title ?? "External reference — unknown metadata"}</span></th><td>{node.data.kind}</td><td>{node.data.prerequisites}<div className="detail-code-links"><CodeLinks codes={course?.prerequisiteCodes ?? []} limit={1000} /></div></td><td>{node.data.corequisites}<div className="detail-code-links"><CodeLinks codes={course?.corequisiteCodes ?? []} limit={1000} /></div></td></tr>; })}</tbody></table></div>}</section>
    <aside className="graph-inspector">{badge && <span className={badge.className}>{badge.label}</span>}<h2>{selectedCode}</h2><p className="inspector-course-title">{selected?.title ?? "External course reference"}</p><p className="muted small-text">{selected ? `${creditLabel(selected)} credits` : "Credits unknown"}</p>{depth !== "program" && <button className="text-button inspector-focus" onClick={() => setDepth("program")}><Network size={14} /> Show entire program</button>}{depth !== "1" && <button className="text-button inspector-focus" onClick={() => { setFocusCode(selectedCode); setDepth("1"); }}><Crosshair size={14} /> Show neighborhood</button>}{depth === "1" && focusCode !== selectedCode && <button className="text-button inspector-focus" onClick={() => focus(selectedCode)}><Crosshair size={14} /> Focus map here</button>}<div className="inspector-relationships"><h3>Prerequisites <span>{selected?.prerequisiteCodes.length ?? 0}</span></h3><p>{selected ? expressionLabel(selected.prerequisites) : "Unknown"}</p>{selected?.prerequisiteCodes.length ? <div className="detail-code-links"><CodeLinks codes={selected.prerequisiteCodes} limit={1000} /></div> : <span className="muted small-text">No parsed prerequisites.</span>}<h3>Unlocks <span>{selected?.unlocks.length ?? downstream.size}</span></h3>{selected?.unlocks.length ? <div className="detail-code-links"><CodeLinks codes={selected.unlocks} limit={1000} /></div> : <span className="muted small-text">No linked downstream courses in this catalog.</span>}</div><div className="inspector-actions">{!recorded.has(selectedCode) && selected && selected.requirementType !== "external" && <button className="button button-primary" onClick={() => openPicker(undefined, selectedCode)}><Plus size={15} /> Add to Plan</button>}<button className="button button-secondary" onClick={() => openCourse(selectedCode)}>Full course details <ArrowRight size={14} /></button></div><div className="inspector-tip"><Info size={16} /><p>Each arrow is a parsed reference, not an AND rule. Courses with no arrows still belong to the official program. OR alternatives and grade floors are preserved in course details and the relationship table. Offerings are not listed because they are unknown.</p></div></aside></div>
    <p className="page-footnote">The default map is every course listed on the official MSCS Seattle requirements page, plus cataloged external prerequisites those courses name. Select a node to emphasize its upstream and downstream chain. A connection does not verify course availability.</p>
  </>;
}

export default function CourseGraph() {
  return <ReactFlowProvider><GraphWorkspace /></ReactFlowProvider>;
}
