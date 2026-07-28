"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, BookOpen, Users, Calendar, Image, Sparkles } from "lucide-react";
import Sidebar from "../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

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
        const res = await fetch(
          `${API_ROOT}/archive/search?q=${encodeURIComponent(submitted)}`
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
  }, [submitted]);

  return (
    <Sidebar>
      <div className="max-w-5xl mx-auto">
        <p className="text-sm font-medium text-[#B8860B] mb-2 tracking-wide">
          LIVING ARCHIVE
        </p>
        <h1 className="text-4xl font-bold text-[#4C3B23] mb-3">Search the family vault</h1>
        <p className="text-[#6B5B3D]/75 mb-8 max-w-2xl">
          Find people, oral histories, timeline events, shared memories, and
          artifacts across every recording in your family archive.
        </p>

        <form
          className="flex gap-3 mb-10"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(q.trim());
          }}
        >
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#B8860B]" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try a name, place, year, or memory…"
              className="w-full rounded-2xl border border-[#E8D9C0] bg-white pl-12 pr-4 py-4 outline-none focus:border-[#D4AF37]"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-4 rounded-2xl bg-[#4C3B23] text-white font-medium hover:bg-[#3a2d1a]"
          >
            Search
          </button>
        </form>

        {loading && <p className="text-[#6B5B3D]">Searching…</p>}

        {result && !loading && (
          <div className="space-y-8">
            <p className="text-sm text-[#7B6A4B]">
              {total} results for “{result.query}”
            </p>

            <ResultSection
              icon={<Users className="w-4 h-4" />}
              title="People"
              empty={result.persons.length === 0}
            >
              {result.persons.map((p) => (
                <div key={p.id} className="py-3 border-b border-[#F0E4CF]">
                  <div className="font-medium text-[#4C3B23]">{p.name}</div>
                  <div className="text-sm text-[#7B6A4B]">
                    {[p.birth_year, p.birth_place].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </ResultSection>

            <ResultSection
              icon={<BookOpen className="w-4 h-4" />}
              title="Oral histories"
              empty={result.stories.length === 0}
            >
              {result.stories.map((s) => (
                <Link
                  key={s.id}
                  href={`/story/${s.id}`}
                  className="block py-3 border-b border-[#F0E4CF] hover:bg-[#FFF8E7] -mx-2 px-2 rounded"
                >
                  <div className="font-medium text-[#4C3B23]">{s.title || "Untitled"}</div>
                  {s.summary && (
                    <p className="text-sm text-[#7B6A4B] line-clamp-2 mt-1">{s.summary}</p>
                  )}
                </Link>
              ))}
            </ResultSection>

            <ResultSection
              icon={<Calendar className="w-4 h-4" />}
              title="Timeline events"
              empty={result.events.length === 0}
            >
              {result.events.map((e) => (
                <div key={e.id} className="py-3 border-b border-[#F0E4CF]">
                  <div className="font-medium text-[#4C3B23]">
                    {e.year ?? "—"} · {e.title}
                  </div>
                  <div className="text-sm text-[#7B6A4B]">
                    {[e.person_name, e.place].filter(Boolean).join(" · ")}
                  </div>
                </div>
              ))}
            </ResultSection>

            <ResultSection
              icon={<Sparkles className="w-4 h-4" />}
              title="Shared memories"
              empty={result.shared_memories.length === 0}
            >
              {result.shared_memories.map((m) => (
                <Link
                  key={m.id}
                  href="/memories"
                  className="block py-3 border-b border-[#F0E4CF]"
                >
                  <div className="font-medium text-[#4C3B23]">
                    {m.year ?? "—"} · {m.title}
                  </div>
                  {m.place && <div className="text-sm text-[#7B6A4B]">{m.place}</div>}
                </Link>
              ))}
            </ResultSection>

            <ResultSection
              icon={<Image className="w-4 h-4" />}
              title="Artifacts"
              empty={result.artifacts.length === 0}
            >
              {result.artifacts.map((a) => (
                <div key={a.id} className="py-3 border-b border-[#F0E4CF]">
                  <div className="font-medium text-[#4C3B23]">{a.title}</div>
                  <div className="text-sm text-[#7B6A4B] capitalize">{a.artifact_type}</div>
                </div>
              ))}
            </ResultSection>
          </div>
        )}
      </div>
    </Sidebar>
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
    <section className="rounded-2xl border border-[#E8D9C0] bg-white p-5">
      <h2 className="flex items-center gap-2 font-semibold text-[#4C3B23] mb-2">
        <span className="text-[#B8860B]">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}
