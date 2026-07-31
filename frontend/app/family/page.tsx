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
  useReactFlow,
  Node,
  Edge,
  Connection,
  NodeTypes,
  NodeProps,
  ConnectionLineType,
  ConnectionMode,
  Handle,
  Position,
  OnSelectionChangeParams,
} from "reactflow";
import "reactflow/dist/style.css";
import { Plus, Trash2, X } from "lucide-react";
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

const REL_TYPES = [
  { value: "parent", label: "Parent of →" },
  { value: "child", label: "Child of →" },
  { value: "spouse", label: "Spouse / partner" },
  { value: "sibling", label: "Sibling" },
];

const EDIT_REL_TYPES = [
  ...REL_TYPES,
  { value: "relative", label: "Unattached (remove link)" },
];

async function fetchFamilyGraph(
  apiRoot: string,
  viewpoint?: string,
  vaultId?: string | null
): Promise<FamilyGraph> {
  const params = new URLSearchParams();
  if (viewpoint) params.set("viewpoint", viewpoint);
  if (vaultId) params.set("vault_id", vaultId);
  const qs = params.toString();
  const res = await fetch(`${apiRoot}/family${qs ? `?${qs}` : ""}`);
  if (!res.ok) {
    throw new Error(`Family API error (${res.status})`);
  }
  const json = await res.json();
  const relationships = (json.relationships ?? []).filter(
    (r: Relationship) =>
      r.type === "parent" || r.type === "spouse" || r.type === "sibling"
  );
  return {
    persons: json.persons ?? json.members ?? [],
    relationships,
    vault: json.vault,
    viewpoint_person_id: json.viewpoint_person_id,
  };
}

const HANDLE_STYLE: React.CSSProperties = {
  width: 10,
  height: 10,
  background: "#0d6b5c",
  border: "2px solid #fff",
  borderRadius: "50%",
};

function handlesForRelType(type: string): {
  sourceHandle: string;
  targetHandle: string;
} {
  if (type === "spouse") {
    return { sourceHandle: "r-source", targetHandle: "l-target" };
  }
  // parent → vertical straight line
  return { sourceHandle: "b-source", targetHandle: "t-target" };
}

const NODE_W = 220;
const COL_W = 260;
const ROW_H = 200;

function orderWithSpouses(
  ids: string[],
  spousesOf: Map<string, string[]>
): string[] {
  const remaining = new Set(ids);
  const out: string[] = [];
  for (const id of ids) {
    if (!remaining.has(id)) continue;
    out.push(id);
    remaining.delete(id);
    for (const s of spousesOf.get(id) || []) {
      if (!remaining.has(s)) continue;
      out.push(s);
      remaining.delete(s);
    }
  }
  return out;
}

