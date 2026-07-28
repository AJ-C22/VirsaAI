"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, ArrowUpRight, BookOpen, Users, Layers } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";

type Dash = {
  vault: { name: string; plan: string; kinship_system?: string };
  counts: {
    stories: number;
    people: number;
    events: number;
    artifacts: number;
    shared_memories: number;
  };
  quota: { used?: number; limit?: number | null };
  recent_stories: Array<{ id: string; title?: string; summary?: string }>;
  recent_events: Array<{ year?: number; title: string }>;
};

export default function Dashboard() {
  const { vaultId, apiRoot, user } = useAuth();
  const [data, setData] = useState<Dash | null>(null);

  useEffect(() => {
    const id = vaultId || "00000000-0000-0000-0000-000000000001";
    fetch(`${apiRoot}/dashboard?vault_id=${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [vaultId, apiRoot]);

  const c = data?.counts;
  const quotaLabel =
    data?.quota?.limit == null
      ? `${data?.quota?.used ?? 0} stories`
      : `${data?.quota?.used ?? 0} of ${data?.quota?.limit} stories`;

  const greeting = user?.display_name || user?.email?.split("@")[0] || "there";

  return (
    <Sidebar>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <div>
            <p className="label-eyebrow mb-3">
              {data?.vault?.name || "Family vault"}
              {data?.vault?.plan ? ` · ${data.vault.plan}` : ""}
            </p>
            <h1 className="font-display text-4xl md:text-5xl text-ink text-balance">
              Hello, {greeting}
            </h1>
            <p className="text-ink-soft mt-3 max-w-xl leading-relaxed">
              Your living archive of oral histories, people, and shared memories.
            </p>
          </div>
          <Link href="/record" className="btn-accent">
            <Mic className="w-4 h-4" />
            Record a story
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {[
            { label: "Stories", value: c?.stories ?? "—", href: "/story_library" },
            { label: "People", value: c?.people ?? "—", href: "/family" },
            { label: "Events", value: c?.events ?? "—", href: "/timeline_home" },
            { label: "Shared", value: c?.shared_memories ?? "—", href: "/memories" },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-line bg-white/80 px-5 py-4 hover:border-brass/50 transition group"
            >
              <div className="font-display text-3xl text-ink">{s.value}</div>
              <div className="text-xs uppercase tracking-wider text-ink-soft mt-1 flex items-center gap-1">
                {s.label}
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition" />
              </div>
            </Link>
          ))}
        </div>

        <div className="rounded-2xl border border-line bg-stone/50 px-5 py-4 mb-10 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-soft">
            Plan usage: <span className="text-ink font-medium">{quotaLabel}</span>
          </p>
          <Link href="/pricing" className="text-sm font-semibold text-brass-deep hover:underline">
            View plans
          </Link>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <section className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl text-ink flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brass" />
                Recent stories
              </h2>
              <Link href="/story_library" className="text-sm text-brass-deep hover:underline">
                All stories
              </Link>
            </div>
            {!data?.recent_stories?.length ? (
              <div className="rounded-2xl border border-dashed border-line p-8 text-center">
                <p className="text-ink-soft mb-4">No stories yet — start with one memory.</p>
                <Link href="/record" className="btn-primary">
                  Record your first story
                </Link>
              </div>
            ) : (
              <ul className="space-y-3">
                {data.recent_stories.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/story/${s.id}`}
                      className="block rounded-2xl border border-line bg-white px-5 py-4 hover:border-brass/40 transition"
                    >
                      <div className="font-semibold text-ink">{s.title || "Untitled"}</div>
                      {s.summary && (
                        <p className="text-sm text-ink-soft mt-1 line-clamp-2 leading-relaxed">
                          {s.summary}
                        </p>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="lg:col-span-2 space-y-6">
            <div>
              <h2 className="font-display text-2xl text-ink mb-4">Timeline</h2>
              {!data?.recent_events?.length ? (
                <p className="text-sm text-ink-soft">
                  Events appear after you archive a story.
                </p>
              ) : (
                <ul className="space-y-3 border-l border-line pl-4">
                  {data.recent_events.map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-brass" />
                      <div className="text-xs font-semibold text-brass-deep tabular-nums">
                        {e.year ?? "—"}
                      </div>
                      <div className="text-sm text-ink mt-0.5">{e.title}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-2xl border border-line bg-white p-5 space-y-3">
              <Link href="/family" className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-brass-deep">
                <Users className="w-4 h-4 text-brass" /> Family tree
              </Link>
              <Link href="/memories" className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-brass-deep">
                <Layers className="w-4 h-4 text-brass" /> Shared memories
              </Link>
            </div>
          </section>
        </div>
      </motion.div>
    </Sidebar>
  );
}
