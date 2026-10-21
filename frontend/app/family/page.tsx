"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Plus, Trash2 } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { buildPedigree, type CoupleUnit } from "./pedigree";
import { RequireAuth } from "../components/RequireAuth";
import { useAuth } from "../lib/auth";

type Person = {
  id: string;
  name: string;
  kinship_label?: string | null;
  birth_year?: number | null;
  death_year?: number | null;
  notes?: string | null;
  sex?: string | null;
  birth_place?: string | null;
};

type Relationship = {
  id: string;
  from_person_id: string;
  to_person_id: string;
  type: string;
};

type FamilyGraph = {
  persons: Person[];
  relationships: Relationship[];
  vault?: { kinship_system?: string; name?: string };
  viewpoint_person_id?: string | null;
};

const ADD_OPTIONS = [
  { id: "father", label: "Father", sex: "male" },
  { id: "mother", label: "Mother", sex: "female" },
  { id: "spouse", label: "Spouse", sex: "" },
  { id: "son", label: "Son", sex: "male" },
  { id: "daughter", label: "Daughter", sex: "female" },
  { id: "brother", label: "Brother", sex: "male" },
  { id: "sister", label: "Sister", sex: "female" },
] as const;

type AddId = (typeof ADD_OPTIONS)[number]["id"];

type TreeArrange = {
  unitOrder: string[];
  members: Record<string, string[]>;
};

function arrangePedigree(pedigree: ReturnType<typeof buildPedigree>, arrange: TreeArrange) {
  const rank = new Map(arrange.unitOrder.map((id, index) => [id, index]));
  const generations = pedigree.generations.map((row) =>
    [...row]
      .sort((a, b) => (rank.get(a.id) ?? 1_000_000) - (rank.get(b.id) ?? 1_000_000))
      .map((unit) => {
        const order = arrange.members[unit.id];
        if (!order) return unit;
        const members = [...unit.members].sort((a, b) => {
          const left = order.indexOf(a);
          const right = order.indexOf(b);
          return (left < 0 ? 999 : left) - (right < 0 ? 999 : right);
        });
        return { ...unit, members, personId: members[0], spouses: members.slice(1) };
      })
  );
  return { ...pedigree, generations };
}

function yearsOf(person: Person): string {
  if (!person.birth_year && !person.death_year) return "";
  const start = person.birth_year ?? "";
  const end = person.death_year ?? "";
  if (person.birth_year && !person.death_year) return String(person.birth_year);
  return `${start}–${end}`;
}

function edgeFor(kind: AddId, anchorId: string, otherId: string) {
  if (kind === "father" || kind === "mother") {
    return { from_person_id: otherId, to_person_id: anchorId, type: "parent" };
  }
  if (kind === "son" || kind === "daughter") {
    return { from_person_id: anchorId, to_person_id: otherId, type: "parent" };
  }
  if (kind === "spouse") {
    return { from_person_id: anchorId, to_person_id: otherId, type: "spouse" };
  }
  return { from_person_id: anchorId, to_person_id: otherId, type: "sibling" };
}

