"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Users,
  Mic,
  MapPin,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "../../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type FullStory = {
  id: string;
  person_name: string;
  story: string;
  summary?: string;
  subject_person_id?: string;
  timeline_events?: Array<{
    id: string;
    year?: number;
    event?: string;
    title?: string;
    description?: string;
    location?: string;
    category?: string;
  }>;
  occupations?: Array<{ role: string; start_year?: number; location?: string }>;
  locations?: Array<{ place: string; purpose?: string }>;
  extracted_data?: {
    family_members?: Array<{
      name: string;
      relationship?: string;
      notes?: string;
    }>;
    themes?: string[];
  };
  updated_at?: string;
};

export default function StoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const [story, setStory] = useState<FullStory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!storyId) return;
    async function load() {
      try {
        const res = await fetch(`${API_ROOT}/story/${storyId}/full`);
        if (!res.ok) throw new Error("Story not found");
        setStory(await res.json());
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
    }
    void load();
  }, [storyId]);

  if (error) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center text-red-800">{error}</div>
      </DashboardLayout>
    );
  }

  if (!story) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center text-lg text-[#6B5B3D]">
          Loading story…
        </div>
      </DashboardLayout>
    );
  }

  const family = story.extracted_data?.family_members || [];
  const themes = story.extracted_data?.themes || [];
  const events = story.timeline_events || [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F7F1E5] px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <p className="text-sm font-medium text-[#B8860B] mb-2 tracking-wide">
            ARCHIVED ORAL HISTORY
          </p>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-[#4C3B23] tracking-tight mb-3">
            {story.person_name}
          </h1>
          {story.summary && (
            <p className="text-[#7B6A4B] text-lg mb-8 max-w-3xl leading-relaxed">
              {story.summary}
            </p>
          )}

          <div className="flex flex-wrap gap-3 mb-10">
            <Link
              href={`/timeline/${storyId}`}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C8A56A] text-white font-medium shadow hover:bg-[#b8965f] transition"
            >
              <Calendar size={18} /> View timeline
            </Link>
            <Link
              href="/family"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#DCCDB2] shadow hover:shadow-md transition text-[#5D4A2E]"
            >
              <Users size={18} /> Open family tree
            </Link>
            <Link
              href="/record"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white border border-[#DCCDB2] shadow hover:shadow-md transition text-[#5D4A2E]"
            >
              <Mic size={18} /> Add another story
            </Link>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-[#FFF7EB] border border-[#E5D6BB] rounded-2xl shadow-sm p-8 md:p-10">
                <article className="prose max-w-none text-[#4A3A25] leading-relaxed font-serif text-lg">
                  {story.story?.split("\n").map((paragraph, idx) => {
                    const trimmed = paragraph.trim();
                    if (!trimmed) return null;
                    if (trimmed.startsWith("### ")) {
                      return (
                        <h2
                          key={idx}
                          className="text-2xl md:text-3xl font-bold text-[#4C3B23] mt-10 mb-4 font-serif"
                        >
                          {trimmed.replace("### ", "")}
                        </h2>
                      );
                    }
                    if (trimmed.startsWith("## ")) {
                      return (
                        <h2
                          key={idx}
                          className="text-2xl md:text-3xl font-bold text-[#4C3B23] mt-10 mb-4 font-serif"
                        >
                          {trimmed.replace("## ", "")}
                        </h2>
                      );
                    }
                    return (
                      <p key={idx} className="mb-5">
                        {paragraph}
                      </p>
                    );
                  })}
                </article>
              </div>
              <div className="mt-4 text-sm text-[#7C6A50] italic text-right">
                Last updated:{" "}
                {story.updated_at
                  ? new Date(story.updated_at).toLocaleDateString()
                  : "N/A"}
              </div>
            </div>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-[#E5D6BB] bg-white p-5">
                <h3 className="font-semibold text-[#4C3B23] mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#B8860B]" />
                  Timeline extracted
                </h3>
                {events.length === 0 ? (
                  <p className="text-sm text-[#7B6A4B]">No events yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {events.slice(0, 8).map((ev) => (
                      <li key={ev.id} className="text-sm">
                        <div className="font-medium text-[#4C3B23]">
                          {ev.year ?? "—"} · {ev.event || ev.title}
                        </div>
                        {ev.description && (
                          <p className="text-[#7B6A4B] mt-0.5 line-clamp-2">
                            {ev.description}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href={`/timeline/${storyId}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#B8860B] hover:underline"
                >
                  Full timeline <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </section>

              <section className="rounded-2xl border border-[#E5D6BB] bg-white p-5">
                <h3 className="font-semibold text-[#4C3B23] mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#B8860B]" />
                  Family mentioned
                </h3>
                {family.length === 0 ? (
                  <p className="text-sm text-[#7B6A4B]">No relatives extracted.</p>
                ) : (
                  <ul className="space-y-2">
                    {family.map((m, i) => (
                      <li key={`${m.name}-${i}`} className="text-sm">
                        <span className="font-medium text-[#4C3B23]">{m.name}</span>
                        {m.relationship && (
                          <span className="text-[#7B6A4B]"> · {m.relationship}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                <Link
                  href="/family"
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#B8860B] hover:underline"
                >
                  Open family tree <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </section>

              {(story.locations?.length || story.occupations?.length) && (
                <section className="rounded-2xl border border-[#E5D6BB] bg-white p-5 space-y-4">
                  {!!story.locations?.length && (
                    <div>
                      <h3 className="font-semibold text-[#4C3B23] mb-2 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#B8860B]" /> Places
                      </h3>
                      <ul className="text-sm text-[#7B6A4B] space-y-1">
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
                      <h3 className="font-semibold text-[#4C3B23] mb-2 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[#B8860B]" /> Work
                      </h3>
                      <ul className="text-sm text-[#7B6A4B] space-y-1">
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
                      className="text-xs px-3 py-1 rounded-full bg-[#FFF1D6] text-[#8B6914] border border-[#F0E0B8]"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
