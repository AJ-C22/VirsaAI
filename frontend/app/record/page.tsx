"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Mic, Square, Upload, Loader2 } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";

type Mode = "idle" | "recording" | "uploading";

export default function RecordStoryPage() {
  const router = useRouter();
  const { apiRoot, vaultId } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [mode, setMode] = useState<Mode>("idle");
  const [personName, setPersonName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    if (mode !== "recording") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [mode]);

  const submitAudio = useCallback(
    async (file: Blob, filename: string) => {
      setError(null);
      setMode("uploading");
      const form = new FormData();
      form.append("file", file, filename);
      if (personName.trim()) form.append("person_name", personName.trim());
      if (vaultId) form.append("vault_id", vaultId);
      form.append("auto_confirm", "true");

      try {
        const res = await fetch(`${apiRoot}/stories/upload`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Upload failed");
        router.push(`/story/${data.story_id}/processing`);
      } catch (e: unknown) {
        setMode("idle");
        setError(e instanceof Error ? e.message : "Upload failed");
      }
    },
    [personName, router, apiRoot, vaultId]
  );

  const submitTranscript = useCallback(async () => {
    if (!transcriptDraft.trim()) {
      setError("Paste a transcript first.");
      return;
    }
    setError(null);
    setMode("uploading");
    const form = new FormData();
    form.append("transcript", transcriptDraft.trim());
    if (personName.trim()) form.append("person_name", personName.trim());
    if (vaultId) form.append("vault_id", vaultId);
    form.append("auto_confirm", "true");

    try {
      const res = await fetch(`${apiRoot}/stories/from-transcript`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Processing failed");
      router.push(`/story/${data.story_id}/processing`);
    } catch (e: unknown) {
      setMode("idle");
      setError(e instanceof Error ? e.message : "Processing failed");
    }
  }, [transcriptDraft, personName, router, apiRoot, vaultId]);

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void submitAudio(blob, "recording.webm");
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setMode("recording");
    } catch {
      setError("Microphone blocked. You can still upload audio or paste a transcript.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const busy = mode === "uploading" || mode === "recording";

  return (
    <Sidebar>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="label-eyebrow mb-3">Capture</p>
        <h1 className="font-display text-4xl md:text-5xl text-ink mb-3 text-balance">
          Record a family story
        </h1>
        <p className="text-ink-soft text-lg max-w-2xl mb-10 leading-relaxed">
          Speak a memory or upload a recording. Virsa writes a lasting biography
          and builds timeline and family connections automatically.
        </p>

        <div className="mb-8 max-w-md">
          <label className="text-xs font-medium text-ink-soft mb-1.5 block">
            Whose story is this?
          </label>
          <input
            className="field"
            value={personName}
            onChange={(e) => setPersonName(e.target.value)}
            disabled={busy}
            placeholder="Optional — e.g. Gurmeet Kaur"
          />
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-[#9b2c2c] max-w-xl">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-8 items-start">
          <div className="lg:col-span-3 surface-panel rounded-3xl p-8 md:p-12">
            {mode === "uploading" ? (
              <div className="flex flex-col items-center text-center py-16">
                <Loader2 className="w-10 h-10 text-brass animate-spin mb-4" />
                <p className="font-display text-2xl text-ink">Starting archive…</p>
                <p className="text-ink-soft mt-2 text-sm">Uploading and queuing processing</p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                {mode === "recording" ? (
                  <>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="w-28 h-28 rounded-full bg-[#8f2f2f] flex items-center justify-center transition hover:scale-[1.03]"
                      aria-label="Stop recording"
                    >
                      <Square className="w-9 h-9 text-white fill-white" />
                    </button>
                    <p className="mt-6 font-display text-3xl tabular-nums text-ink">
                      {Math.floor(seconds / 60).toString().padStart(2, "0")}:
                      {(seconds % 60).toString().padStart(2, "0")}
                    </p>
                    <p className="mt-2 text-ink-soft">Listening… tap to finish</p>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={startRecording}
                      className="w-28 h-28 rounded-full bg-ink flex items-center justify-center transition hover:scale-[1.03] hover:bg-[#2a241c]"
                      aria-label="Start recording"
                    >
                      <Mic className="w-11 h-11 text-[#f3efe6]" />
                    </button>
                    <p className="mt-6 text-lg text-ink-soft">Tap to record</p>
                  </>
                )}

                <div className="w-full border-t border-line my-10" />

                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void submitAudio(f, f.name);
                  }}
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="btn-ghost"
                >
                  <Upload className="h-4 w-4" />
                  Upload audio instead
                </button>

                <button
                  type="button"
                  onClick={() => setShowPaste((v) => !v)}
                  className="mt-6 text-sm text-brass-deep hover:underline"
                >
                  {showPaste ? "Hide transcript" : "Or paste a written transcript"}
                </button>

                {showPaste && (
                  <div className="mt-5 w-full text-left">
                    <textarea
                      value={transcriptDraft}
                      onChange={(e) => setTranscriptDraft(e.target.value)}
                      rows={7}
                      placeholder="Paste the spoken story here…"
                      className="field resize-y"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void submitTranscript()}
                      className="btn-primary mt-3"
                    >
                      Create from transcript
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <aside className="lg:col-span-2 space-y-5">
            <div className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-display text-2xl text-ink mb-4">What happens</h2>
              <ol className="space-y-4 text-sm text-ink-soft">
                <li>
                  <span className="block font-semibold text-ink mb-0.5">1. Transcribe</span>
                  Speech becomes clear English text.
                </li>
                <li>
                  <span className="block font-semibold text-ink mb-0.5">2. Write</span>
                  A warm documentary biography is crafted.
                </li>
                <li>
                  <span className="block font-semibold text-ink mb-0.5">3. Connect</span>
                  People, events, and relationships join your vault.
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-line bg-stone/60 p-6">
              <h2 className="font-semibold text-ink mb-3 text-sm">Helpful prompts</h2>
              <ul className="space-y-2 text-sm text-ink-soft">
                <li>Name people and places clearly</li>
                <li>Mention years or life stages</li>
                <li>Describe how relatives are connected</li>
              </ul>
            </div>
          </aside>
        </div>
      </motion.div>
    </Sidebar>
  );
}
