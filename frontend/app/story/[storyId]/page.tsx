"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  Users,
  Mic,
  MapPin,
  Briefcase,
  ArrowRight,
  Printer,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";
import { RequireAuth } from "../../components/RequireAuth";
import { useAuth } from "../../lib/auth";

type FullStory = {
  id: string;
  person_name: string;
  story: string;
  summary?: string;
  timeline_events?: Array<{
    id: string;
    year?: number;
    event?: string;
    title?: string;
    description?: string;
  }>;
  occupations?: Array<{ role: string; start_year?: number; location?: string }>;
  locations?: Array<{ place: string; purpose?: string }>;
  extracted_data?: {
    family_members?: Array<{
      name: string;
      relationship?: string;
    }>;
    themes?: string[];
  };
  updated_at?: string;
};

export default function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const { apiRoot } = useAuth();
  const [story, setStory] = useState<FullStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) return;
    async function load() {
      try {
        const res = await fetch(`${apiRoot}/story/${storyId}/full`);
        if (!res.ok) throw new Error("Story not found");
        setStory(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    void load();
  }, [storyId, apiRoot]);

  if (error) {
    return (
      <RequireAuth>
        <DashboardLayout>
          <p className="text-[#9b2c2c]">{error}</p>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  if (!story) {
    return (
      <RequireAuth>
        <DashboardLayout>
          <p className="text-ink-soft">Loading story…</p>
        </DashboardLayout>
      </RequireAuth>
    );
  }

  const family = story.extracted_data?.family_members || [];
  const themes = story.extracted_data?.themes || [];
  const events = story.timeline_events || [];

  return (
    <RequireAuth>
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="print-story"
      >
        <p className="label-eyebrow mb-3">Archived oral history</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink mb-3 text-balance">
          {story.person_name}
        </h1>
        {story.summary && (
          <p className="text-ink-soft text-lg mb-8 max-w-3xl leading-relaxed">
            {story.summary}
          </p>
        )}

        <div className="flex flex-wrap gap-3 mb-10 no-print">
          <Link href={`/timeline/${storyId}`} className="btn-accent">
            <Calendar size={18} /> View timeline
          </Link>
          <Link href="/family" className="btn-ghost">
            <Users size={18} /> Family tree
          </Link>
          <Link href="/record" className="btn-ghost">
            <Mic size={18} /> Add another
          </Link>
          <button type="button" className="btn-ghost" onClick={() => window.print()}>
            <Printer size={18} /> Export PDF
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <article className="surface-panel rounded-3xl p-8 md:p-10">
              <div className="font-display text-lg md:text-xl text-ink leading-[1.75] space-y-5">
                {story.story?.split("\n").map((paragraph, idx) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
                    return (
                      <h2
                        key={idx}
                        className="font-display text-2xl md:text-3xl text-ink mt-8 mb-2"
                      >
                        {trimmed.replace(/^#{2,3}\s+/, "")}
                      </h2>
                    );
                  }
                  return <p key={idx}>{paragraph}</p>;
                })}
              </div>
            </article>
            <p className="mt-4 text-xs text-ink-soft text-right">
              Updated{" "}
              {story.updated_at
                ? new Date(story.updated_at).toLocaleDateString()
                : "—"}
            </p>
          </div>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-semibold text-ink mb-3 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-brass" />
                Timeline
              </h3>
              {events.length === 0 ? (
                <p className="text-sm text-ink-soft">No events yet.</p>
              ) : (
                <ul className="space-y-3">
                  {events.slice(0, 8).map((ev) => (
                    <li key={ev.id} className="text-sm">
                      <div className="font-medium text-ink">
                        {ev.year ?? "—"} · {ev.event || ev.title}
                      </div>
                      {ev.description && (
                        <p className="text-ink-soft mt-0.5 line-clamp-2">
                          {ev.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href={`/timeline/${storyId}`}
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brass-deep hover:underline"
              >
                Full timeline <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            <section className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-semibold text-ink mb-3 flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-brass" />
                Family mentioned
              </h3>
              {family.length === 0 ? (
                <p className="text-sm text-ink-soft">No relatives extracted.</p>
              ) : (
                <ul className="space-y-2">
                  {family.map((m, i) => (
                    <li key={`${m.name}-${i}`} className="text-sm">
                      <span className="font-medium text-ink">{m.name}</span>
                      {m.relationship && (
                        <span className="text-ink-soft"> · {m.relationship}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <Link
                href="/family"
                className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brass-deep hover:underline"
              >
                Open family tree <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </section>

            {(!!story.locations?.length || !!story.occupations?.length) && (
              <section className="rounded-2xl border border-line bg-white p-5 space-y-4">
                {!!story.locations?.length && (
                  <div>
                    <h3 className="font-semibold text-ink mb-2 flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-brass" /> Places
                    </h3>
                    <ul className="text-sm text-ink-soft space-y-1">
                      {story.locations.map((l, i) => (
                        <li key={i}>
                          {l.place}
                          {l.purpose ? ` (${l.purpose})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!!story.occupations?.length && (
                  <div>
                    <h3 className="font-semibold text-ink mb-2 flex items-center gap-2 text-sm">
                      <Briefcase className="w-4 h-4 text-brass" /> Work
                    </h3>
                    <ul className="text-sm text-ink-soft space-y-1">
                      {story.occupations.map((o, i) => (
                        <li key={i}>
                          {o.role}
                          {o.start_year ? ` · ${o.start_year}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {themes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {themes.map((t) => (
                  <span
                    key={t}
                    className="text-xs px-3 py-1 rounded-lg bg-stone text-ink-soft border border-line"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </aside>
        </div>
      </motion.div>
    </DashboardLayout>
    </RequireAuth>
  );
}
