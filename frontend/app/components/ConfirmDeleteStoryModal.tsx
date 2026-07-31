"use client";

import { Trash2, X } from "lucide-react";

type Props = {
  open: boolean;
  storyName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteStoryModal({
  open,
  storyName,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-story-title"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        className="bg-white rounded-2xl border border-line shadow-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2
            id="delete-story-title"
            className="font-display text-2xl text-ink leading-tight"
          >
            Delete this story?
          </h2>
          <button
            type="button"
            className="p-1.5 rounded-lg text-ink-soft hover:bg-stone"
            onClick={onCancel}
            disabled={busy}
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-ink-soft text-sm leading-relaxed mb-2">
          You’re about to permanently delete{" "}
          <span className="font-medium text-ink">
            “{storyName || "Untitled"}”
          </span>
          .
        </p>
        <p className="text-ink-soft text-sm leading-relaxed mb-6">
          This also removes its timeline events and family links created from
          this recording. People kept by other stories stay on the tree. This
          cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-ghost flex-1"
            disabled={busy}
            onClick={onCancel}
          >
            Keep story
          </button>
          <button
            type="button"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white bg-[#9b2c2c] hover:bg-[#822424] disabled:opacity-60"
            disabled={busy}
            onClick={onConfirm}
          >
            <Trash2 className="w-4 h-4" />
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