/** Top-down pedigree: parents above children, spouses side-by-side, unattached to the right. */
function layoutPedigree(
  persons: Person[],
  relationships: Relationship[],
  viewpointId?: string
): Map<string, { x: number; y: number }> {
  const ids = persons.map((p) => String(p.id));
  const idSet = new Set(ids);

  const parentsOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const r of relationships) {
    const frm = String(r.from_person_id);
    const to = String(r.to_person_id);
    if (!idSet.has(frm) || !idSet.has(to)) continue;
    if (r.type === "parent") {
      parentsOf.set(to, [...(parentsOf.get(to) || []), frm]);
    } else if (r.type === "spouse") {
      spousesOf.set(frm, [...(spousesOf.get(frm) || []), to]);
      spousesOf.set(to, [...(spousesOf.get(to) || []), frm]);
    }
  }

  const attached = new Set<string>();
  for (const r of relationships) {
    if (r.type !== "parent" && r.type !== "spouse") continue;
    attached.add(String(r.from_person_id));
    attached.add(String(r.to_person_id));
  }

  const linked = ids.filter((id) => attached.has(id));
  const unattached = ids.filter((id) => !attached.has(id));

  const gen = new Map<string, number>();
  for (const id of linked) {
    const pars = (parentsOf.get(id) || []).filter((p) => attached.has(p));
    if (pars.length === 0) gen.set(id, 0);
  }
  if (linked.length && gen.size === 0) {
    linked.forEach((id) => gen.set(id, 0));
  }

  let guard = 0;
  let changed = true;
  while (changed && guard < linked.length + 5) {
    changed = false;
    guard += 1;
    for (const id of linked) {
      const pars = (parentsOf.get(id) || []).filter((p) => gen.has(p));
      if (!pars.length) continue;
      const next = Math.max(...pars.map((p) => gen.get(p)!)) + 1;
      if (!gen.has(id) || gen.get(id)! < next) {
        gen.set(id, next);
        changed = true;
      }
    }
    for (const id of linked) {
      if (!gen.has(id)) continue;
      for (const s of spousesOf.get(id) || []) {
        if (!attached.has(s)) continue;
        const g = gen.get(id)!;
        if (!gen.has(s) || gen.get(s)! < g) {
          gen.set(s, g);
          changed = true;
        } else if (gen.get(id)! < gen.get(s)!) {
          gen.set(id, gen.get(s)!);
          changed = true;
        }
      }
    }
  }
  for (const id of linked) {
    if (!gen.has(id)) gen.set(id, 0);
  }

  const byGen = new Map<number, string[]>();
  for (const id of linked) {
    const g = gen.get(id) || 0;
    byGen.set(g, [...(byGen.get(g) || []), id]);
  }
  const maxGen = Math.max(0, ...Array.from(byGen.keys()), 0);

  const orderInGen = new Map<number, string[]>();
  let roots = byGen.get(0) || [];
  if (viewpointId && roots.includes(viewpointId)) {
    roots = [viewpointId, ...roots.filter((id) => id !== viewpointId)];
  }
  orderInGen.set(0, orderWithSpouses(roots, spousesOf));

  for (let g = 1; g <= maxGen; g++) {
    const prev = orderInGen.get(g - 1) || [];
    const indexOf = new Map(prev.map((id, i) => [id, i]));
    const members = [...(byGen.get(g) || [])];
    members.sort((a, b) => {
      const avg = (id: string) => {
        const pars = (parentsOf.get(id) || []).filter((p) => indexOf.has(p));
        if (!pars.length) return 999;
        return pars.reduce((s, p) => s + (indexOf.get(p) || 0), 0) / pars.length;
      };
      return avg(a) - avg(b);
    });
    orderInGen.set(g, orderWithSpouses(members, spousesOf));
  }

  const positions = new Map<string, { x: number; y: number }>();
  let widest = 1;
  for (let g = 0; g <= maxGen; g++) {
    const order = orderInGen.get(g) || [];
    widest = Math.max(widest, order.length);
    const y = 48 + g * ROW_H;
    order.forEach((id, i) => {
      positions.set(id, { x: 48 + i * COL_W, y });
    });
  }

  // Unknown / unlinked people sit to the right of the pedigree
  const sideX = 48 + widest * COL_W + 80;
  unattached.forEach((id, i) => {
    positions.set(id, { x: sideX, y: 48 + i * (ROW_H - 40) });
  });

  return positions;
}

