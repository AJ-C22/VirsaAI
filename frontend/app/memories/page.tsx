"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import Sidebar from "../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type Memory = {
  id: string;
  title: string;
  year?: number;
  place?: string;
  description?: string;
  perspective_count: number;
  person_count: number;
  perspectives: Array<{
    summary?: string;
    person_name?: string;
    story_id?: string;
  }>;
};

export default function SharedMemoriesPage() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_ROOT}/shared-memories`);
      setMemories(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const relink = async () => {
    await fetch(`${API_ROOT}/shared-memories/relink`, { method: "POST" });
    await load();
  };

  return (
    <Sidebar>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="text-sm font-medium text-[#B8860B] mb-2 tracking-wide">
              CROSS-STORY KNOWLEDGE GRAPH
            </p>
            <h1 className="text-4xl font-bold text-[#4C3B23] mb-3">Shared memories</h1>
            <p className="text-[#6B5B3D]/75 max-w-2xl">
              The same wedding, migration, or childhood moment — told by different
              relatives — linked into one shared memory with multiple perspectives.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void relink()}
            className="shrink-0 px-4 py-2 rounded-xl border border-[#D4AF37] text-[#B8860B] text-sm font-medium hover:bg-[#FFF6DD]"
          >
            Re-scan stories
          </button>
        </div>

        {loading ? (
          <p className="text-[#6B5B3D]">Loading…</p>
        ) : memories.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E8D9C0] bg-white p-10 text-center">
            <Layers className="w-10 h-10 text-[#B8860B] mx-auto mb-3" />
            <p className="text-[#4C3B23] font-medium mb-2">No linked memories yet</p>
            <p className="text-sm text-[#7B6A4B] max-w-md mx-auto mb-4">
              Add at least two oral histories that mention the same event (year +
              place/people). VirsaAI will connect them automatically.
            </p>
            <Link href="/record" className="text-[#B8860B] font-medium underline">
              Record another story
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {memories.map((m) => (
              <article
                key={m.id}
                className="rounded-2xl border border-[#E8D9C0] bg-white p-6 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3 mb-2">
                  <h2 className="text-xl font-semibold text-[#4C3B23]">
                    {m.year ? `${m.year} · ` : ""}
                    {m.title}
                  </h2>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[#FFF1D6] text-[#8B6914]">
                    {m.perspective_count} perspectives · {m.person_count} people
                  </span>
                </div>
                {m.place && (
                  <p className="text-sm text-[#7B6A4B] mb-3">{m.place}</p>
                )}
                <div className="space-y-3 mt-4">
                  {m.perspectives.map((p, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-[#FFFCF5] border border-[#F0E4CF] px-4 py-3"
                    >
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#B8860B] mb-1">
                        {p.person_name || "Family member"}
                      </div>
                      <p className="text-sm text-[#4C3B23] leading-relaxed">
                        {p.summary}
                      </p>
                      {p.story_id && (
                        <Link
                          href={`/story/${p.story_id}`}
                          className="inline-block mt-2 text-xs text-[#B8860B] hover:underline"
                        >
                          Open source story
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </Sidebar>
  );
}
