"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
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
  ConnectionLineType,
} from "reactflow";
import "reactflow/dist/style.css";
import { Handle, Position } from "reactflow";
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

/**
 * MemberNode - custom node renderer
 * - Small centered handles for sleek style
 */
function MemberNode({ id, data, selected }: NodeProps<Member>) {
  return (
    <div className="select-none w-[240px] bg-white rounded-xl shadow-md border border-neutral-200 p-4 relative">
      {/* Top handle (incoming) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-[#c89532]"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          zIndex: 10,
          transform: "translateX(-50%)",
          left: "50%",
        }}
      />
      {/* Bottom handle (outgoing) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-[#c89532]"
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          zIndex: 10,
          transform: "translateX(-50%)",
          left: "50%",
        }}
      />

      <div className="text-lg font-semibold text-[#7a6321]">{data.name}</div>
      <div className="text-sm text-neutral-600 mt-1">{data.relationship}</div>
      <div className="text-xs text-neutral-400 mt-2">
        {data.birth_year ?? ""} {data.death_year ? `— ${data.death_year}` : ""}
      </div>

      {selected && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            boxShadow: "inset 0 0 0 2px rgba(165,128,55,0.08)",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

/**
 * UnionNode - invisible anchor node used to connect two parents to their children
 * Option A: fully invisible visually, but contains handles for edges.
 */
function UnionNode() {
  // Render visually invisible element; handles exist for edge attachment.
  // Keep handles small and centered.
  return (
    <div style={{ width: 2, height: 2, opacity: 0 }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "transparent",
          border: "none",
          zIndex: 10,
          transform: "translateX(-50%)",
          left: "50%",
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "transparent",
          border: "none",
          zIndex: 10,
          transform: "translateX(-50%)",
          left: "50%",
        }}
      />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  memberNode: MemberNode,
  unionNode: UnionNode,
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

/**
 * FamilyTreeCanvas
 * - displays nodes from members
 * - allows connecting nodes (frontend-only)
 * - supports selecting nodes/edges and pressing Delete/Backspace to remove them
 * - automatically converts two parents connected to same child into a union node (Option D)
 */
function FamilyTreeCanvas({ members }: { members: Member[] }) {
  const reactFlowWrapperRef = useRef<HTMLDivElement | null>(null);

  // create initial nodes from members (positions are simple — you can layout later)
  const initialNodes: Node[] = useMemo(
    () =>
      members.map((m, i) => ({
        id: String(m.id),
        type: "memberNode",
        data: m,
        position: { x: 50 + (i % 3) * 260, y: Math.floor(i / 3) * 160 }, // spread a bit
      })),
    [members]
  );

  const defaultEdgeOptions = {
    type: "smoothstep" as const,
    animated: false,
    style: {
      stroke: "#b58b2b",
      strokeWidth: 2,
    },
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge[]>([]);

  // helper: find node by id
  const findNode = useCallback(
    (id: string) => nodes.find((n) => n.id === id),
    [nodes]
  );

  // helper: generate a unique id
  const makeId = useCallback((prefix = "") => {
    return `${prefix}${Date.now().toString(36)}-${Math.floor(
      Math.random() * 1000
    )}`;
  }, []);

  // create a union node positioned between two parents
  const createUnionBetween = useCallback(
    (parentAId: string, parentBId: string) => {
      const parentA = findNode(parentAId);
      const parentB = findNode(parentBId);
      // fallback position if missing
      const ax = parentA?.position?.x ?? 100;
      const ay = parentA?.position?.y ?? 100;
      const bx = parentB?.position?.x ?? ax + 160;
      const by = parentB?.position?.y ?? ay;

      const ux = (ax + bx) / 2;
      const uy = (ay + by) / 2 + 60; // push union slightly below parents

      const unionId = makeId("union-");
      const unionNode: Node = {
        id: unionId,
        type: "unionNode",
        position: { x: ux, y: uy },
        data: {},
      };

      setNodes((nds) => [...nds, unionNode]);
      return unionId;
    },
    [findNode, makeId, setNodes]
  );

  // onConnect: detect case where two parents end up connecting to same child -> create/merge union
  const onConnect = useCallback(
    (params: Connection) => {
      const { source, target } = params;
      if (!source || !target) return;

      // if connecting a node to itself, ignore
      if (source === target) return;

      const sourceNode = findNode(source);
      const targetNode = findNode(target);
      if (!sourceNode || !targetNode) return;

      // Only apply union logic when connecting memberNode -> memberNode (parent -> child)
      if (
        sourceNode.type === "memberNode" &&
        targetNode.type === "memberNode"
      ) {
        // find existing incoming edges to the child (target)
        const incomingToChild = edges.filter((e) => e.target === target);

        // CASE 1: child has no parents yet -> simple edge
        if (incomingToChild.length === 0) {
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
          );
          return;
        }

        // CASE 2: child already has one parent (direct parent edge)
        // determine if existing parent is a union or a member
        const existing = incomingToChild[0];
        const existingSourceNode = findNode(existing.source);

        // If existing source is a union node, just add new parent -> union
        if (existingSourceNode && existingSourceNode.type === "unionNode") {
          // attach source -> existingUnion
          setEdges((eds) =>
            addEdge(
              {
                id: makeId("edge-"),
                source,
                target: existingSourceNode.id,
                type: "smoothstep",
                style: { stroke: "#b58b2b", strokeWidth: 2 },
              },
              eds
            )
          );
          return;
        }

        // existing source is a member (parent A). We need to create a union and rewire.
        // Remove the existing edge parentA -> child
        setEdges((eds) => eds.filter((e) => !(e.source === existing.source && e.target === target)));

        // create union between existing.source and new source
        const unionId = createUnionBetween(existing.source, source);

        // add edges: parentA -> union, parentB -> union, union -> child
        setEdges((eds) =>
          eds
            .concat([
              {
                id: makeId("edge-"),
                source: existing.source,
                target: unionId,
                type: "smoothstep",
                style: { stroke: "#b58b2b", strokeWidth: 2 },
              },
              {
                id: makeId("edge-"),
                source: source,
                target: unionId,
                type: "smoothstep",
                style: { stroke: "#b58b2b", strokeWidth: 2 },
              },
              {
                id: makeId("edge-"),
                source: unionId,
                target: target,
                type: "smoothstep",
                style: { stroke: "#b58b2b", strokeWidth: 2 },
              },
            ])
        );

        return;
      }

      // fallback: any other kind of connect, just add edge
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
      );
    },
    [edges, findNode, setEdges, createUnionBetween, makeId]
  );

  // delete selected nodes & edges via keyboard
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;

      setNodes((nds) => nds.filter((n) => !n.selected));
      setEdges((eds) => eds.filter((e) => !e.selected));
    },
    [setNodes, setEdges]
  );

  // attach keydown listener when component mounts and remove on unmount
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  // convenience: allow deleting a single node programmatically (frontend-only)
  const deleteNodeById = useCallback(
    (id: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    },
    [setNodes, setEdges]
  );

  // Pass delete callback into nodes' data (optional future use) — run once
  useEffect(() => {
    setNodes((cur) =>
      cur.map((n) => ({
        ...n,
        data: {
          ...(n.data ?? {}),
          // @ts-ignore - adding delete callback to node data for convenience
          onDelete: deleteNodeById,
        },
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ReactFlowProvider>
      <div
        ref={reactFlowWrapperRef}
        className="w-full h-full"
        style={{ width: "100%", height: "100%" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          defaultEdgeOptions={defaultEdgeOptions}
          connectionLineStyle={{ stroke: "#b58b2b", strokeWidth: 2 }}
          connectionLineType={ConnectionLineType.SmoothStep}
          style={{ background: "transparent" }}
        >
          <MiniMap nodeStrokeColor="#7a6321" nodeColor="#fff" />
          <Controls />
          <Background gap={16} size={1} />
        </ReactFlow>
      </div>
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
    try {
      const data = await fetchFamily();
      setMembers(data);
    } catch (e: any) {
      // keep it quiet; show no members if fetch fails
      console.error("Failed to fetch family:", e);
      setMembers([]);
    } finally {
      setLoading(false);
    }
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
            <p className="text-xs text-neutral-500 mt-1">
              Tip: drag from the bottom handle of one card to the top handle of
              another to create a connection. If two parents are connected to
              the same child, the app will group them automatically. Select an
              edge/node and press Delete to remove it (frontend-only).
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
            <div style={{ width: "100%", height: "100%" }}>
              <FamilyTreeCanvas members={members} />
            </div>
          )}
        </main>

        <AddMemberModal
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onCreated={async () => {
            await load();
          }}
        />
      </div>
    </Sidebar>
  );
}