function MemberNode({ data, selected }: NodeProps<Person>) {
  return (
    <div
      className={`select-none w-[220px] bg-white rounded-2xl border p-4 relative transition ${
        selected ? "border-brass shadow-md" : "border-line shadow-sm"
      }`}
    >
      {/* Top — parents / ancestors */}
      <Handle
        type="target"
        position={Position.Top}
        id="t-target"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Top}
        id="t-source"
        style={HANDLE_STYLE}
      />
      {/* Bottom — children / descendants */}
      <Handle
        type="target"
        position={Position.Bottom}
        id="b-target"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="b-source"
        style={HANDLE_STYLE}
      />
      {/* Left / right — siblings, spouses, peers */}
      <Handle
        type="target"
        position={Position.Left}
        id="l-target"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="l-source"
        style={HANDLE_STYLE}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="r-target"
        style={HANDLE_STYLE}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="r-source"
        style={HANDLE_STYLE}
      />
      <div className="font-display text-xl text-ink leading-tight">{data.name}</div>
      <div className="text-sm text-brass-deep mt-1.5 font-medium">
        {data.kinship_label || data.relationship || "—"}
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
  vaultId,
  viewpointId,
  onRefresh,
  onSelectPerson,
  onSelectEdge,
  clearSelectionKey = 0,
}: {
  persons: Person[];
  relationships: Relationship[];
  apiRoot: string;
  vaultId: string | null;
  viewpointId?: string;
  onRefresh: () => void;
  onSelectPerson: (p: Person | null) => void;
  onSelectEdge: (e: Relationship | null) => void;
  clearSelectionKey?: number;
}) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvasInner
        persons={persons}
        relationships={relationships}
        apiRoot={apiRoot}
        vaultId={vaultId}
        viewpointId={viewpointId}
        onRefresh={onRefresh}
        onSelectPerson={onSelectPerson}
        onSelectEdge={onSelectEdge}
        clearSelectionKey={clearSelectionKey}
      />
    </ReactFlowProvider>
  );
}

