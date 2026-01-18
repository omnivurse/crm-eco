'use client';

import { useState, useCallback, useRef } from 'react';
import { cn } from '@crm-eco/ui/lib/utils';
import { WorkflowNode } from './WorkflowNode';
import type { WorkflowNode as WorkflowNodeType, WorkflowEdge } from '@/lib/workflows/types';

interface WorkflowCanvasProps {
  nodes: WorkflowNodeType[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onUpdateNode: (id: string, updates: Partial<WorkflowNodeType>) => void;
  onDeleteNode: (id: string) => void;
  onAddEdge: (source: string, target: string) => void;
  onDeleteEdge: (id: string) => void;
}

interface DragState {
  nodeId: string;
  startPos: { x: number; y: number };
  nodeStartPos: { x: number; y: number };
}

export function WorkflowCanvas({
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  onUpdateNode,
  onDeleteNode,
  onAddEdge,
  onDeleteEdge,
}: WorkflowCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Handle canvas panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-background')) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      onSelectNode(null);
    }
  }, [pan, onSelectNode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setMousePos({
        x: (e.clientX - rect.left - pan.x) / zoom,
        y: (e.clientY - rect.top - pan.y) / zoom,
      });
    }

    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }

    if (dragState) {
      const dx = e.clientX - dragState.startPos.x;
      const dy = e.clientY - dragState.startPos.y;
      onUpdateNode(dragState.nodeId, {
        position: {
          x: dragState.nodeStartPos.x + dx / zoom,
          y: dragState.nodeStartPos.y + dy / zoom,
        },
      });
    }
  }, [isPanning, panStart, dragState, zoom, onUpdateNode, pan]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDragState(null);
  }, []);

  // Handle zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.min(Math.max(z * delta, 0.25), 2));
  }, []);

  // Handle node drag start
  const handleNodeDragStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setDragState({
        nodeId,
        startPos: { x: e.clientX, y: e.clientY },
        nodeStartPos: { ...node.position },
      });
      onSelectNode(nodeId);
    }
  }, [nodes, onSelectNode]);

  // Handle connection start
  const handleConnectionStart = useCallback((nodeId: string) => {
    setConnectingFrom(nodeId);
  }, []);

  // Handle connection end
  const handleConnectionEnd = useCallback((targetId: string) => {
    if (connectingFrom && connectingFrom !== targetId) {
      onAddEdge(connectingFrom, targetId);
    }
    setConnectingFrom(null);
  }, [connectingFrom, onAddEdge]);

  // Draw edge path between two nodes
  const getEdgePath = (source: WorkflowNodeType, target: WorkflowNodeType) => {
    const sourceX = source.position.x + 140; // Right side of node (280/2)
    const sourceY = source.position.y + 40; // Center height
    const targetX = target.position.x;
    const targetY = target.position.y + 40;

    const midX = (sourceX + targetX) / 2;

    return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
  };

  return (
    <div
      ref={canvasRef}
      className="relative w-full h-full overflow-hidden bg-slate-50 dark:bg-slate-900"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Grid Background */}
      <div
        className="canvas-background absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
        }}
      />

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-1 z-10">
        <button
          onClick={() => setZoom(z => Math.min(z * 1.2, 2))}
          className="px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          +
        </button>
        <span className="text-sm text-slate-500 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.max(z * 0.8, 0.25))}
          className="px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          -
        </button>
        <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
        <button
          onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="px-2 py-1 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          Reset
        </button>
      </div>

      {/* Canvas Content */}
      <div
        className="absolute"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Edges */}
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          style={{ width: '5000px', height: '5000px', overflow: 'visible' }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill="currentColor"
                className="text-slate-400"
              />
            </marker>
          </defs>

          {/* Draw edges */}
          {edges.map(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);

            if (!sourceNode || !targetNode) return null;

            return (
              <g key={edge.id} className="pointer-events-auto">
                <path
                  d={getEdgePath(sourceNode, targetNode)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                  className="text-slate-400 hover:text-red-500 cursor-pointer transition-colors"
                  onClick={() => onDeleteEdge(edge.id)}
                />
                {edge.label && (
                  <text
                    x={(sourceNode.position.x + 140 + targetNode.position.x) / 2}
                    y={(sourceNode.position.y + targetNode.position.y) / 2 + 40 - 10}
                    textAnchor="middle"
                    className="text-xs fill-slate-500"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Drawing connection line */}
          {connectingFrom && (
            <line
              x1={nodes.find(n => n.id === connectingFrom)?.position.x ?? 0 + 140}
              y1={nodes.find(n => n.id === connectingFrom)?.position.y ?? 0 + 40}
              x2={mousePos.x}
              y2={mousePos.y}
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="5,5"
              className="text-violet-500"
            />
          )}
        </svg>

        {/* Nodes */}
        {nodes.map(node => (
          <WorkflowNode
            key={node.id}
            node={node}
            isSelected={selectedNodeId === node.id}
            onSelect={() => onSelectNode(node.id)}
            onDragStart={(e) => handleNodeDragStart(node.id, e)}
            onConnectionStart={() => handleConnectionStart(node.id)}
            onConnectionEnd={() => handleConnectionEnd(node.id)}
            onDelete={() => onDeleteNode(node.id)}
          />
        ))}
      </div>

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-slate-500 dark:text-slate-400 text-lg">
              Drag nodes from the sidebar to get started
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
              Start with a trigger node to define when this workflow runs
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
