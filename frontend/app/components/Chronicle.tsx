"use client";

import { useState } from "react";
import Link from "next/link";

export type ChronicleMoment = {
  id?: string;
  year?: number | string | null;
  title?: string;
  event?: string;
  description?: string;
  place?: string;
  location?: string;
  kind?: string;
  artifact_type?: string;
  category?: string;
  person_name?: string;
  person_id?: string;
  source_story_id?: string | null;
};

export function numericYear(year: ChronicleMoment["year"]): number | null {
  if (year == null || year === "") return null;
  const value = typeof year === "number" ? year : Number(year);
  if (!Number.isFinite(value) || value < 1 || value > 2100) return null;
  return value;
}

export type MomentDraft = {
  title: string;
  description: string;
  place: string;
  year: number | null;
};

export function chronicleSpan(moments: ChronicleMoment[]): {
  first: number | null;
  last: number | null;
  firstPlace: string;
} {
  const dated = moments
    .map((moment) => ({ moment, year: numericYear(moment.year) }))
    .filter((item): item is { moment: ChronicleMoment; year: number } => item.year != null)
    .sort((a, b) => a.year - b.year);
  const first = dated[0];
  const last = dated[dated.length - 1];
  return {
    first: first?.year ?? null,
    last: last?.year ?? null,
    firstPlace: (first?.moment.place || first?.moment.location || "").trim(),
  };
}

function decadeStart(year: number): number {
  return Math.floor(year / 10) * 10;
}

function sceneTitle(moment: ChronicleMoment): string {
  return (moment.event || moment.title || "A moment").trim();
}

function scenePlace(moment: ChronicleMoment): string {
  return (moment.place || moment.location || "").trim();
}