function FamilyTreeCanvasInner({
  persons,
  relationships,
  apiRoot,
  vaultId,
  viewpointId,
  onRefresh,
  onSelectPerson,
  onSelectEdge,
  clearSelectionKey = 0,
}: {
  persons: Person[];
  relationships: Relationship[];
  apiRoot: string;
  vaultId: string | null;
  viewpointId?: string;
  onRefresh: () => void;
  onSelectPerson: (p: Person | null) => void;
  onSelectEdge: (e: Relationship | null) => void;
  clearSelectionKey?: number;
}) {
  const { fitView } = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pendingLink, setPendingLink] = useState<Connection | null>(null);
  const [linkType, setLinkType] = useState("parent");
  const ignoreSelectionRef = useRef(false);

  const initialNodes: Node[] = useMemo(() => {
    const positions = layoutPedigree(persons, relationships, viewpointId);
    return persons.map((p) => ({
      id: String(p.id),
      type: "memberNode",
      data: p,
      position: positions.get(String(p.id)) || { x: 48, y: 48 },
    }));
  }, [persons, relationships, viewpointId]);

  const initialEdges: Edge[] = useMemo(
    () =>
      relationships
        .filter((r) => r.type === "parent" || r.type === "spouse")
        .map((r) => {
          const { sourceHandle, targetHandle } = handlesForRelType(r.type);
          return {
            id: r.id,
            source: r.from_person_id,
            target: r.to_person_id,
            sourceHandle,
            targetHandle,
            label: r.type === "spouse" ? "spouse" : "",
            type: "straight",
            style: { stroke: "#0d6b5c", strokeWidth: 1.75 },
            selectable: true,
          };
        }),
    [relationships]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Parent asked to leave edit mode (X / Add person) — clear RF selection too
  useEffect(() => {
    if (!clearSelectionKey) return;
    ignoreSelectionRef.current = true;
    setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
    setEdges((eds) => eds.map((e) => ({ ...e, selected: false })));
    const t = window.setTimeout(() => {
      ignoreSelectionRef.current = false;
    }, 100);
    return () => window.clearTimeout(t);
  }, [clearSelectionKey, setNodes, setEdges]);

  useEffect(() => {
    // Re-apply pedigree layout whenever graph data changes
    setNodes(initialNodes.map((n) => ({ ...n, selected: false })));
    setEdges(initialEdges.map((e) => ({ ...e, selected: false })));
    const t = window.setTimeout(() => {
      fitView({ padding: 0.28, duration: 220 });
    }, 60);
    return () => window.clearTimeout(t);
  }, [initialNodes, initialEdges, setNodes, setEdges, fitView]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      fitView({ padding: 0.3, duration: 150 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitView]);

  const onConnect = useCallback((params: Connection) => {
    if (!params.source || !params.target) return;
    setPendingLink(params);
    setLinkType("parent");
  }, []);

  const confirmLink = async () => {
    if (!pendingLink?.source || !pendingLink?.target) return;
    const res = await fetch(`${apiRoot}/family/relationship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        from_person_id: pendingLink.source,
        to_person_id: pendingLink.target,
        type: linkType,
        vault_id: vaultId,
        certainty: 1.0,
      }),
    });
    setPendingLink(null);
    if (res.ok) onRefresh();
  };

  const onSelectionChange = useCallback(
    ({ nodes: ns, edges: es }: OnSelectionChangeParams) => {
      if (ignoreSelectionRef.current) return;
      if (ns.length === 1) {
        const person = persons.find((p) => p.id === ns[0].id) || null;
        onSelectPerson(person);
        onSelectEdge(null);
      } else if (es.length === 1) {
        const rel = relationships.find((r) => r.id === es[0].id) || null;
        onSelectEdge(rel);
        onSelectPerson(null);
      } else {
        onSelectPerson(null);
        onSelectEdge(null);
      }
    },
    [persons, relationships, onSelectPerson, onSelectEdge]
  );

  const onPaneClick = useCallback(() => {
    onSelectPerson(null);
    onSelectEdge(null);
  }, [onSelectPerson, onSelectEdge]);

  const onKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const selectedEdges = edges.filter((edge) => edge.selected);
      const selectedNodes = nodes.filter((n) => n.selected);

      for (const edge of selectedEdges) {
        await fetch(`${apiRoot}/family/relationship/${edge.id}`, {
          method: "DELETE",
        });
      }
      for (const node of selectedNodes) {
        await fetch(`${apiRoot}/family/member/${node.id}`, {
          method: "DELETE",
        });
      }
      if (selectedEdges.length || selectedNodes.length) onRefresh();
    },
    [apiRoot, edges, nodes, onRefresh]
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return (
    <div ref={containerRef} className="relative w-full h-full min-h-[400px]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.Straight}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <MiniMap
          maskColor="rgba(12,17,16,0.08)"
          nodeColor="#0d6b5c"
          style={{ borderRadius: 12 }}
        />
        <Controls />
        <Background gap={20} size={1} color="#cfd8d4" />
      </ReactFlow>

      {pendingLink && (
        <div className="absolute inset-0 z-20 bg-ink/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-line p-6 w-full max-w-sm shadow-lg">
            <h3 className="font-display text-2xl text-ink mb-2">
              Link relationship
            </h3>
            <p className="text-sm text-ink-soft mb-4">
              Drag direction: source → target. Pick how they are related.
            </p>
            <select
              className="field mb-4"
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
            >
              {REL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary flex-1"
                onClick={() => void confirmLink()}
              >
                Save link
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setPendingLink(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const { apiRoot, vaultId, loading: authLoading } = useAuth();
  const [graph, setGraph] = useState<FamilyGraph>({
    persons: [],
    relationships: [],
  });
  const [viewpoint, setViewpoint] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Person | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<Relationship | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchSeq = useRef(0);
  const [clearSelectionKey, setClearSelectionKey] = useState(0);

  const clearCanvasSelection = useCallback(() => {
    setClearSelectionKey((k) => k + 1);
  }, []);

  const closeSidePanel = useCallback(() => {
    setShowAdd(false);
    setSelected(null);
    setSelectedEdge(null);
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const openAddPerson = useCallback(() => {
    setSelected(null);
    setSelectedEdge(null);
    setShowAdd(true);
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const [editName, setEditName] = useState("");
  const [editBirth, setEditBirth] = useState("");
  const [editDeath, setEditDeath] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [edgeType, setEdgeType] = useState("relative");

  const [newName, setNewName] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [newRelTo, setNewRelTo] = useState("");
  const [newRelType, setNewRelType] = useState("parent");
  const [linkToId, setLinkToId] = useState("");
  const [linkType, setLinkType] = useState("parent");

  const reload = useCallback(
    async (opts?: { soft?: boolean; viewpointOverride?: string }) => {
      if (authLoading || !vaultId) return;
      const seq = ++fetchSeq.current;
      if (!opts?.soft) setLoading(true);
      const vp =
        opts?.viewpointOverride !== undefined
          ? opts.viewpointOverride
          : viewpoint;
      try {
        const g = await fetchFamilyGraph(
          apiRoot,
          vp || undefined,
          vaultId
        );
        if (seq !== fetchSeq.current) return;
        setGraph(g);
        setError(null);
        const ids = new Set(g.persons.map((p) => p.id));
        setViewpoint((prev) => {
          if (prev && ids.has(prev)) return prev;
          return g.viewpoint_person_id || g.persons[0]?.id || "";
        });
      } catch {
        if (seq !== fetchSeq.current) return;
        setError(
          "Could not load the family tree. Check that the API is running."
        );
      } finally {
        if (seq === fetchSeq.current) setLoading(false);
      }
    },
    [apiRoot, vaultId, viewpoint, authLoading]
  );

  // Load when vault is ready — do not re-run on every viewpoint tweak
  useEffect(() => {
    if (authLoading) return;
    if (!vaultId) {
      setLoading(false);
      setError("No vault selected. Sign out and sign in again.");
      return;
    }
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vault/auth only
  }, [apiRoot, vaultId, authLoading]);

  // Soft refresh when user picks a different viewpoint
  const viewpointBootstrapped = useRef(false);
  useEffect(() => {
    viewpointBootstrapped.current = false;
  }, [vaultId]);
  useEffect(() => {
    if (!viewpoint || authLoading || !vaultId) return;
    if (!viewpointBootstrapped.current) {
      viewpointBootstrapped.current = true;
      return;
    }
    void reload({ soft: true, viewpointOverride: viewpoint });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewpoint]);

  useEffect(() => {
    if (selected) {
      setEditName(selected.name || "");
      setEditBirth(
        selected.birth_year != null ? String(selected.birth_year) : ""
      );
      setEditDeath(
        selected.death_year != null ? String(selected.death_year) : ""
      );
      setEditNotes(selected.notes || "");
    }
  }, [selected]);

  useEffect(() => {
    if (selectedEdge) setEdgeType(selectedEdge.type || "parent");
  }, [selectedEdge]);

  useEffect(() => {
    setLinkToId("");
    setLinkType("parent");
  }, [selected?.id]);

  const softReload = () => reload({ soft: true });

  const selectedLinks = useMemo(() => {
    if (!selected) return [];
    return graph.relationships
      .filter(
        (r) =>
          r.from_person_id === selected.id || r.to_person_id === selected.id
      )
      .map((r) => {
        const otherId =
          r.from_person_id === selected.id
            ? r.to_person_id
            : r.from_person_id;
        const other = graph.persons.find((p) => p.id === otherId);
        let role = r.type;
        if (r.type === "parent") {
          role =
            r.from_person_id === selected.id
              ? "parent of"
              : "child of";
        } else if (r.type === "spouse") {
          role = "spouse of";
        } else if (r.type === "sibling") {
          role = "sibling of";
        }
        return { rel: r, other, role };
      });
  }, [selected, graph.relationships, graph.persons]);

  const changePersonLink = async (relId: string, nextType: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/family/relationship/${relId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: nextType }),
      });
      if (!res.ok) throw new Error("Could not update relationship");
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const removePersonLink = async (relId: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/family/relationship/${relId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove link");
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setBusy(false);
    }
  };

  const addPersonLink = async () => {
    if (!selected || !linkToId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/family/relationship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_person_id: selected.id,
          to_person_id: linkToId,
          type: linkType,
          vault_id: vaultId,
          certainty: 1.0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not add link"
        );
      }
      setLinkToId("");
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Link failed");
    } finally {
      setBusy(false);
    }
  };

  const savePerson = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/family/member/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          birth_year: editBirth ? Number(editBirth) : null,
          death_year: editDeath ? Number(editDeath) : null,
          notes: editNotes,
        }),
      });
      if (!res.ok) throw new Error("Could not save person");
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const deletePerson = async () => {
    if (!selected) return;
    if (!confirm(`Remove ${selected.name} from the tree?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`${apiRoot}/family/member/${selected.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not delete person");
      setSelected(null);
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const saveEdge = async () => {
    if (!selectedEdge) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${apiRoot}/family/relationship/${selectedEdge.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: edgeType }),
        }
      );
      if (!res.ok) throw new Error("Could not update relationship");
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  };

  const deleteEdge = async () => {
    if (!selectedEdge) return;
    setBusy(true);
    try {
      const res = await fetch(
        `${apiRoot}/family/relationship/${selectedEdge.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Could not remove link");
      setSelectedEdge(null);
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const addPerson = async () => {
    const name = newName.trim();
    if (!name) return;
    if (!vaultId) {
      setError("No vault selected. Sign out and sign in again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const birthYear = newBirth ? Number(newBirth) : undefined;
      const res = await fetch(`${apiRoot}/family/member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          birth_year: birthYear,
          vault_id: vaultId,
          related_to_person_id: newRelTo || undefined,
          relationship: newRelType,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not add person"
        );
      }
      const newId = typeof data.id === "string" ? data.id : null;
      // Optimistic: show the person immediately, then refresh from API
      if (newId) {
        const optimistic: Person = {
          id: newId,
          name,
          birth_year: birthYear ?? null,
          relationship: null,
          kinship_label: null,
        };
        setGraph((prev) => ({
          ...prev,
          persons: prev.persons.some((p) => p.id === newId)
            ? prev.persons
            : [...prev.persons, optimistic],
        }));
        if (!viewpoint) setViewpoint(newId);
      }
      setNewName("");
      setNewBirth("");
      setNewRelTo("");
      setNewRelType("relative");
      setShowAdd(true);
      setSelected(null);
      setSelectedEdge(null);
      softReload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Add failed");
    } finally {
      setBusy(false);
    }
  };

  const panelOpen = Boolean(selected || selectedEdge || showAdd);
  const showCanvas = graph.persons.length > 0;
  const showEmpty = !loading && !showCanvas && !showAdd;

  return (
    <RequireAuth>
      <Sidebar>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="label-eyebrow mb-2">Connections</p>
            <h1 className="font-display text-4xl text-ink">Family tree</h1>
            <p className="text-ink-soft mt-2 max-w-xl leading-relaxed">
              Top-down pedigree: parents above children, spouses beside each
              other
              {graph.vault?.kinship_system
                ? ` · ${graph.vault.kinship_system} kinship labels`
                : ""}
              . Unlinked people sit to the side until you connect them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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
            <button
              type="button"
              className="btn-primary"
              onClick={openAddPerson}
            >
              <Plus className="w-4 h-4" /> Add person
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-4 text-sm text-[#9b2c2c] rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-4 items-stretch min-h-[min(80vh,720px)]">
          <div
            className={`rounded-3xl border border-line bg-white overflow-hidden relative ${
              panelOpen ? "flex-1 min-w-0" : "w-full"
            }`}
            style={{ height: "min(80vh, 720px)" }}
          >
            {loading && (
              <p className="p-8 text-ink-soft absolute inset-0 z-10 bg-white/80">
                Loading tree…
              </p>
            )}
            {showEmpty && (
              <div className="h-full flex flex-col items-center justify-center text-center px-6">
                <p className="text-ink-soft mb-2">
                  No people in this vault yet.
                </p>
                <p className="text-sm text-ink-soft mb-4 max-w-sm">
                  Record a story (people are extracted automatically) or add
                  someone by hand.
                </p>
                <div className="flex gap-3">
                  <a href="/record" className="btn-ghost">
                    Record a story
                  </a>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={openAddPerson}
                  >
                    Add person
                  </button>
                </div>
              </div>
            )}
            {showCanvas && (
              <FamilyTreeCanvas
                persons={graph.persons}
                relationships={graph.relationships}
                apiRoot={apiRoot}
                vaultId={vaultId}
                viewpointId={viewpoint || undefined}
                onRefresh={softReload}
                clearSelectionKey={clearSelectionKey}
                onSelectPerson={(p) => {
                  setSelected(p);
                  if (p) {
                    setSelectedEdge(null);
                    setShowAdd(false);
                  }
                }}
                onSelectEdge={(e) => {
                  setSelectedEdge(e);
                  if (e) {
                    setSelected(null);
                    setShowAdd(false);
                  }
                }}
              />
            )}
            {!showCanvas && showAdd && (
              <div className="h-full flex items-center justify-center text-ink-soft text-sm px-6 text-center">
                Fill in the form on the right to add the first person.
              </div>
            )}
          </div>

          {panelOpen && (
            <aside className="w-full sm:w-[320px] shrink-0 rounded-3xl border border-line bg-white p-5 h-[min(80vh,720px)] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-2xl text-ink">
                  {showAdd
                    ? "Add person"
                    : selected
                      ? "Edit person"
                      : "Edit link"}
                </h2>
                <button
                  type="button"
                  className="p-1.5 rounded-lg text-ink-soft hover:bg-stone"
                  onClick={closeSidePanel}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {showAdd && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Name
                    </label>
                  <input
                    className="field"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addPerson();
                      }
                    }}
                    placeholder="Full name"
                    autoFocus
                  />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Birth year
                    </label>
                    <input
                      className="field"
                      value={newBirth}
                      onChange={(e) => setNewBirth(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Link to (optional)
                    </label>
                    <select
                      className="field"
                      value={newRelTo}
                      onChange={(e) => setNewRelTo(e.target.value)}
                    >
                      <option value="">No link yet</option>
                      {graph.persons.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {newRelTo && (
                    <div>
                      <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                        Relationship
                      </label>
                      <select
                        className="field"
                        value={newRelType}
                        onChange={(e) => setNewRelType(e.target.value)}
                      >
                        {REL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy || !newName.trim()}
                    onClick={() => void addPerson()}
                  >
                    {busy ? "Saving…" : "Add to tree"}
                  </button>
                  <p className="text-xs text-ink-soft">
                    Leave “Link to” empty if you’re unsure — they’ll stay on the
                    tree as an unattached relative. Multiple spouses are fine.
                  </p>
                </div>
              )}

              {selected && !showAdd && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Name
                    </label>
                    <input
                      className="field"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                        Birth
                      </label>
                      <input
                        className="field"
                        value={editBirth}
                        onChange={(e) => setEditBirth(e.target.value)}
                        placeholder="Year"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                        Death
                      </label>
                      <input
                        className="field"
                        value={editDeath}
                        onChange={(e) => setEditDeath(e.target.value)}
                        placeholder="Year"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Notes
                    </label>
                    <textarea
                      className="field resize-y min-h-[80px]"
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                  </div>
                  {selected.kinship_label && (
                    <p className="text-xs text-ink-soft">
                      From viewpoint:{" "}
                      <span className="font-medium text-brass-deep">
                        {selected.kinship_label}
                      </span>
                    </p>
                  )}

                  <div className="pt-2 border-t border-line space-y-2">
                    <p className="text-xs font-medium text-ink-soft uppercase tracking-wide">
                      Relationships
                    </p>
                    {selectedLinks.length === 0 ? (
                      <p className="text-xs text-ink-soft">
                        Unattached — add a link below, or leave as a relative.
                      </p>
                    ) : (
                      selectedLinks.map(({ rel, other, role }) => (
                        <div
                          key={rel.id}
                          className="rounded-xl border border-line p-2.5 space-y-2"
                        >
                          <p className="text-sm text-ink">
                            <span className="text-ink-soft">{role}</span>{" "}
                            <span className="font-medium">
                              {other?.name || "Unknown"}
                            </span>
                          </p>
                          <div className="flex gap-2">
                            <select
                              className="field !py-1.5 text-sm flex-1"
                              value={
                                rel.type === "parent" &&
                                rel.from_person_id === selected.id
                                  ? "parent"
                                  : rel.type === "parent"
                                    ? "child"
                                    : rel.type
                              }
                              disabled={busy}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (v === "relative") {
                                  void removePersonLink(rel.id);
                                } else if (
                                  (rel.type === "parent" &&
                                    rel.from_person_id === selected.id &&
                                    v === "child") ||
                                  (rel.type === "parent" &&
                                    rel.to_person_id === selected.id &&
                                    v === "parent")
                                ) {
                                  // Flip parent direction: delete + recreate
                                  void (async () => {
                                    setBusy(true);
                                    try {
                                      await fetch(
                                        `${apiRoot}/family/relationship/${rel.id}`,
                                        { method: "DELETE" }
                                      );
                                      await fetch(
                                        `${apiRoot}/family/relationship`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            from_person_id: selected.id,
                                            to_person_id: other?.id,
                                            type: v,
                                            vault_id: vaultId,
                                          }),
                                        }
                                      );
                                      softReload();
                                    } finally {
                                      setBusy(false);
                                    }
                                  })();
                                } else {
                                  void changePersonLink(rel.id, v);
                                }
                              }}
                            >
                              {EDIT_REL_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}

                    <div className="rounded-xl border border-dashed border-line p-2.5 space-y-2">
                      <p className="text-xs text-ink-soft">Add link</p>
                      <select
                        className="field !py-1.5 text-sm"
                        value={linkToId}
                        onChange={(e) => setLinkToId(e.target.value)}
                      >
                        <option value="">Choose person…</option>
                        {graph.persons
                          .filter((p) => p.id !== selected.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                      <select
                        className="field !py-1.5 text-sm"
                        value={linkType}
                        onChange={(e) => setLinkType(e.target.value)}
                      >
                        {REL_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost w-full !py-1.5 text-sm"
                        disabled={busy || !linkToId}
                        onClick={() => void addPersonLink()}
                      >
                        Add relationship
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={() => void savePerson()}
                  >
                    {busy ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost w-full text-[#9b2c2c]"
                    disabled={busy}
                    onClick={() => void deletePerson()}
                  >
                    <Trash2 className="w-4 h-4" /> Remove from tree
                  </button>
                  <p className="text-xs text-ink-soft pt-2">
                    Tip: drag between people to link. Unsure? Leave them
                    unattached — you can fix it here anytime.
                  </p>
                </div>
              )}

              {selectedEdge && !showAdd && (
                <div className="space-y-3">
                  <p className="text-sm text-ink-soft">
                    Change how these two people are linked, or remove a bad
                    auto-suggestion.
                  </p>
                  <div>
                    <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                      Relationship type
                    </label>
                    <select
                      className="field"
                      value={edgeType}
                      onChange={(e) => setEdgeType(e.target.value)}
                    >
                      {EDIT_REL_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={busy}
                    onClick={() => void saveEdge()}
                  >
                    {busy ? "Saving…" : "Update link"}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost w-full text-[#9b2c2c]"
                    disabled={busy}
                    onClick={() => void deleteEdge()}
                  >
                    <Trash2 className="w-4 h-4" /> Remove link
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      </Sidebar>
    </RequireAuth>
  );
}
