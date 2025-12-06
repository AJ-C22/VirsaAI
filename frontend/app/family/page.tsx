"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  NodeTypes,
  NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { Handle, Position } from "reactflow";
import { ConnectionLineType } from "reactflow";
import Sidebar from "../components/DashboardLayout";

/* =========================================================
   ===================== TYPES =============================
   ========================================================= */

export type Member = {
  id: number;
  name: string;
  relationship?: string | null;
  story_id?: number | null;
  birth_year?: number | null;
  death_year?: number | null;
  notes?: string | null;
};

/* =========================================================
   ===================== API CALLS =========================
   ========================================================= */

const API_ROOT = process.env.NEXT_PUBLIC_API_ROOT ?? "http://localhost:8000";

async function fetchFamily(): Promise<Member[]> {
  const res = await fetch(`${API_ROOT}/family`);
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.members)) return json.members;
  return [];
}

async function createMember(payload: {
  name: string;
  relationship?: string;
  birth_year?: number | null;
}): Promise<{ id: number }> {
  const res = await fetch(`${API_ROOT}/family/member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* =========================================================
   ===================== CUSTOM NODE ========================
   ========================================================= */

function MemberNode({ data }: NodeProps<Member>) {
  return (
    <div className="select-none w-[240px] bg-white rounded-xl shadow-md border border-neutral-200 p-4 relative">
      {/* Connectable Handles */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#c89532]"
        style={{ zIndex: 10 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#c89532]"
        style={{ zIndex: 10 }}
      />

      <div className="text-lg font-semibold text-[#7a6321]">{data.name}</div>
      <div className="text-sm text-neutral-600 mt-1">{data.relationship}</div>
      <div className="text-xs text-neutral-400 mt-2">
        {data.birth_year ?? ""} {data.death_year ? `— ${data.death_year}` : ""}
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memberNode: MemberNode,
};

/* =========================================================
   ==================== ADD MEMBER MODAL ====================
   ========================================================= */

function AddMemberModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [birthYear, setBirthYear] = useState<number | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const save = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await createMember({
        name,
        relationship,
        birth_year: birthYear === "" ? null : Number(birthYear),
      });
      onCreated(result.id);
      onClose();
      setName("");
      setRelationship("");
      setBirthYear("");
    } catch (e: any) {
      setError(String(e.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative z-10 w-[480px] bg-white rounded-xl p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-[#7a6321] mb-3">
          Add Family Member
        </h2>

        <label className="text-sm text-neutral-700">Name</label>
        <input
          className="w-full p-2 border rounded-md mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="text-sm text-neutral-700 mt-3">Relationship</label>
        <input
          className="w-full p-2 border rounded-md mt-1"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="parent, sibling, child..."
        />

        <label className="text-sm text-neutral-700 mt-3">Birth Year</label>
        <input
          className="w-full p-2 border rounded-md mt-1"
          value={birthYear}
          type="number"
          onChange={(e) =>
            setBirthYear(e.target.value === "" ? "" : Number(e.target.value))
          }
        />

        {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}

        <div className="mt-4 flex justify-end gap-3">
          <button
            className="px-4 py-2 border rounded-md"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={loading || name.trim() === ""}
            className="px-4 py-2 bg-[#d9a441] hover:bg-[#c89532] text-white rounded-md"
          >
            {loading ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ===================== MAIN CANVAS ========================
   ========================================================= */

function FamilyTreeCanvas({ members }: { members: Member[] }) {
  const initialNodes: Node[] = useMemo(
    () =>
      members.map((m, i) => ({
        id: String(m.id),
        type: "memberNode",
        data: m,
        position: { x: 50, y: i * 140 },
      })),
    [members]
  );

  const edgeOptions = {
    type: "smoothstep" as const,
    animated: false,
    style: {
      stroke: "#b58b2b",
      strokeWidth: 2.2,
    },
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "smoothstep",
            animated: false,
            style: { stroke: "#b58b2b", strokeWidth: 2 },
          },
          eds
        )
      ),
    []
  );

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={edgeOptions}
        connectionLineStyle={{ stroke: "#b58b2b", strokeWidth: 2 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        style={{ background: "transparent" }}
      >
        <MiniMap nodeStrokeColor="#7a6321" nodeColor="#fff" />
        <Controls />
        <Background gap={16} size={1} />
      </ReactFlow>
    </ReactFlowProvider>
  );
}

/* =========================================================
   ===================== FULL PAGE ==========================
   ========================================================= */

export default function Page() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchFamily();
    setMembers(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Sidebar>
      <div className="w-full h-screen p-8 bg-[#faf6ea]">
        <header className="flex justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-[#7a6321]">Family Tree</h1>
            <p className="text-neutral-600">
              Automatically builds as your stories grow.
            </p>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="px-4 py-2 bg-[#d9a441] hover:bg-[#c89532] text-white rounded-md shadow"
          >
            + Add Member
          </button>
        </header>

        <main className="w-full h-[80vh] bg-white rounded-xl p-4 shadow border">
          {loading ? (
            <p className="text-neutral-500">Loading...</p>
          ) : members.length === 0 ? (
            <p className="text-neutral-500">No family members yet.</p>
          ) : (
            <FamilyTreeCanvas members={members} />
          )}
        </main>

        <AddMemberModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onCreated={() => load()}
        />
      </div>
    </Sidebar>
  );
}
