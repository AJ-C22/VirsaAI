"use client";

import { useCallback, useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { RequireAuth } from "../components/RequireAuth";
import { useAuth } from "../lib/auth";

type Suggestion = {
  id: string;
  story_id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: string;
  created_at?: string;
};

export default function SuggestionsPage() {
  const { apiFetch, authHeaders, apiRoot, vaultId } = useAuth();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!vaultId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/suggestions?status=pending");
      if (!res.ok) throw new Error("Could not load suggestions");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, vaultId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (id: string, action: "confirm" | "reject") => {
    const res = await fetch(`${apiRoot}/suggestions/${id}/${action}`, {
      method: "POST",
      headers: { ...authHeaders() },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(
        typeof data.detail === "string" ? data.detail : `Could not ${action}`
      );
      return;
    }
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const summarize = (s: Suggestion) => {
    const p = s.payload || {};
    if (s.kind === "relationship" || s.kind === "family_member") {
      return `${p.from_name || p.name || "Someone"} → ${p.to_name || p.related_to || ""} (${p.type || p.relationship || s.kind})`;
    }
    if (s.kind === "timeline_event" || s.kind === "event") {
      return `${p.year || "?"} — ${p.title || p.event || "Event"}`;
    }
    return JSON.stringify(p).slice(0, 120);
  };

  return (
    <RequireAuth>
      <Sidebar>
        <p className="label-eyebrow mb-3">AI review queue</p>
        <h1 className="font-display text-4xl text-ink mb-3">Suggestions</h1>
        <p className="text-ink-soft mb-8 max-w-2xl leading-relaxed">
          Confirm or reject people, relationships, and events extracted from new
          oral histories before they settle into your vault.
        </p>

        {error && <p className="text-sm text-[#9b2c2c] mb-4">{error}</p>}

        {loading ? (
          <p className="text-ink-soft">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center">
            <Sparkles className="w-10 h-10 text-brass mx-auto mb-3" />
            <p className="text-ink font-medium mb-2">Nothing to review</p>
            <p className="text-sm text-ink-soft max-w-md mx-auto">
              New recordings will queue uncertain facts here when auto-confirm is
              off.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((s) => (
              <li
                key={s.id}
                className="rounded-2xl border border-line bg-white p-5 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-brass font-semibold mb-1">
                    {s.kind}
                  </p>
                  <p className="text-ink font-medium">{summarize(s)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => void act(s.id, "reject")}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void act(s.id, "confirm")}
                  >
                    Confirm
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Sidebar>
    </RequireAuth>
  );
}