export default function FamilyPage() {
  const { vaultId, apiFetch } = useAuth();
  const [graph, setGraph] = useState<FamilyGraph | null>(null);
  const [viewpoint, setViewpoint] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftSex, setDraftSex] = useState("");
  const [draftBirth, setDraftBirth] = useState("");
  const [draftDeath, setDraftDeath] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [addKind, setAddKind] = useState<AddId>("father");
  const [addName, setAddName] = useState("");
  const [addExisting, setAddExisting] = useState("");
  const [newPersonName, setNewPersonName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [search, setSearch] = useState("");

  const load = useCallback(
    async (nextViewpoint?: string) => {
      setError(null);
      const params = new URLSearchParams();
      if (nextViewpoint) params.set("viewpoint", nextViewpoint);
      const qs = params.toString();
      const res = await apiFetch(`/family${qs ? `?${qs}` : ""}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Could not load the family tree");
      }
      const json = (await res.json()) as FamilyGraph;
      const relationships = (json.relationships ?? []).flatMap((rel) => {
        if (rel.type === "parent" || rel.type === "spouse" || rel.type === "sibling") {
          return [rel];
        }
        if (rel.type === "child") {
          return [{ ...rel, type: "parent" }];
        }
        return [];
      });
      const next: FamilyGraph = {
        persons: json.persons ?? [],
        relationships,
        vault: json.vault,
        viewpoint_person_id: json.viewpoint_person_id,
      };
      setGraph(next);
      const vp = next.viewpoint_person_id || next.persons[0]?.id || "";
      setViewpoint(vp);
      setSelectedId((current) =>
        next.persons.some((person) => person.id === current) ? current : vp
      );
      return next;
    },
    [apiFetch]
  );

  useEffect(() => {
    if (!vaultId) return;
    setLoading(true);
    load()
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load the family tree")
      )
      .finally(() => setLoading(false));
  }, [vaultId, load]);

  const persons = graph?.persons ?? [];
  const relationships = graph?.relationships ?? [];
  const byId = useMemo(
    () => new Map(persons.map((person) => [person.id, person])),
    [persons]
  );
  const selected = byId.get(selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    setDraftName(selected.name || "");
    setDraftSex(selected.sex || "");
    setDraftBirth(selected.birth_year ? String(selected.birth_year) : "");
    setDraftDeath(selected.death_year ? String(selected.death_year) : "");
    setDraftNotes(selected.notes || "");
    setConfirmDelete(false);
    setAddName("");
    setAddExisting("");
  }, [selected]);

  const built = useMemo(
    () => buildPedigree(persons.map((person) => person.id), relationships),
    [persons, relationships]
  );
  const [arrange, setArrange] = useState<{ vault: string; data: TreeArrange } | null>(null);
  useEffect(() => {
    if (!vaultId) return;
    try {
      const raw = localStorage.getItem(`virsa-tree-arrange:${vaultId}`);
      const data = raw ? (JSON.parse(raw) as TreeArrange) : { unitOrder: [], members: {} };
      setArrange({
        vault: vaultId,
        data: {
          unitOrder: Array.isArray(data.unitOrder) ? data.unitOrder : [],
          members: data.members && typeof data.members === "object" ? data.members : {},
        },
      });
    } catch {
      setArrange({ vault: vaultId, data: { unitOrder: [], members: {} } });
    }
  }, [vaultId]);
  useEffect(() => {
    if (!vaultId || !arrange || arrange.vault !== vaultId) return;
    localStorage.setItem(`virsa-tree-arrange:${vaultId}`, JSON.stringify(arrange.data));
  }, [arrange, vaultId]);
  const pedigree = useMemo(
    () => arrangePedigree(built, arrange?.vault === vaultId ? arrange.data : { unitOrder: [], members: {} }),
    [built, arrange, vaultId]
  );
  const reorderUnits = (rowIndex: number, unitIds: string[]) => {
    if (!vaultId) return;
    setArrange((current) => {
      const data = current?.vault === vaultId ? current.data : { unitOrder: [], members: {} };
      const rows = arrangePedigree(built, data).generations.map((row, index) =>
        index === rowIndex ? unitIds : row.map((unit) => unit.id)
      );
      return { vault: vaultId, data: { ...data, unitOrder: rows.flat() } };
    });
  };
  const reorderMembers = (unitId: string, memberIds: string[]) => {
    if (!vaultId) return;
    setArrange((current) => {
      const data = current?.vault === vaultId ? current.data : { unitOrder: [], members: {} };
      return { vault: vaultId, data: { ...data, members: { ...data.members, [unitId]: memberIds } } };
    });
  };
  const unplaced = persons.filter((person) => !pedigree.placed.has(person.id));

  useEffect(() => {
    const query = search.trim().toLowerCase();
    if (!query) return;
    const match = persons.find((person) => person.name.toLowerCase().includes(query));
    if (!match) return;
    document.getElementById(`tree-person-${match.id}`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [search, persons]);

  const selectedLinks = useMemo(() => {
    if (!selected) return [];
    return relationships
      .filter(
        (rel) =>
          rel.from_person_id === selected.id || rel.to_person_id === selected.id
      )
      .map((rel) => {
        const otherId =
          rel.from_person_id === selected.id ? rel.to_person_id : rel.from_person_id;
        const other = byId.get(otherId);
        let phrase = "Related to";
        if (rel.type === "spouse") phrase = "Spouse of";
        else if (rel.type === "sibling") phrase = "Sibling of";
        else if (rel.type === "parent" && rel.from_person_id === selected.id)
          phrase = "Parent of";
        else if (rel.type === "parent") phrase = "Child of";
        return {
          id: rel.id,
          phrase,
          name: other?.name || "Someone",
        };
      });
  }, [relationships, selected, byId]);

  async function refresh(keepViewpoint = viewpoint) {
    setSaving(true);
    try {
      await load(keepViewpoint);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not refresh the tree");
    } finally {
      setSaving(false);
    }
  }

  async function savePerson() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/family/member/${selected.id}`, {
        method: "PATCH",
        json: {
          name: draftName.trim() || selected.name,
          sex: draftSex || null,
          birth_year: draftBirth ? Number(draftBirth) : null,
          death_year: draftDeath ? Number(draftDeath) : null,
          notes: draftNotes,
        },
      });
      if (!res.ok) throw new Error("Could not save this person");
      await load(viewpoint);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save this person");
    } finally {
      setSaving(false);
    }
  }

  async function addRelative() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const option = ADD_OPTIONS.find((item) => item.id === addKind)!;
      if (addExisting) {
        const body = {
          ...edgeFor(addKind, selected.id, addExisting),
          vault_id: vaultId,
        };
        const res = await apiFetch("/family/relationship", { method: "POST", json: body });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || "Could not add that relationship");
        }
        if (option.sex) {
          const other = byId.get(addExisting);
          if (other && !other.sex) {
            await apiFetch(`/family/member/${addExisting}`, {
              method: "PATCH",
              json: { sex: option.sex },
            });
          }
        }
      } else if (addName.trim()) {
        const res = await apiFetch("/family/member", {
          method: "POST",
          json: {
            name: addName.trim(),
            relationship: addKind,
            related_to_person_id: selected.id,
            sex: option.sex || null,
            vault_id: vaultId,
          },
        });
        if (!res.ok) throw new Error("Could not add that person");
      } else {
        throw new Error("Type a name or choose someone already in the family");
      }
      setAddName("");
      setAddExisting("");
      await load(viewpoint);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add that relative");
    } finally {
      setSaving(false);
    }
  }

  async function addUnplaced() {
    if (!newPersonName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch("/family/member", {
        method: "POST",
        json: {
          name: newPersonName.trim(),
          relationship: "relative",
          vault_id: vaultId,
        },
      });
      if (!res.ok) throw new Error("Could not add that person");
      const created = await res.json();
      setNewPersonName("");
      await load(viewpoint);
      if (created?.id) setSelectedId(created.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add that person");
    } finally {
      setSaving(false);
    }
  }

  async function removeLink(relationshipId: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/family/relationship/${relationshipId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Could not remove that link");
      await load(viewpoint);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not remove that link");
    } finally {
      setSaving(false);
    }
  }

  async function deletePerson() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/family/member/${selected.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this person");
      setSelectedId("");
      await load(viewpoint === selected.id ? "" : viewpoint);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not delete this person");
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }

  function personCard(person: Person, framed = false) {
    const active = person.id === selectedId;
    const label = person.id === viewpoint ? "You are here" : person.kinship_label;
    const query = search.trim().toLowerCase();
    const match = query.length > 0 && person.name.toLowerCase().includes(query);
    const dim = query.length > 0 && !match;
    return (
      <button
        key={person.id}
        type="button"
        onClick={() => setSelectedId(person.id)}
        id={`tree-person-${person.id}`}
        data-person={person.id}
        className={`cursor-grab text-left bg-white px-4 py-3 transition min-w-[150px] max-w-[210px] active:cursor-grabbing ${
          framed ? "rounded-2xl border border-line" : ""
        } ${active ? "bg-[#f3faf7] ring-2 ring-brass ring-inset" : "hover:bg-mist"} ${
          match ? "ring-2 ring-brass/70 ring-inset" : ""
        } ${dim ? "opacity-30" : ""}`}
      >
        {label && (
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass-deep mb-1">
            {label}
          </div>
        )}
        <div className="font-display text-xl text-ink leading-tight">{person.name}</div>
        {yearsOf(person) && (
          <div className="text-xs text-ink-soft mt-1 tabular-nums">{yearsOf(person)}</div>
        )}
      </button>
    );
  }

  function CoupleBox({ unit }: { unit: CoupleUnit }) {
    const people = unit.members.map((id) => byId.get(id)).filter((person): person is Person => !!person);
    return (
      <div
        data-unit={unit.id}
        className={`relative z-10 flex items-stretch rounded-2xl border bg-white shadow-sm overflow-hidden ${
          unit.members.includes(selectedId) ? "border-brass" : "border-line"
        }`}
      >
        {people.map((person, index) => (
          <div key={person.id} className="flex items-stretch">
            {index > 0 && <div className="w-px bg-line" />}
            {personCard(person)}
          </div>
        ))}
      </div>
    );
  }

  const system = graph?.vault?.kinship_system || "punjabi";

  return (
    <RequireAuth>
      <Sidebar wide>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
          <div>
            <p className="label-eyebrow mb-1">Family tree</p>
            <h1 className="font-display text-3xl md:text-4xl text-ink">
              {graph?.vault?.name || "Your family"}
            </h1>
          </div>
          <label className="text-sm text-ink-soft min-w-[240px]">
            <span className="block mb-1 font-medium text-ink">Names as seen by</span>
            <select
              className="field"
              value={viewpoint}
              onChange={(event) => {
                const next = event.target.value;
                setViewpoint(next);
                setSelectedId(next);
                void refresh(next);
              }}
            >
              {persons.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
            <span className="block mt-1 text-xs capitalize">{system} kinship</span>
          </label>
        </div>

        {error && (
          <p className="mb-4 text-sm text-[#9b2c2c] rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}

        {loading && <p className="text-ink-soft">Loading the family…</p>}

        {!loading && persons.length === 0 && (
          <div className="rounded-3xl border border-dashed border-line bg-white p-10 max-w-xl">
            <h2 className="font-display text-3xl text-ink mb-2">Start with one person</h2>
            <p className="text-ink-soft mb-5">
              Add yourself, a parent, or whoever the first story is about. You can attach
              everyone else from their card.
            </p>
            <div className="flex gap-2">
              <input
                className="field"
                placeholder="Name"
                value={newPersonName}
                onChange={(event) => setNewPersonName(event.target.value)}
              />
              <button type="button" className="btn-primary shrink-0" onClick={() => void addUnplaced()}>
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </div>
        )}

        {!loading && persons.length > 0 && (
          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
            <div className="min-w-0 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-soft">
                  {pedigree.placed.size} on the tree
                  {unplaced.length ? ` · ${unplaced.length} still to place` : ""}
                  <span className="hidden sm:inline"> · drag a card sideways to rearrange its row</span>
                </p>
                <input
                  className="field max-w-xs"
                  placeholder="Find a person"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <section className="overflow-auto rounded-3xl border border-line bg-[#f7faf8] min-h-[72vh] lg:min-h-[calc(100vh-9rem)]">
                {pedigree.generations.length === 0 ? (
                  <p className="text-ink-soft text-center p-10">
                    No links yet. Open someone and add a parent, spouse, sibling, or child.
                  </p>
                ) : (
                  <GenerationTree
                    pedigree={pedigree}
                    renderUnit={(unit) => <CoupleBox unit={unit} />}
                    onReorderUnits={reorderUnits}
                    onReorderMembers={reorderMembers}
                  />
                )}
              </section>

              <div className="flex gap-2 max-w-md">
                <input
                  className="field"
                  placeholder="Add someone not linked yet"
                  value={newPersonName}
                  onChange={(event) => setNewPersonName(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-ghost shrink-0"
                  disabled={saving}
                  onClick={() => void addUnplaced()}
                >
                  Add
                </button>
              </div>
              {unplaced.length > 0 && (
              <section className="rounded-3xl border border-dashed border-line p-5">
                <h2 className="font-display text-2xl text-ink mb-1">Not on the tree yet</h2>
                <p className="text-sm text-ink-soft mb-4 max-w-xl">
                  These people are in the vault, but no parent, spouse, sibling, or child
                  link connects them. Open a card and add that link to pull them into the tree.
                </p>
                <div className="flex flex-wrap gap-3">
                  {unplaced.map((person) => personCard(person, true))}
                </div>
              </section>
              )}
            </div>

            <aside className="rounded-3xl border border-line bg-white p-5 lg:sticky lg:top-6">
              {!selected && <p className="text-ink-soft">Select someone to edit their place in the family.</p>}
              {selected && (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brass-deep">
                      {selected.id === viewpoint ? "Viewpoint" : selected.kinship_label || "Relative"}
                    </p>
                    <h2 className="font-display text-3xl text-ink leading-tight mt-1">{selected.name}</h2>
                    {selected.id !== viewpoint && (
                      <button
                        type="button"
                        className="text-sm font-semibold text-brass-deep mt-2"
                        onClick={() => {
                          setViewpoint(selected.id);
                          void refresh(selected.id);
                        }}
                      >
                        Show every name from {selected.name.split(" ")[0]}&apos;s view
                      </button>
                    )}
                  </div>

                  <label className="block text-sm">
                    <span className="text-ink-soft">Name</span>
                    <input className="field mt-1" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
                  </label>
                  <div>
                    <span className="text-sm text-ink-soft">Sex</span>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {[
                        ["male", "Male"],
                        ["female", "Female"],
                        ["", "Skip"],
                      ].map(([value, label]) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => setDraftSex(value)}
                          className={`rounded-xl border px-2 py-2 text-sm ${
                            draftSex === value
                              ? "border-brass bg-mist text-ink font-semibold"
                              : "border-line text-ink-soft"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-ink-soft mt-1">
                      Sex decides Dada or Dadi, Chacha or Bhua, and the rest.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-sm">
                      <span className="text-ink-soft">Born</span>
                      <input
                        className="field mt-1"
                        inputMode="numeric"
                        value={draftBirth}
                        onChange={(e) => setDraftBirth(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="text-ink-soft">Died</span>
                      <input
                        className="field mt-1"
                        inputMode="numeric"
                        value={draftDeath}
                        onChange={(e) => setDraftDeath(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    <span className="text-ink-soft">Notes</span>
                    <textarea
                      className="field mt-1 resize-y"
                      rows={3}
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                    />
                  </label>
                  <button type="button" className="btn-primary w-full" disabled={saving} onClick={() => void savePerson()}>
                    Save details
                  </button>

                  <div className="border-t border-line pt-4 space-y-3">
                    <h3 className="font-semibold text-ink">Add someone to {selected.name.split(" ")[0]}</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Add a parent&apos;s brother or sister and they appear beside that parent,
                      under the grandparents. Their spouse sits in the same box.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {ADD_OPTIONS.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setAddKind(option.id)}
                          className={`rounded-xl border px-2 py-2 text-sm ${
                            addKind === option.id
                              ? "border-brass bg-mist font-semibold text-ink"
                              : "border-line text-ink-soft"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                    <input
                      className="field"
                      placeholder="New person's name"
                      value={addName}
                      onChange={(e) => {
                        setAddName(e.target.value);
                        if (e.target.value) setAddExisting("");
                      }}
                    />
                    <select
                      className="field"
                      value={addExisting}
                      onChange={(e) => {
                        setAddExisting(e.target.value);
                        if (e.target.value) setAddName("");
                      }}
                    >
                      <option value="">Or choose someone already here</option>
                      {persons
                        .filter((person) => person.id !== selected.id)
                        .map((person) => (
                          <option key={person.id} value={person.id}>
                            {person.name}
                          </option>
                        ))}
                    </select>
                    <button type="button" className="btn-accent w-full" disabled={saving} onClick={() => void addRelative()}>
                      <Plus className="w-4 h-4" />
                      Add {ADD_OPTIONS.find((option) => option.id === addKind)?.label.toLowerCase()}
                    </button>
                  </div>

                  {selectedLinks.length > 0 && (
                    <ul className="space-y-2 border-t border-line pt-4">
                      {selectedLinks.map((link) => (
                        <li key={link.id} className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            <span className="text-ink-soft">{link.phrase}</span>{" "}
                            <span className="text-ink">{link.name}</span>
                          </span>
                          <button
                            type="button"
                            className="text-ink-soft hover:text-[#9b2c2c]"
                            onClick={() => void removeLink(link.id)}
                            aria-label={`Remove link with ${link.name}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="border-t border-line pt-4">
                    {confirmDelete ? (
                      <div className="flex gap-2">
                        <button type="button" className="btn-ghost flex-1" onClick={() => setConfirmDelete(false)}>
                          Keep
                        </button>
                        <button
                          type="button"
                          className="flex-1 rounded-xl bg-[#9b2c2c] text-white text-sm font-semibold px-3 py-2"
                          onClick={() => void deletePerson()}
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-sm text-[#9b2c2c]"
                        onClick={() => setConfirmDelete(true)}
                      >
                        Delete this person
                      </button>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </Sidebar>
    </RequireAuth>
  );
}

function GenerationTree({
  pedigree,
  renderUnit,
  onReorderUnits,
  onReorderMembers,
}: {
  pedigree: ReturnType<typeof buildPedigree>;
  renderUnit: (unit: CoupleUnit) => ReactNode;
  onReorderUnits: (rowIndex: number, unitIds: string[]) => void;
  onReorderMembers: (unitId: string, memberIds: string[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const reorderUnitsRef = useRef(onReorderUnits);
  const reorderMembersRef = useRef(onReorderMembers);
  reorderUnitsRef.current = onReorderUnits;
  reorderMembersRef.current = onReorderMembers;

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>, rowIndex: number, unit: CoupleUnit) => {
    if (event.button !== 0) return;
    const personId = (event.target as HTMLElement).closest("[data-person]")?.getAttribute("data-person");
    const unitEl = event.currentTarget.querySelector("[data-unit]");
    const rowEl = event.currentTarget.parentElement;
    if (!(unitEl instanceof HTMLElement) || !rowEl) return;
    const originX = event.clientX;
    const originY = event.clientY;
    let mode: "pending" | "members" | "units" = "pending";
    let members = [...unit.members];
    let units = pedigree.generations[rowIndex].map((item) => item.id);

    const slotAmong = (nodes: Element[], clientX: number, id: string, attr: string) => {
      const others = nodes.filter((node) => node.getAttribute(attr) !== id);
      let insert = others.length;
      for (let index = 0; index < others.length; index += 1) {
        const rect = others[index].getBoundingClientRect();
        if (clientX < rect.left + rect.width / 2) {
          insert = index;
          break;
        }
      }
      return insert;
    };

    const onMove = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - originX);
      const dy = Math.abs(ev.clientY - originY);
      if (mode === "pending") {
        if (dx < 8 && dy < 8) return;
        const rect = unitEl.getBoundingClientRect();
        const inside =
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom;
        mode = inside && unit.members.length > 1 ? "members" : "units";
        setActiveId(unit.id);
      }
      if (mode === "members" && personId) {
        const rect = unitEl.getBoundingClientRect();
        if (ev.clientX < rect.left - 28 || ev.clientX > rect.right + 28) {
          mode = "units";
        } else {
          const count = Math.max(1, members.length);
          const slot = Math.min(
            count - 1,
            Math.max(0, Math.floor(((ev.clientX - rect.left) / Math.max(rect.width, 1)) * count))
          );
          const from = members.indexOf(personId);
          if (from >= 0 && from !== slot) {
            const next = [...members];
            next.splice(from, 1);
            next.splice(slot, 0, personId);
            members = next;
            reorderMembersRef.current(unit.id, next);
          }
          return;
        }
      }
      const insert = slotAmong([...rowEl.querySelectorAll(":scope > [data-drag-unit]")], ev.clientX, unit.id, "data-drag-unit");
      const next = units.filter((id) => id !== unit.id);
      next.splice(insert, 0, unit.id);
      if (next.join("|") !== units.join("|")) {
        units = next;
        reorderUnitsRef.current(rowIndex, next);
      }
    };

    const onUp = () => {
      setActiveId(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (mode === "pending") return;
      const stopClick = (click: Event) => {
        click.preventDefault();
        click.stopPropagation();
        window.removeEventListener("click", stopClick, true);
      };
      window.addEventListener("click", stopClick, true);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const measure = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const origin = canvas.getBoundingClientRect();
    const box = (id: string) => {
      const el = canvas.querySelector(`[data-unit="${CSS.escape(id)}"]`);
      if (!(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      return {
        cx: rect.left - origin.left + rect.width / 2,
        top: rect.top - origin.top,
        bottom: rect.top - origin.top + rect.height,
      };
    };
    const personBox = (id: string) => {
      const el = canvas.querySelector(`[data-person="${CSS.escape(id)}"]`);
      if (!(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      return {
        cx: rect.left - origin.left + rect.width / 2,
        top: rect.top - origin.top,
        bottom: rect.top - origin.top + rect.height,
      };
    };
    const groups = new Map<string, { parent: NonNullable<ReturnType<typeof box>>; children: NonNullable<ReturnType<typeof personBox>>[] }>();
    for (const link of pedigree.links) {
      const parent = box(link.parentId);
      const child = personBox(link.childPersonId);
      if (!parent || !child) continue;
      const group = groups.get(link.parentId) || { parent, children: [] };
      if (!group.children.some((item) => item.cx === child.cx && item.top === child.top)) {
        group.children.push(child);
      }
      groups.set(link.parentId, group);
    }
    const brackets = [...groups.values()]
      .map((group) => ({
        ...group,
        left: Math.min(group.parent.cx, ...group.children.map((child) => child.cx)),
        right: Math.max(group.parent.cx, ...group.children.map((child) => child.cx)),
        lane: 0,
      }))
      .sort((a, b) => a.left - b.left || a.parent.cx - b.parent.cx);
    const laneEnds: number[] = [];
    for (const bracket of brackets) {
      let lane = laneEnds.findIndex((end) => bracket.left > end + 12);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(bracket.right);
      } else {
        laneEnds[lane] = Math.max(laneEnds[lane], bracket.right);
      }
      bracket.lane = lane;
    }
    const laneCount = Math.max(1, laneEnds.length);
    const next: string[] = [];
    for (const bracket of brackets) {
      const childTop = Math.min(...bracket.children.map((child) => child.top));
      const gap = Math.max(28, childTop - bracket.parent.bottom);
      const railY = bracket.parent.bottom + (gap * (bracket.lane + 1)) / (laneCount + 1);
      next.push(`M ${bracket.parent.cx} ${bracket.parent.bottom} V ${railY}`);
      next.push(`M ${bracket.left} ${railY} H ${bracket.right}`);
      for (const child of bracket.children) {
        next.push(`M ${child.cx} ${railY} V ${child.top}`);
      }
    }
    for (const group of pedigree.siblingBars) {
      const boxes = group.map(box).filter((item): item is NonNullable<ReturnType<typeof box>> => !!item);
      if (boxes.length < 2) continue;
      const left = Math.min(...boxes.map((item) => item.cx));
      const right = Math.max(...boxes.map((item) => item.cx));
      const y = Math.min(...boxes.map((item) => item.top)) - 18;
      next.push(`M ${left} ${y} H ${right}`);
      for (const item of boxes) next.push(`M ${item.cx} ${y} V ${item.top}`);
    }
    setPaths(next);
  }, [pedigree]);

  useLayoutEffect(() => {
    measure();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(canvas);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  return (
    <div ref={canvasRef} className="relative mx-auto min-w-max px-8 py-10">
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        {paths.map((d, index) => (
          <path key={index} d={d} fill="none" stroke="#9bb5ad" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="relative z-10 flex flex-col items-center gap-16">
        {pedigree.generations.map((row, index) => (
          <div key={`row-${index}`} className="flex items-start justify-center gap-8">
            {row.map((unit) => (
              <div
                key={unit.id}
                data-drag-unit={unit.id}
                className={`touch-none select-none transition-shadow duration-200 ${
                  activeId === unit.id ? "z-20 scale-[1.02] rounded-2xl shadow-lg ring-2 ring-brass" : ""
                }`}
                onPointerDown={(event) => startDrag(event, index, unit)}
              >
                {renderUnit(unit)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
