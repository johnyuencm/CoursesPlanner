"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Background, BackgroundVariant, BaseEdge, ReactFlow, type Edge, type EdgeProps, type Node, type NodeTypes } from "@xyflow/react";
import { GRAPH_HIT_TARGET_WIDTH, prerequisiteConnector, prerequisiteHitPaths } from "@/lib/graph";

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
  const short = targetX - sourceX <= 180 && targetX > sourceX;
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

export function GraphCanvas({ nodes, edges, nodeTypes, selectedCode, overview }: {
  nodes: Node[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  selectedCode: string;
  overview: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setSize({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const width = Math.max(400, ...nodes.map((node) => node.position.x + (Number(node.style?.width) || 224) + 80));
  const height = Math.max(300, ...nodes.map((node) => node.position.y + 200));
  const zoom = overview ? Math.min(1, (size.width - 20) / width, (size.height - 20) / height) : 1;
  const selected = nodes.find((node) => node.id === selectedCode);
  const x = selected?.position.x ?? 0;
  const y = selected?.position.y ?? 0;
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    if (overview) {
      element.scrollTo({ left: 0, top: 0 });
      return;
    }
    // Move only the map, and only when the selected card is outside its viewport.
    const left = x + 32;
    const top = y + 32;
    const outsideX = left < element.scrollLeft || left + 224 > element.scrollLeft + element.clientWidth;
    const outsideY = top < element.scrollTop || top + 116 > element.scrollTop + element.clientHeight;
    element.scrollTo({
      left: outsideX ? Math.max(0, left - (element.clientWidth - 224) / 2) : element.scrollLeft,
      top: outsideY ? Math.max(0, top - (element.clientHeight - 116) / 2) : element.scrollTop,
    });
  }, [x, y, selectedCode, overview]);

  return <div ref={scrollRef} className="flow-canvas" tabIndex={0} aria-label="Scrollable prerequisite map. Use arrow keys or scrollbars to explore. Cards remain at full size; Overview shows the whole map.">
    <div style={{ width: Math.max(size.width - 20, width * zoom), height: Math.max(size.height - 20, height * zoom) }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        viewport={{ x: 32 * zoom, y: 32 * zoom, zoom }}
        minZoom={0.001}
        maxZoom={1}
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
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#d5d9e0" />
      </ReactFlow>
    </div>
  </div>;
}
