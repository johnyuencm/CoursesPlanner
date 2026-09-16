"use client";

import { Component, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from "react";
import { Background, BackgroundVariant, BaseEdge, ReactFlow, type Edge, type EdgeProps, type Node, type NodeTypes } from "@xyflow/react";
import {
  centeredGraphZoomScroll,
  consumeGraphFitRequest,
  GRAPH_CARD_WIDTH,
  GRAPH_HIT_TARGET_WIDTH,
  GRAPH_MAX_ZOOM,
  GRAPH_READABLE_ZOOM,
  isShortPrerequisiteSpan,
  prerequisiteConnector,
  prerequisiteHitPaths,
  selectedGraphScroll,
} from "@/lib/graph";

// Every incoming relationship uses the same target-side bus and arrowhead.
function PrerequisiteEdge({ sourceX, sourceY, targetX, targetY, markerEnd, style, data }: EdgeProps) {
  const busOffset = typeof data?.busOffset === "number" ? data.busOffset : 36;
  const path = prerequisiteConnector(sourceX, sourceY, targetX, targetY, busOffset);
  const edgeData = data as {
    isBusOwner?: boolean;
    busStartY?: number;
    busEndY?: number;
    selected?: boolean;
    onSelectBranch?: () => void;
    onSelectBus?: () => void;
  } | undefined;
  const short = isShortPrerequisiteSpan(sourceX, targetX);
  const busStartY = edgeData?.busStartY ?? (short ? sourceY : sourceY + 82);
  const busEndY = edgeData?.busEndY ?? targetY;
  const hitPaths = prerequisiteHitPaths(sourceX, sourceY, targetX, targetY, busOffset, busStartY, busEndY);
  const selectBranch = (event: MouseEvent<SVGPathElement>) => {
    event.preventDefault();
    event.stopPropagation();
    edgeData?.onSelectBranch?.();
  };
  const selectBus = (event: MouseEvent<SVGPathElement>) => {
    event.preventDefault();
    event.stopPropagation();
    edgeData?.onSelectBus?.();
  };
  return <>
    <BaseEdge path={path} markerEnd={markerEnd} style={style} interactionWidth={0} />
    <path d={hitPaths.branch} fill="none" stroke="transparent" strokeWidth={GRAPH_HIT_TARGET_WIDTH} pointerEvents="stroke" onClick={selectBranch} aria-label="Select this prerequisite relationship" />
    {edgeData?.isBusOwner ? <path d={hitPaths.bus} fill="none" stroke="transparent" strokeWidth={GRAPH_HIT_TARGET_WIDTH} pointerEvents="stroke" onClick={selectBus} aria-label="Select all visible prerequisites sharing this bus" /> : null}
    <circle cx={targetX - busOffset} cy={targetY} r={3} fill={style?.stroke ?? "#64748b"} pointerEvents="none" />
  </>;
}

const edgeTypes = { prerequisite: PrerequisiteEdge };

type ZoomScrollFrameProps = {
  zoom: number;
  scrollRef: RefObject<HTMLDivElement | null>;
  children?: ReactNode;
};

// This lifecycle runs before React shrinks the scroll area. A layout effect
// runs after that mutation, when the browser may already have clamped offsets.
export class GraphZoomScrollFrame extends Component<ZoomScrollFrameProps> {
  getSnapshotBeforeUpdate(previous: ZoomScrollFrameProps): ScrollToOptions | null {
    const element = this.props.scrollRef.current;
    if (!element || previous.zoom === this.props.zoom) return null;
    return centeredGraphZoomScroll(element, previous.zoom, this.props.zoom);
  }

  componentDidUpdate(_previous: ZoomScrollFrameProps, _state: unknown, snapshot: ScrollToOptions | null) {
    if (snapshot) this.props.scrollRef.current?.scrollTo(snapshot);
  }

  render() {
    return <div ref={this.props.scrollRef} className="flow-canvas" tabIndex={0} aria-label="Scrollable prerequisite map. Use the zoom controls, arrow keys, or scrollbars to explore.">
      {this.props.children}
    </div>;
  }
}

export function GraphCanvas({ nodes, edges, nodeTypes, selectedCode, zoom, fitRequest, acknowledgedFitRequest, onZoomChange, onClearLineFocus }: {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  selectedCode: string;
  zoom: number;
  fitRequest: number;
  acknowledgedFitRequest: RefObject<number>;
  onZoomChange: (zoom: number) => void;
  onClearLineFocus?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(400, ...nodes.map((node) => node.position.x + (Number(node.style?.width) || GRAPH_CARD_WIDTH) + 80));
  const height = Math.max(300, ...nodes.map((node) => node.position.y + 200));
  const selected = nodes.find((node) => node.id === selectedCode);
  const x = selected?.position.x ?? 0;
  const y = selected?.position.y ?? 0;
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const next = consumeGraphFitRequest(fitRequest, acknowledgedFitRequest,
      { width: element.clientWidth, height: element.clientHeight }, { width, height });
    if (next !== null) onZoomChange(next);
  }, [fitRequest, acknowledgedFitRequest, height, onZoomChange, size, width]);
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    // Move only the map, and only when the selected card is outside its viewport.
    element.scrollTo(selectedGraphScroll({ x, y }, zoomRef.current, {
      scrollLeft: element.scrollLeft,
      scrollTop: element.scrollTop,
      clientWidth: element.clientWidth,
      clientHeight: element.clientHeight,
    }));
  }, [x, y, selectedCode]);

  return <GraphZoomScrollFrame scrollRef={scrollRef} zoom={zoom}>
    <div style={{ width: Math.max(size.width - 20, width * zoom), height: Math.max(size.height - 20, height * zoom) }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        viewport={{ x: 32 * zoom, y: 32 * zoom, zoom }}
        minZoom={0.001}
        maxZoom={Math.max(GRAPH_READABLE_ZOOM, GRAPH_MAX_ZOOM)}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        onPaneClick={onClearLineFocus}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d5d9e0" />
      </ReactFlow>
    </div>
  </GraphZoomScrollFrame>;
}
