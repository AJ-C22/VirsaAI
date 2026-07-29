"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { RequireAuth } from "../components/RequireAuth";

type StoryRow = {
  story_id: string;
  person_name?: string;
  summary?: string;
  character_count?: number;
  created_at?: string;
};

export default function StoryLibraryPage() {
  const { apiRoot, vaultId } = useAuth();
  const [stories, setStories] = useState<StoryRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStories() {
      setLoading(true);
      try {
        const q = vaultId ? `?vault_id=${encodeURIComponent(vaultId)}` : "";
        const res = await fetch(`${apiRoot}/story_library${q}`);
        const data = await res.json();
        setStories(Array.isArray(data) ? data : []);
      } catch {
        setStories([]);
      } finally {
        setLoading(false);
      }
    }
    void loadStories();
  }, [apiRoot, vaultId]);

  const filtered = stories.filter((s) =>
    (s.person_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <RequireAuth>
    <DashboardLayout>
      <p className="label-eyebrow mb-3">Archive</p>
      <h1 className="font-display text-4xl text-ink mb-8">Story library</h1>

      <div className="relative mb-8 max-w-lg">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
        <input
          type="text"
          placeholder="Search by name…"
          className="field !pl-11"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-ink-soft mb-8">Loading stories…</p>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((story) => (
          <Link
            key={story.story_id}
            href={`/story/${story.story_id}`}
            className="block rounded-2xl border border-line bg-white p-5 hover:border-brass/40 transition"
          >
            <div className="flex items-center gap-3 mb-3">
              <BookOpen className="h-5 w-5 text-brass shrink-0" />
              <h2 className="font-display text-xl text-ink leading-tight">
                {story.person_name || "Untitled"}
              </h2>
            </div>
            <p className="text-ink-soft text-sm line-clamp-3 leading-relaxed">
              {story.summary || "No summary yet."}
            </p>
            <div className="mt-4 text-xs text-ink-soft">
              {story.created_at
                ? new Date(story.created_at).toLocaleDateString()
                : "—"}
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line p-10 text-center mt-4">
          <p className="text-ink-soft mb-4">No stories found.</p>
          <Link href="/record" className="btn-primary">
            Record a story
          </Link>
        </div>
      )}
    </DashboardLayout>
    </RequireAuth>
  );
}
