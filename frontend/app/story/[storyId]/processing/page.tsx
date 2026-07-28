"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, XCircle } from "lucide-react";
import Sidebar from "../../../components/DashboardLayout";
import { useAuth } from "../../../lib/auth";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  transcribing: "Transcribing speech",
  writing: "Writing the biography",
  extracting: "Finding people & events",
  saving: "Saving to your vault",
  completed: "Complete",
  failed: "Failed",
};

type Status = {
  status: string;
  stage?: string;
  progress?: number;
  error_message?: string;
  job_error?: string;
};

export default function ProcessingPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const router = useRouter();
  const { apiRoot } = useAuth();
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${apiRoot}/story/${storyId}/status`);
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
  }, [storyId, router, apiRoot]);

  const failed = status?.status === "failed";
  const progress = Math.round((status?.progress || 0) * 100);
  const stage = status?.stage || "queued";

  return (
    <Sidebar>
      <div className="min-h-[70vh] flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full text-center"
        >
          {failed ? (
            <XCircle className="w-12 h-12 text-[#9b2c2c] mx-auto mb-5" />
          ) : (
            <Loader2 className="w-12 h-12 text-brass mx-auto mb-5 animate-spin" />
          )}

          <h1 className="font-display text-3xl md:text-4xl text-ink mb-3">
            {failed ? "We couldn’t finish this story" : "Preserving this memory"}
          </h1>
          <p className="text-ink-soft mb-8 leading-relaxed">
            {failed
              ? status?.error_message ||
                status?.job_error ||
                "Try again with a clearer recording or pasted transcript."
              : "Turning spoken words into a written history, timeline, and family connections."}
          </p>

          {!failed && (
            <>
              <div className="h-1.5 rounded-full bg-stone-2 overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-brass"
                  initial={{ width: "4%" }}
                  animate={{ width: `${Math.max(progress, 6)}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
              <p className="text-sm font-medium text-brass-deep">
                {STAGE_LABELS[stage] || stage}
              </p>
              <p className="text-xs text-ink-soft mt-2">{progress}%</p>
            </>
          )}

          {failed && (
            <button
              type="button"
              onClick={() => router.push("/record")}
              className="btn-primary mt-4"
            >
              Try again
            </button>
          )}
        </motion.div>
      </div>
    </Sidebar>
  );
}
