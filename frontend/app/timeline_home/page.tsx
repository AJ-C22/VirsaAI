"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Calendar, Mic, Search } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
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

export default function TimelineHomePage() {
  const { apiRoot, vaultId } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = vaultId || "";
    const q = id ? `?vault_id=${encodeURIComponent(id)}` : "";
    setLoading(true);
    fetch(`${apiRoot}/timeline${q}`)
      .then((r) => r.json())
      .then((data) => setPeople(Array.isArray(data) ? data : []))
      .catch(() => setPeople([]))
      .finally(() => setLoading(false));
  }, [apiRoot, vaultId]);

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

  return (
    <RequireAuth>
      <Sidebar>
        <p className="label-eyebrow mb-3">Life events</p>
        <h1 className="font-display text-4xl text-ink mb-3">Family timelines</h1>
        <p className="text-ink-soft mb-8 max-w-2xl leading-relaxed">
          Each relative has one timeline that grows as you archive their stories.
        </p>

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
                  router.push(`/timeline/${person.story_id || person.person_id}`)
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
                      {person.event_count} events
                      {person.updated_at
                        ? ` · ${new Date(person.updated_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-stone relative mb-4">
                  <span className="absolute left-1/4 -top-1 w-2.5 h-2.5 rounded-full bg-brass" />
                  <span className="absolute left-1/2 -top-1 w-2.5 h-2.5 rounded-full bg-brass" />
                  <span className="absolute right-1/4 -top-1 w-2.5 h-2.5 rounded-full bg-brass" />
                </div>
                <span className="text-sm font-semibold text-brass-deep">
                  View timeline →
                </span>
              </button>
            ))}
          </div>
        )}
      </Sidebar>
    </RequireAuth>
  );
}
