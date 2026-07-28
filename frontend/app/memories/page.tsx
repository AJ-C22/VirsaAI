"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Layers } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";

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
  const { apiRoot } = useAuth();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiRoot}/shared-memories`);
      setMemories(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [apiRoot]);

  const relink = async () => {
    await fetch(`${apiRoot}/shared-memories/relink`, { method: "POST" });
    await load();
  };

  return (
    <Sidebar>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="label-eyebrow mb-3">Cross-story graph</p>
          <h1 className="font-display text-4xl text-ink mb-3">Shared memories</h1>
          <p className="text-ink-soft max-w-2xl leading-relaxed">
            The same wedding, migration, or childhood moment — told by different
            relatives — linked into one memory with multiple perspectives.
          </p>
        </div>
        <button type="button" onClick={() => void relink()} className="btn-ghost shrink-0">
          Re-scan stories
        </button>
      </div>

      {loading ? (
        <p className="text-ink-soft">Loading…</p>
      ) : memories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
          <Layers className="w-10 h-10 text-brass mx-auto mb-3" />
          <p className="text-ink font-medium mb-2">No linked memories yet</p>
          <p className="text-sm text-ink-soft max-w-md mx-auto mb-4">
            Add at least two oral histories that mention the same event. Virsa
            connects them automatically.
          </p>
          <Link href="/record" className="text-brass-deep font-semibold hover:underline">
            Record another story
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {memories.map((m) => (
            <article key={m.id} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-3 mb-2">
                <h2 className="font-display text-2xl text-ink">
                  {m.year ? `${m.year} · ` : ""}
                  {m.title}
                </h2>
                <span className="text-xs font-medium px-2.5 py-1 rounded-lg bg-stone text-ink-soft border border-line">
                  {m.perspective_count} perspectives · {m.person_count} people
                </span>
              </div>
              {m.place && <p className="text-sm text-ink-soft mb-3">{m.place}</p>}
              <div className="space-y-3 mt-4">
                {m.perspectives.map((p, i) => (
                  <div key={i} className="rounded-xl bg-mist border border-line px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-brass-deep mb-1">
                      {p.person_name || "Family member"}
                    </div>
                    <p className="text-sm text-ink leading-relaxed">{p.summary}</p>
                    {p.story_id && (
                      <Link
                        href={`/story/${p.story_id}`}
                        className="inline-block mt-2 text-xs text-brass-deep hover:underline"
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
    </Sidebar>
  );
}
