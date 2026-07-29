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
import { useAuth } from "../lib/auth";
import { RequireAuth } from "../components/RequireAuth";

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

async function fetchFamilyGraph(
  apiRoot: string,
  viewpoint?: string,
  vaultId?: string | null
): Promise<FamilyGraph> {
  const params = new URLSearchParams();
  if (viewpoint) params.set("viewpoint", viewpoint);
  if (vaultId) params.set("vault_id", vaultId);
  const qs = params.toString();
  const url = `${apiRoot}/family${qs ? `?${qs}` : ""}`;
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
  apiRoot: string,
  fromPersonId: string,
  toPersonId: string,
  type = "relative"
): Promise<string | null> {
  const res = await fetch(`${apiRoot}/family/relationship`, {
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

async function removeRelationship(apiRoot: string, relationshipId: string) {
  await fetch(`${apiRoot}/family/relationship/${relationshipId}`, {
    method: "DELETE",
  });
}

function MemberNode({ data, selected }: NodeProps<Person>) {
  return (
    <div
      className={`select-none w-[220px] bg-white rounded-2xl border p-4 relative transition ${
        selected ? "border-brass shadow-md" : "border-line shadow-sm"
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "#0d6b5c",
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
          background: "#0d6b5c",
          borderRadius: "50%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />
      <div className="font-display text-xl text-ink leading-tight">{data.name}</div>
      <div className="text-sm text-brass-deep mt-1.5 font-medium">
        {data.kinship_label || data.relationship}
      </div>
      <div className="text-xs text-ink-soft mt-2 tabular-nums">
        {data.birth_year ?? ""}
        {data.death_year ? ` — ${data.death_year}` : ""}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memberNode: MemberNode,
};

function FamilyTreeCanvas({
  persons,
  relationships,
  apiRoot,
}: {
  persons: Person[];
  relationships: Relationship[];
  apiRoot: string;
}) {
  const initialNodes: Node[] = useMemo(
    () =>
      persons.map((p, i) => ({
        id: String(p.id),
        type: "memberNode",
        data: p,
        position: {
          x: 80 + (i % 3) * 280,
          y: Math.floor(i / 3) * 190,
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
        style: { stroke: "#0d6b5c", strokeWidth: 1.5 },
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
      const id = await persistRelationship(
        apiRoot,
        params.source,
        params.target,
        "relative"
      );
      if (!id) return;
      setEdges((eds) => [
        ...eds,
        {
          id,
          source: params.source!,
          target: params.target!,
          label: "relative",
          type: "straight",
          style: { stroke: "#0d6b5c", strokeWidth: 1.5 },
        },
      ]);
    },
    [apiRoot, setEdges]
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const selectedEdges = edges.filter((edge) => edge.selected);
      for (const edge of selectedEdges) {
        void removeRelationship(apiRoot, edge.id);
      }
      setEdges((eds) => eds.filter((edge) => !edge.selected));
      setNodes((nds) => nds.filter((n) => !n.selected));
    },
    [apiRoot, edges, setEdges, setNodes]
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
        fitViewOptions={{ padding: 0.35 }}
        connectionLineType={ConnectionLineType.Straight}
        style={{ background: "transparent" }}
      >
        <MiniMap
          maskColor="rgba(12,17,16,0.08)"
          nodeColor="#0d6b5c"
          style={{ borderRadius: 12 }}
        />
        <Controls />
        <Background gap={20} size={1} color="#cfd8d4" />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

export default function Page() {
  const { apiRoot, vaultId } = useAuth();
  const [graph, setGraph] = useState<FamilyGraph>({
    persons: [],
    relationships: [],
  });
  const [viewpoint, setViewpoint] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFamilyGraph(apiRoot, viewpoint || undefined, vaultId)
      .then((g) => {
        setGraph(g);
        if (!viewpoint && g.viewpoint_person_id) {
          setViewpoint(g.viewpoint_person_id);
        }
      })
      .catch(() => setGraph({ persons: [], relationships: [] }))
      .finally(() => setLoading(false));
  }, [apiRoot, vaultId, viewpoint]);

  return (
    <RequireAuth>
    <Sidebar>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="label-eyebrow mb-2">Connections</p>
          <h1 className="font-display text-4xl text-ink">Family tree</h1>
          <p className="text-ink-soft mt-2 max-w-xl">
            Culturally aware kinship
            {graph.vault?.kinship_system
              ? ` · ${graph.vault.kinship_system}`
              : ""}
            . Drag to rearrange; connect people to add relationships.
          </p>
        </div>
        {graph.persons.length > 0 && (
          <label className="text-sm text-ink-soft">
            Viewpoint
            <select
              value={viewpoint}
              onChange={(e) => setViewpoint(e.target.value)}
              className="field ml-2 !w-auto !inline-block !py-2"
            >
              {graph.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="w-full h-[min(80vh,720px)] rounded-3xl border border-line bg-white overflow-hidden">
        {loading ? (
          <p className="p-8 text-ink-soft">Loading tree…</p>
        ) : graph.persons.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <p className="text-ink-soft mb-4">
              People appear here after you archive a story.
            </p>
            <a href="/record" className="btn-primary">
              Record a story
            </a>
          </div>
        ) : (
          <FamilyTreeCanvas
            persons={graph.persons}
            relationships={graph.relationships}
            apiRoot={apiRoot}
          />
        )}
      </div>
    </Sidebar>
    </RequireAuth>
  );
}
