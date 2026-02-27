"use client";
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
} from "@xyflow/react";
import { useEffect } from "react";
import type { Agent, CronJob } from "@/lib/types";
import { nodeTypes } from "@/components/AgentNode";

interface ManorMapProps {
  agents: Agent[];
  crons: CronJob[];
  onNodeClick: (agent: Agent) => void;
}

function buildLayout(agents: Agent[], crons: CronJob[]): { nodes: Node[]; edges: Edge[] } {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const withCrons = agents.map((a) => ({
    ...a,
    crons: crons.filter((c) => c.agentId === a.id),
  }));
  const agentMapWithCrons = new Map(withCrons.map((a) => [a.id, a]));

  const levels: string[][] = [];
  const visited = new Set<string>();
  const root = agents.find((a) => a.reportsTo === null);
  if (!root) return { nodes: [], edges: [] };

  let queue = [root.id];
  while (queue.length > 0) {
    levels.push([...queue]);
    queue.forEach((id) => visited.add(id));
    const nextQueue: string[] = [];
    for (const id of queue) {
      const agent = agentMap.get(id);
      if (!agent) continue;
      for (const childId of agent.directReports) {
        if (!visited.has(childId)) nextQueue.push(childId);
      }
    }
    queue = nextQueue;
  }

  const disconnected = agents.filter((a) => !visited.has(a.id));
  if (disconnected.length > 0) levels.push(disconnected.map((a) => a.id));

  const LEVEL_HEIGHT = 200;
  const nodes: Node[] = [];

  for (let level = 0; level < levels.length; level++) {
    const ids = levels[level];
    const spacing = Math.max(160, Math.min(220, 1400 / Math.max(ids.length, 1)));
    const totalWidth = ids.length * spacing;
    const startX = 600 - totalWidth / 2 + spacing / 2;

    ids.forEach((id, i) => {
      const agent = agentMapWithCrons.get(id);
      if (!agent) return;
      nodes.push({
        id,
        type: "agentNode",
        data: agent as unknown as Record<string, unknown>,
        position: { x: startX + i * spacing - spacing / 2, y: level * LEVEL_HEIGHT + 20 },
      });
    });
  }

  const edges: Edge[] = [];
  for (const agent of agents) {
    const parentAgent = agentMap.get(agent.id);
    if (!parentAgent) continue;
    for (const childId of parentAgent.directReports) {
      edges.push({
        id: `${agent.id}-${childId}`,
        source: agent.id,
        target: childId,
        animated: true,
        style: { stroke: 'var(--accent)', strokeWidth: 1.5, opacity: 0.7 },
      });
    }
  }

  return { nodes, edges };
}

export function ManorMap({ agents, crons, onNodeClick }: ManorMapProps) {
  const { nodes: initialNodes, edges: initialEdges } = buildLayout(agents, crons);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    const { nodes: n, edges: e } = buildLayout(agents, crons);
    setNodes(n);
    setEdges(e);
  }, [agents, crons]);

  const handleNodeClick = (_: React.MouseEvent, node: Node) => {
    const agent = agents.find((a) => a.id === node.id);
    if (agent) onNodeClick(agent);
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      minZoom={0.2}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Controls />
      <MiniMap
        nodeColor={(n) => (n.data as unknown as Agent).color || "rgba(84,84,88,0.4)"}
        maskColor="rgba(0,0,0,0.8)"
      />
    </ReactFlow>
  );
}