function sceneLabel(moment: ChronicleMoment): string {
  if (moment.kind === "artifact") {
    const kind = (moment.artifact_type || "artifact").replace(/_/g, " ");
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
  const category = (moment.category || "").trim();
  if (!category) return "";
  return category.charAt(0).toUpperCase() + category.slice(1);
}

type Chapter = {
  key: string;
  yearLabel: string;
  title: string;
  moments: ChronicleMoment[];
};

function chaptersOf(moments: ChronicleMoment[]): Chapter[] {
  const ordered = [...moments].sort((a, b) => {
    const ay = numericYear(a.year);
    const by = numericYear(b.year);
    if (ay == null && by == null) return 0;
    if (ay == null) return 1;
    if (by == null) return -1;
    return ay - by;
  });
  const chapters: Chapter[] = [];
  for (const moment of ordered) {
    const year = numericYear(moment.year);
    const key = year == null ? "undated" : String(decadeStart(year));
    const current = chapters[chapters.length - 1];
    if (!current || current.key !== key) {
      chapters.push({
        key,
        yearLabel: year == null ? "—" : String(decadeStart(year)),
        title: year == null ? "Without a year" : `The ${decadeStart(year)}s`,
        moments: [moment],
      });
    } else {
      current.moments.push(moment);
    }
  }
  return chapters;
}

function Scene({
  moment,
  showPerson,
  onSave,
}: {
  moment: ChronicleMoment;
  showPerson: boolean;
  onSave?: (moment: ChronicleMoment, draft: MomentDraft) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const heading = sceneTitle(moment);
  const prose = (moment.description || "").trim();
  const where = scenePlace(moment);
  const label = sceneLabel(moment);
  const artifact = moment.kind === "artifact";
  const shownYear = numericYear(moment.year);

  function openEditor() {
    setTitle(heading === "A moment" ? "" : heading);
    setDescription(moment.description || "");
    setPlace(where);
    setYear(shownYear == null ? "" : String(shownYear));
    setError("");
    setEditing(true);
  }

  async function save() {
    if (!onSave) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Give this moment a title.");
      return;
    }
    const trimmedYear = year.trim();
    let nextYear: number | null = null;
    if (trimmedYear) {
      nextYear = Number(trimmedYear);
      if (!Number.isInteger(nextYear) || nextYear < 1 || nextYear > 2100) {
        setError("Use a year like 1985, or leave it blank.");
        return;
      }
    }
    setSaving(true);
    setError("");
    try {
      await onSave(moment, {
        title: nextTitle,
        description: description.trim(),
        place: place.trim(),
        year: nextYear,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this moment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="relative pt-1">
        <span className="absolute left-1/2 top-1.5 z-10 w-2.5 h-2.5 -translate-x-1/2 rounded-full bg-brass ring-4 ring-mist" />
        <p className="relative z-10 mx-auto mt-6 w-fit bg-mist px-1 font-display text-xl text-brass-deep tabular-nums text-center">
          {shownYear ?? "—"}
        </p>
      </div>
      <article className={`pb-10 ${artifact ? "mb-6 rounded-2xl border border-line bg-white px-5 py-4" : ""}`}>
        {showPerson && moment.person_name && (
          moment.person_id ? (
            <Link
              href={`/timeline/${moment.person_id}`}
              className="text-sm font-semibold text-brass-deep hover:underline"
            >
              {moment.person_name}
            </Link>
          ) : (
            <p className="text-sm font-semibold text-brass-deep">{moment.person_name}</p>
          )
        )}
        {label && (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft mt-1">
            {label}
          </p>
        )}
        {editing ? (
          <div className="mt-2 space-y-3 max-w-xl">
            <label className="block text-sm">
              <span className="text-ink-soft">Title</span>
              <input className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="block text-sm">
              <span className="text-ink-soft">What happened</span>
              <textarea
                className="field mt-1 resize-y"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm">
                <span className="text-ink-soft">Year</span>
                <input
                  className="field mt-1"
                  inputMode="numeric"
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                />
              </label>
              <label className="text-sm">
                <span className="text-ink-soft">Place</span>
                <input className="field mt-1" value={place} onChange={(event) => setPlace(event.target.value)} />
              </label>
            </div>
            {error && <p className="text-sm text-[#9b2c2c]">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="font-display text-2xl sm:text-3xl text-ink leading-snug mt-1">{heading}</h3>
            {prose && prose.toLowerCase() !== heading.toLowerCase() && (
              <p className="text-ink-soft mt-3 leading-relaxed text-base sm:text-lg max-w-xl">{prose}</p>
            )}
            {where && (
              <p className="text-xs uppercase tracking-[0.14em] text-ink-soft mt-3">{where}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
              {moment.source_story_id && (
                <Link
                  href={`/story/${moment.source_story_id}`}
                  className="text-sm font-semibold text-brass-deep hover:underline"
                >
                  Read the story this came from
                </Link>
              )}
              {onSave && moment.id && (
                <button
                  type="button"
                  className="text-sm font-semibold text-ink-soft hover:text-ink"
                  onClick={openEditor}
                >
                  Edit
                </button>
              )}
            </div>
          </>
        )}
      </article>
    </>
  );
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function YearRuler({ moments }: { moments: ChronicleMoment[] }) {
  const years = [
    ...new Set(
      moments
        .map((moment) => numericYear(moment.year))
        .filter((year): year is number => year != null)
    ),
  ].sort((a, b) => a - b);
  if (years.length === 0) return null;
  const min = years[0];
  const max = years[years.length - 1];
  const span = Math.max(max - min, 1);
  let lastLabel = -100;

  return (
    <div className="sticky top-14 md:top-0 z-20 -mx-5 sm:-mx-8 px-5 sm:px-8 py-4 mb-12 border-b border-line bg-mist/90 backdrop-blur">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft mb-3">
          <span>{min}</span>
          <span>Follow the years</span>
          <span>{max}</span>
        </div>
        <div className="relative mx-3 h-14">
          <div className="absolute left-1 right-1 top-1.5 h-px bg-line" />
          {years.map((year, index) => {
            const pos = years.length === 1 ? 50 : ((year - min) / span) * 100;
            const showLabel = index === 0 || index === years.length - 1 || pos - lastLabel > 11;
            if (showLabel) lastLabel = pos;
            return (
              <button
                key={year}
                type="button"
                onClick={() => scrollToId(`year-${year}`)}
                aria-label={`Jump to ${year}`}
                className="absolute top-0 -translate-x-1/2 flex flex-col items-center group"
                style={{ left: `${pos}%` }}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-brass ring-4 ring-mist group-hover:scale-125 transition" />
                {showLabel && (
                  <span className="mt-2 text-[11px] tabular-nums text-ink-soft group-hover:text-ink">
                    {year}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chaptersOf(moments)
            .filter((chapter) => chapter.key !== "undated")
            .map((chapter) => (
              <button
                key={chapter.key}
                type="button"
                onClick={() => scrollToId(`chapter-${chapter.key}`)}
                className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-soft hover:border-brass hover:text-ink"
              >
                {chapter.title}
              </button>
            ))}
          <button
            type="button"
            onClick={() => scrollToId("chapter-now")}
            className="shrink-0 rounded-full border border-line bg-white px-3 py-1 text-xs text-ink-soft hover:border-brass hover:text-ink"
          >
            Present day
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Chronicle({
  moments,
  showPerson = false,
  onSave,
}: {
  moments: ChronicleMoment[];
  showPerson?: boolean;
  onSave?: (moment: ChronicleMoment, draft: MomentDraft) => Promise<void>;
}) {
  const chapters = chaptersOf(moments);
  const seenYears = new Set<number>();

  return (
    <div>
      <YearRuler moments={moments} />
      <div className="max-w-3xl">
        {chapters.map((chapter) => (
          <section key={chapter.key} id={`chapter-${chapter.key}`} className="scroll-mt-40 mb-6">
            <header className="mb-8">
              <p className="font-display text-6xl sm:text-7xl text-ink leading-none">{chapter.yearLabel}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass-deep mt-4">
                Chapter
              </p>
              <h2 className="font-display text-3xl text-ink mt-1">{chapter.title}</h2>
              <div className="mt-4 h-px w-24 bg-brass" />
            </header>
            <div className="relative">
              <div className="absolute left-[2.25rem] sm:left-[3.75rem] top-2 bottom-2 w-px bg-line" />
              <ol>
              {chapter.moments.map((moment, index) => {
                const year = numericYear(moment.year);
                const anchor = year != null && !seenYears.has(year);
                if (year != null) seenYears.add(year);
                return (
                  <li
                    key={moment.id || `${chapter.key}-${index}`}
                    id={anchor ? `year-${year}` : undefined}
                    className="scroll-mt-40 grid grid-cols-[4.5rem_1fr] sm:grid-cols-[7.5rem_1fr] gap-3 sm:gap-6"
                  >
                    <Scene moment={moment} showPerson={showPerson} onSave={onSave} />
                  </li>
                );
              })}
              </ol>
            </div>
          </section>
        ))}
        <div
          id="chapter-now"
          className="scroll-mt-40 grid grid-cols-[4.5rem_1fr] sm:grid-cols-[7.5rem_1fr] gap-3 sm:gap-6 pb-4 mt-4"
        >
          <div className="relative">
            <span className="absolute left-1/2 top-1.5 z-10 w-2.5 h-2.5 -translate-x-1/2 rounded-full bg-stone-2 ring-4 ring-mist" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-soft">
              Present day
            </p>
            <p className="font-display text-2xl text-ink mt-1">This is as far as the stories reach.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
