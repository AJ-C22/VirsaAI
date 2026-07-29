"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Sidebar from "../../components/DashboardLayout";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../lib/auth";

type TimelineEvent = {
  id?: string;
  year?: number | string;
  title?: string;
  event?: string;
  description?: string;
  place?: string;
  location?: string;
};

type TimelinePayload = {
  person_name?: string;
  events: TimelineEvent[];
};

export default function TimelineDetailPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { apiRoot } = useAuth();
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
        const res = await fetch(`${apiRoot}/timeline/${storyId}`);
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
  }, [storyId, apiRoot]);

  return (
    <RequireAuth>
      <Sidebar>
        <Link
          href="/timeline_home"
          className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> All timelines
        </Link>

        {loading && <p className="text-ink-soft">Loading timeline…</p>}

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#9b2c2c]">
            {error}
          </div>
        )}

        {!loading && !error && data && (
          <>
            <p className="label-eyebrow mb-3">Life timeline</p>
            <h1 className="font-display text-4xl md:text-5xl text-ink mb-2 text-balance">
              {data.person_name || "Timeline"}
            </h1>
            <p className="text-ink-soft mb-10">
              {data.events.length} confirmed event
              {data.events.length === 1 ? "" : "s"}
            </p>

            {data.events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line p-10 text-center">
                <p className="text-ink-soft mb-4">
                  No events yet for this person. Archive a story to fill the line.
                </p>
                <Link href="/record" className="btn-primary">
                  Record a story
                </Link>
              </div>
            ) : (
              <ol className="relative border-l border-line ml-3 space-y-8">
                {data.events.map((evt, idx) => (
                  <li key={evt.id || idx} className="relative pl-8">
                    <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-brass ring-4 ring-mist" />
                    <div className="text-xs font-semibold text-brass-deep tabular-nums mb-1">
                      {evt.year ?? "—"}
                    </div>
                    <h2 className="font-display text-2xl text-ink leading-snug">
                      {evt.event || evt.title}
                    </h2>
                    {evt.title && evt.event && evt.title !== evt.event && (
                      <p className="text-sm text-ink-soft mt-1 italic">{evt.title}</p>
                    )}
                    {evt.description && (
                      <p className="text-ink-soft mt-2 leading-relaxed max-w-2xl">
                        {evt.description}
                      </p>
                    )}
                    {(evt.place || evt.location) && (
                      <p className="text-xs text-ink-soft mt-2">
                        {evt.place || evt.location}
                      </p>
                    )}
                  </li>
                ))}
                <li className="relative pl-8 pb-2">
                  <span className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-stone-2 ring-4 ring-mist" />
                  <p className="text-xs uppercase tracking-[0.16em] text-ink-soft">
                    Present day
                  </p>
                </li>
              </ol>
            )}
          </>
        )}
      </Sidebar>
    </RequireAuth>
  );
}
