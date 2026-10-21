"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Mic, Search } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import Chronicle, {
  chronicleSpan,
  type ChronicleMoment,
  type MomentDraft,
} from "../components/Chronicle";
import { RequireAuth } from "../components/RequireAuth";
import { useAuth } from "../lib/auth";

type PersonRow = {
  person_id: string;
  story_id: string;
  person_name: string;
  event_count: number;
  updated_at?: string;
};

type SortKey = "recent" | "az" | "za" | "events";

type MasterEvent = {
  id: string;
  year?: number;
  title?: string;
  event?: string;
  person_name?: string;
  person_id?: string;
  description?: string;
  kind?: string;
  artifact_type?: string;
  category?: string;
  location?: string;
  place?: string;
  source_story_id?: string | null;
};

export default function TimelineHomePage() {
  const { vaultId, vaults, apiFetch } = useAuth();
  const canEdit = (vaults.find((vault) => vault.id === vaultId)?.role ?? "owner") !== "viewer";
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [master, setMaster] = useState<MasterEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"people" | "vault">("vault");

  useEffect(() => {
    if (!vaultId) return;
    setLoading(true);
    Promise.all([
      apiFetch("/timeline").then((r) => r.json()),
      apiFetch("/master-timeline").then((r) => r.json()),
    ])
      .then(([peopleData, masterData]) => {
        setPeople(Array.isArray(peopleData) ? peopleData : []);
        setMaster(Array.isArray(masterData) ? masterData : []);
      })
      .catch(() => {
        setPeople([]);
        setMaster([]);
      })
      .finally(() => setLoading(false));
  }, [apiFetch, vaultId]);

  const filtered = useMemo(() => {
    let list = people.filter((p) =>
      (p.person_name || "").toLowerCase().includes(search.toLowerCase())
    );
    if (sort === "az") {
      list = [...list].sort((a, b) => a.person_name.localeCompare(b.person_name));
    } else if (sort === "za") {
      list = [...list].sort((a, b) => b.person_name.localeCompare(a.person_name));
    } else if (sort === "events") {
      list = [...list].sort((a, b) => (b.event_count || 0) - (a.event_count || 0));
    }
    return list;
  }, [people, search, sort]);

  async function saveMoment(moment: ChronicleMoment, draft: MomentDraft) {
    if (!moment.id) throw new Error("This moment cannot be edited");
    const res = await apiFetch(`/timeline/moments/${encodeURIComponent(moment.id)}`, {
      method: "PATCH",
      json: draft,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail;
      throw new Error(typeof detail === "string" ? detail : "Could not save this moment");
    }
    const saved = (await res.json()) as ChronicleMoment;
    setMaster((current) =>
      current.map((event) =>
        event.id === moment.id ? ({ ...event, ...saved } as MasterEvent) : event
      )
    );
  }

  const span = chronicleSpan(master);
  const voices = new Set(master.map((event) => event.person_name).filter(Boolean)).size;
  const familyLine = loading
    ? "Gathering the years recorded in this vault."
    : master.length === 0
      ? "Archive a story and the years will gather here, one life beside another."
      : span.first && span.last
        ? `From ${span.first} to ${span.last}. ${master.length} moment${master.length === 1 ? "" : "s"} across ${voices} ${voices === 1 ? "life" : "lives"}.`
        : `${master.length} moment${master.length === 1 ? "" : "s"} are waiting for a year.`;

  return (
    <RequireAuth>
      <Sidebar>
        <p className="label-eyebrow mb-3">The family chronicle</p>
        <h1 className="font-display text-5xl text-ink mb-3 max-w-3xl">The family story</h1>
        <p className="text-lg text-ink-soft mb-8 max-w-xl leading-relaxed">
          {familyLine}
        </p>

        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setTab("vault")}
            className={tab === "vault" ? "btn-primary" : "btn-ghost"}
          >
            Family story
          </button>
          <button
            type="button"
            onClick={() => setTab("people")}
            className={tab === "people" ? "btn-primary" : "btn-ghost"}
          >
            Each life
          </button>
        </div>

        {tab === "vault" ? (
          loading ? (
            <p className="text-ink-soft">Loading vault timeline…</p>
          ) : master.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line p-10 text-center">
              <p className="text-ink-soft">
                The chronicle is empty. Archive a story and the first year will open it.
              </p>
            </div>
          ) : (
            <Chronicle moments={master} showPerson onSave={canEdit ? saveMoment : undefined} />
          )
        ) : null}

        {tab === "people" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search people…"
                  className="field !pl-11"
                />
              </div>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="field sm:!w-auto"
              >
                <option value="recent">Sort by recent</option>
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
                <option value="events">Most events</option>
              </select>
            </div>

            {loading ? (
              <p className="text-ink-soft">Loading timelines…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <Calendar className="w-10 h-10 text-brass mx-auto mb-3" />
                <p className="text-ink font-medium mb-2">No timelines yet</p>
                <p className="text-sm text-ink-soft mb-5 max-w-md mx-auto">
                  Record an oral history and events will appear here automatically.
                </p>
                <Link href="/record" className="btn-primary">
                  <Mic className="w-4 h-4" /> Record a story
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((person) => (
                  <button
                    key={person.person_id}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/timeline/${person.story_id || person.person_id}`
                      )
                    }
                    className="text-left rounded-2xl border border-line bg-white p-5 hover:border-brass/40 transition"
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-11 h-11 rounded-full bg-stone flex items-center justify-center text-brass-deep font-display text-lg shrink-0">
                        {(person.person_name || "?")[0]}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl text-ink truncate">
                          {person.person_name}
                        </h3>
                        <p className="text-sm text-ink-soft mt-0.5">
                          {person.event_count} moment{person.event_count === 1 ? "" : "s"} in this life
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-brass-deep">
                      Read this life
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Sidebar>
    </RequireAuth>
  );
}
