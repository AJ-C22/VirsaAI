"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Users, Calendar, Image, Sparkles } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { RequireAuth } from "../components/RequireAuth";

type SearchResult = {
  query: string;
  stories: Array<{ id: string; title?: string; summary?: string }>;
  persons: Array<{ id: string; name: string; birth_year?: number; birth_place?: string }>;
  events: Array<{
    id: string;
    year?: number;
    title: string;
    person_name?: string;
    place?: string;
  }>;
  artifacts: Array<{ id: string; title: string; artifact_type: string }>;
  shared_memories: Array<{ id: string; title: string; year?: number; place?: string }>;
};

export default function ArchivePage() {
  const { apiRoot, vaultId } = useAuth();
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);

  const total = useMemo(() => {
    if (!result) return 0;
    return (
      result.stories.length +
      result.persons.length +
      result.events.length +
      result.artifacts.length +
      result.shared_memories.length
    );
  }, [result]);

  useEffect(() => {
    if (!submitted.trim()) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: submitted });
        if (vaultId) params.set("vault_id", vaultId);
        const res = await fetch(
          `${apiRoot}/archive/search?${params.toString()}`
        );
        const data = await res.json();
        if (!cancelled) setResult(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submitted, apiRoot, vaultId]);

  return (
    <RequireAuth>
    <Sidebar>
      <p className="label-eyebrow mb-3">Living archive</p>
      <h1 className="font-display text-4xl text-ink mb-3">Search the family vault</h1>
      <p className="text-ink-soft mb-8 max-w-2xl leading-relaxed">
        Find people, oral histories, timeline events, shared memories, and
        artifacts across every recording.
      </p>

      <form
        className="flex flex-col sm:flex-row gap-3 mb-10"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(q.trim());
        }}
      >
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-brass" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try a name, place, year, or memory…"
            className="field !pl-12 !py-4"
          />
        </div>
        <button type="submit" className="btn-primary">
          Search
        </button>
      </form>

      {loading && <p className="text-ink-soft">Searching…</p>}

        {result && !loading && (
        <div className="space-y-8">
          <p className="text-sm text-ink-soft">
            {total} results for “{result.query}”
          </p>

          {total === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center">
              <p className="text-ink-soft mb-4">Nothing matched that search.</p>
              <Link href="/record" className="btn-primary">
                Record a story
              </Link>
            </div>
          )}

          <ResultSection icon={<Users className="w-4 h-4" />} title="People" empty={result.persons.length === 0}>
            {result.persons.map((p) => (
              <div key={p.id} className="py-3 border-b border-line last:border-0">
                <div className="font-medium text-ink">{p.name}</div>
                <div className="text-sm text-ink-soft">
                  {[p.birth_year, p.birth_place].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </ResultSection>

          <ResultSection icon={<BookOpen className="w-4 h-4" />} title="Oral histories" empty={result.stories.length === 0}>
            {result.stories.map((s) => (
              <Link
                key={s.id}
                href={`/story/${s.id}`}
                className="block py-3 border-b border-line last:border-0 hover:bg-stone/40 -mx-2 px-2 rounded-lg"
              >
                <div className="font-medium text-ink">{s.title || "Untitled"}</div>
                {s.summary && (
                  <p className="text-sm text-ink-soft line-clamp-2 mt-1">{s.summary}</p>
                )}
              </Link>
            ))}
          </ResultSection>

          <ResultSection icon={<Calendar className="w-4 h-4" />} title="Timeline events" empty={result.events.length === 0}>
            {result.events.map((e) => (
              <div key={e.id} className="py-3 border-b border-line last:border-0">
                <div className="font-medium text-ink">
                  {e.year ?? "—"} · {e.title}
                </div>
                <div className="text-sm text-ink-soft">
                  {[e.person_name, e.place].filter(Boolean).join(" · ")}
                </div>
              </div>
            ))}
          </ResultSection>

          <ResultSection icon={<Sparkles className="w-4 h-4" />} title="Shared memories" empty={result.shared_memories.length === 0}>
            {result.shared_memories.map((m) => (
              <Link key={m.id} href="/memories" className="block py-3 border-b border-line last:border-0">
                <div className="font-medium text-ink">
                  {m.year ?? "—"} · {m.title}
                </div>
                {m.place && <div className="text-sm text-ink-soft">{m.place}</div>}
              </Link>
            ))}
          </ResultSection>

          <ResultSection icon={<Image className="w-4 h-4" />} title="Artifacts" empty={result.artifacts.length === 0}>
            {result.artifacts.map((a) => (
              <div key={a.id} className="py-3 border-b border-line last:border-0">
                <div className="font-medium text-ink">{a.title}</div>
                <div className="text-sm text-ink-soft capitalize">{a.artifact_type}</div>
              </div>
            ))}
          </ResultSection>
        </div>
      )}
    </Sidebar>
    </RequireAuth>
  );
}

function ResultSection({
  icon,
  title,
  empty,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  if (empty) return null;
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink mb-2">
        <span className="text-brass">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
