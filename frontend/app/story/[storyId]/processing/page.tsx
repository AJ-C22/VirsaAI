"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import Sidebar from "../../../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  transcribing: "Transcribing & translating speech",
  writing: "Writing the family biography",
  extracting: "Finding timeline events & relatives",
  saving: "Saving to your family archive",
  completed: "Complete",
  failed: "Something went wrong",
};

type Status = {
  story_id: string;
  status: string;
  stage?: string;
  progress?: number;
  error_message?: string;
  job_error?: string;
};

export default function ProcessingPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const res = await fetch(`${API_ROOT}/story/${storyId}/status`);
        if (!res.ok) return;
        const data = (await res.json()) as Status;
        if (cancelled) return;
        setStatus(data);
        if (data.status === "ready") {
          router.replace(`/story/${storyId}`);
        }
      } catch {
        /* keep polling */
      }
    };

    void tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [storyId, router]);

  const failed = status?.status === "failed";
  const progress = Math.round((status?.progress || 0) * 100);
  const stage = status?.stage || "queued";
  const label = STAGE_LABELS[stage] || stage;

  return (
    <Sidebar>
      <div className="min-h-screen bg-[#FFFCF5] flex items-center justify-center px-6">
        <div className="max-w-lg w-full text-center">
          {failed ? (
            <XCircle className="w-14 h-14 text-red-600 mx-auto mb-5" />
          ) : status?.status === "ready" ? (
            <CheckCircle2 className="w-14 h-14 text-emerald-700 mx-auto mb-5" />
          ) : (
            <Loader2 className="w-14 h-14 text-[#B8860B] mx-auto mb-5 animate-spin" />
          )}

          <h1 className="text-3xl font-bold text-[#4C3B23] mb-3">
            {failed ? "We couldn’t finish this story" : "Preserving this memory"}
          </h1>
          <p className="text-[#6B5B3D]/75 mb-8 leading-relaxed">
            {failed
              ? status?.error_message ||
                status?.job_error ||
                "The processing job failed. Try again with a clearer recording."
              : "VirsaAI is turning spoken words into a written history, timeline, and family connections."}
          </p>

          {!failed && (
            <>
              <div className="h-2 rounded-full bg-[#F0E4CF] overflow-hidden mb-3">
                <div
                  className="h-full bg-[#B8860B] transition-all duration-500"
                  style={{ width: `${Math.max(progress, 6)}%` }}
                />
              </div>
              <p className="text-sm font-medium text-[#8B6914]">{label}</p>
              <p className="text-xs text-[#6B5B3D]/50 mt-2">{progress}%</p>
            </>
          )}

          {failed && (
            <button
              type="button"
              onClick={() => router.push("/record")}
              className="mt-6 px-6 py-3 rounded-xl bg-[#4C3B23] text-white font-medium"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
