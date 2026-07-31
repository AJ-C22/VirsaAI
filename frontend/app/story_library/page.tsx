"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Search, Trash2 } from "lucide-react";
import DashboardLayout from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";
import { RequireAuth } from "../components/RequireAuth";
import { ConfirmDeleteStoryModal } from "../components/ConfirmDeleteStoryModal";

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
  const [pendingDelete, setPendingDelete] = useState<StoryRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/story/${pendingDelete.story_id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.detail === "string" ? data.detail : "Could not delete story"
        );
      }
      setStories((prev) =>
        prev.filter((s) => s.story_id !== pendingDelete.story_id)
      );
      setPendingDelete(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

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

        {error && (
          <p className="mb-4 text-sm text-[#9b2c2c] rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-ink-soft mb-8">Loading stories…</p>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((story) => (
            <div
              key={story.story_id}
              className="rounded-2xl border border-line bg-white p-5 hover:border-brass/40 transition flex flex-col"
            >
              <Link href={`/story/${story.story_id}`} className="block flex-1">
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
              <button
                type="button"
                className="mt-4 self-start text-sm text-[#9b2c2c] hover:underline inline-flex items-center gap-1.5 disabled:opacity-50"
                disabled={deleting}
                onClick={() => setPendingDelete(story)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center mt-4">
            <p className="text-ink-soft mb-4">No stories found.</p>
            <Link href="/record" className="btn-primary">
              Record a story
            </Link>
          </div>
        )}

        <ConfirmDeleteStoryModal
          open={Boolean(pendingDelete)}
          storyName={pendingDelete?.person_name || "Untitled"}
          busy={deleting}
          onCancel={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => void confirmDelete()}
        />
      </DashboardLayout>
    </RequireAuth>
  );
}
