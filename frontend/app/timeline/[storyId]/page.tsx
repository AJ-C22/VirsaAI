"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Sidebar from "../../components/DashboardLayout";
import Chronicle, {
  chronicleSpan,
  type ChronicleMoment,
  type MomentDraft,
} from "../../components/Chronicle";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../lib/auth";

type TimelinePayload = {
  person_name?: string;
  events: ChronicleMoment[];
};

export default function TimelineDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { apiRoot, authHeaders, apiFetch, vaults, vaultId } = useAuth();
  const canEdit = (vaults.find((vault) => vault.id === vaultId)?.role ?? "owner") !== "viewer";
  const [data, setData] = useState<TimelinePayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${apiRoot}/timeline/${storyId}`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) throw new Error("Failed");
        const json = await res.json();
        if (cancelled) return;
        if (Array.isArray(json)) {
          setData({ events: json });
        } else {
          setData({
            person_name: json.person_name,
            events: json.events || [],
          });
        }
      } catch {
        if (!cancelled) setError("Could not load this timeline.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storyId, apiRoot, authHeaders]);

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
    setData((current) =>
      current
        ? {
            ...current,
            events: current.events.map((event) =>
              event.id === moment.id ? { ...event, ...saved } : event
            ),
          }
        : current
    );
  }

  const events = data?.events ?? [];
  const span = chronicleSpan(events);
  const name = data?.person_name || "This life";
  const opening =
    span.first && span.last && span.first !== span.last
      ? `From ${span.first}${span.firstPlace ? ` in ${span.firstPlace}` : ""} to ${span.last}.`
      : span.first
        ? `${span.firstPlace ? `${span.first} in ${span.firstPlace}.` : `${span.first}.`}`
        : "The years are still unrecorded.";

  return (
    <RequireAuth>
      <Sidebar>
        <Link
          href="/timeline_home"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> The family story
        </Link>

        {loading && <p className="text-ink-soft">Opening this life…</p>}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#9b2c2c]">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <p className="label-eyebrow mb-3">A life</p>
            <h1 className="font-display text-5xl md:text-6xl text-ink mb-4 text-balance max-w-3xl">
              {name}
            </h1>
            <p className="text-lg text-ink-soft leading-relaxed max-w-xl mb-2">
              {opening}{" "}
              {events.length} moment{events.length === 1 ? "" : "s"}
              {events.length === 1 ? " is" : " are"} written here.
            </p>

            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center max-w-xl mt-8">
                <p className="text-ink-soft mb-4">
                  No events yet for this person. Archive a story to begin the chronicle.
                </p>
                <Link href="/record" className="btn-primary">
                  Record a story
                </Link>
              </div>
            ) : (
              <Chronicle moments={events} onSave={canEdit ? saveMoment : undefined} />
            )}
          </>
        )}
      </Sidebar>
    </RequireAuth>
  );
}
