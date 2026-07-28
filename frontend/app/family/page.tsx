"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  Connection,
  NodeTypes,
  NodeProps,
  ConnectionLineType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import Sidebar from "../components/DashboardLayout";

export type Person = {
  id: string;
  name: string;
  relationship?: string | null;
  kinship_label?: string | null;
  birth_year?: number | null;
  death_year?: number | null;
  notes?: string | null;
};

export type Relationship = {
  id: string;
  from_person_id: string;
  to_person_id: string;
  type: string;
};

type FamilyGraph = {
  persons: Person[];
  relationships: Relationship[];
  vault?: { kinship_system?: string; name?: string };
  viewpoint_person_id?: string;
};

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

async function fetchFamilyGraph(viewpoint?: string): Promise<FamilyGraph> {
  const url = viewpoint
    ? `${API_ROOT}/family?viewpoint=${encodeURIComponent(viewpoint)}`
    : `${API_ROOT}/family`;
  const res = await fetch(url);
  if (!res.ok) return { persons: [], relationships: [] };
  const json = await res.json();
  return {
    persons: json.persons ?? json.members ?? [],
    relationships: json.relationships ?? [],
    vault: json.vault,
    viewpoint_person_id: json.viewpoint_person_id,
  };
}

async function persistRelationship(
  fromPersonId: string,
  toPersonId: string,
  type = "relative"
): Promise<string | null> {
  const res = await fetch(`${API_ROOT}/family/relationship`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      from_person_id: fromPersonId,
      to_person_id: toPersonId,
      type,
    }),
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.id ?? null;
}

async function removeRelationship(relationshipId: string) {
  await fetch(`${API_ROOT}/family/relationship/${relationshipId}`, {
    method: "DELETE",
  });
}

function MemberNode({ data, selected }: NodeProps<Person>) {
  return (
    <div className="select-none w-[240px] bg-white rounded-xl shadow-md border border-neutral-200 p-4 relative">
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "#c89532",
          borderRadius: "50%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "#c89532",
          borderRadius: "50%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      <div className="text-lg font-semibold text-[#7a6321]">{data.name}</div>
      <div className="text-sm text-[#B8860B] mt-1 font-medium">
        {data.kinship_label || data.relationship}
      </div>
      <div className="text-xs text-neutral-400 mt-2">
        {data.birth_year ?? ""}
        {data.death_year ? ` — ${data.death_year}` : ""}
      </div>
      {selected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            boxShadow: "inset 0 0 0 2px rgba(165,128,55,0.12)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memberNode: MemberNode,
};

function FamilyTreeCanvas({
  persons,
  relationships,
}: {
  persons: Person[];
  relationships: Relationship[];
}) {
  const initialNodes: Node[] = useMemo(
    () =>
      persons.map((p, i) => ({
        id: String(p.id),
        type: "memberNode",
        data: p,
        position: {
          x: 100 + (i % 3) * 300,
          y: Math.floor(i / 3) * 200,
        },
      })),
    [persons]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      relationships.map((r) => ({
        id: r.id,
        source: r.from_person_id,
        target: r.to_person_id,
        label: r.type,
        type: "straight",
        style: { stroke: "#b58b2b", strokeWidth: 2 },
      })),
    [relationships]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    async (params: Connection) => {
      if (!params.source || !params.target) return;
      const id = await persistRelationship(params.source, params.target, "relative");
      if (!id) return;
      setEdges((eds) => [
        ...eds,
        {
          id,
          source: params.source!,
          target: params.target!,
          label: "relative",
          type: "straight",
          style: { stroke: "#b58b2b", strokeWidth: 2 },
        },
      ]);
    },
    [setEdges]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const selectedEdges = edges.filter((edge) => edge.selected);
      for (const edge of selectedEdges) {
        void removeRelationship(edge.id);
      }
      setEdges((eds) => eds.filter((edge) => !edge.selected));
      setNodes((nds) => nds.filter((n) => !n.selected));
    },
    [edges, setEdges, setNodes]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        connectionLineType={ConnectionLineType.Straight}
        style={{ background: "transparent" }}
      >
        <MiniMap />
        <Controls />
        <Background gap={16} size={1} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

export default function Page() {
  const [graph, setGraph] = useState<FamilyGraph>({
    persons: [],
    relationships: [],
  });
  const [viewpoint, setViewpoint] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFamilyGraph(viewpoint || undefined)
      .then((g) => {
        setGraph(g);
        if (!viewpoint && g.viewpoint_person_id) {
          setViewpoint(g.viewpoint_person_id);
        }
      })
      .catch(() => setGraph({ persons: [], relationships: [] }))
      .finally(() => setLoading(false));
  }, [viewpoint]);

  return (
    <Sidebar>
      <div className="w-full h-screen p-8 bg-[#faf6ea]">
        <header className="flex flex-wrap justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#7a6321]">Family Tree</h1>
            <p className="text-neutral-600">
              Knowledge graph with culturally aware kinship labels
              {graph.vault?.kinship_system
                ? ` (${graph.vault.kinship_system})`
                : ""}
              .
            </p>
          </div>
          {graph.persons.length > 0 && (
            <label className="text-sm text-[#6B5B3D]">
              Viewpoint
              <select
                value={viewpoint}
                onChange={(e) => setViewpoint(e.target.value)}
                className="ml-2 rounded-lg border border-[#E8D9C0] bg-white px-3 py-2"
              >
                {graph.persons.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <main className="w-full h-[80vh] bg-white rounded-xl p-4 shadow border">
          {loading ? (
            <p>Loading…</p>
          ) : (
            <FamilyTreeCanvas
              persons={graph.persons}
              relationships={graph.relationships}
            />
          )}
        </main>
      </div>
    </Sidebar>
  );
}
