"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Mic,
  Square,
  FileAudio,
  Loader2,
  Sparkles,
} from "lucide-react";
import Sidebar from "../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type Mode = "idle" | "recording" | "uploading" | "done";

export default function RecordStoryPage() {
  const router = useRouter();
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
      form.append("auto_confirm", "true");

      try {
        const res = await fetch(`${API_ROOT}/stories/upload`, {
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
    [personName, router]
  );

  const submitTranscript = useCallback(async () => {
    if (!transcriptDraft.trim()) {
      setError("Paste an oral history transcript first.");
      return;
    }
    setError(null);
    setMode("uploading");
    const form = new FormData();
    form.append("transcript", transcriptDraft.trim());
    if (personName.trim()) form.append("person_name", personName.trim());
    form.append("auto_confirm", "true");

    try {
      const res = await fetch(`${API_ROOT}/stories/from-transcript`, {
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
  }, [transcriptDraft, personName, router]);

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
      setError("Microphone access was denied. You can still upload an audio file.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setMode("idle");
  };

  const onFile = (file: File | undefined) => {
    if (!file) return;
    void submitAudio(file, file.name);
  };

  const busy = mode === "uploading" || mode === "recording";

  return (
    <Sidebar>
      <div className="min-h-screen bg-[#FFFCF5] text-[#6B5B3D]">
        <main className="max-w-5xl mx-auto px-8 py-12">
          <p className="text-sm font-medium tracking-wide text-[#B8860B] mb-3">
            ORAL HISTORY → ARCHIVE
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-[#4C3B23] mb-3">
            Record a family story
          </h1>
          <p className="text-lg text-[#6B5B3D]/75 max-w-2xl mb-10 leading-relaxed">
            Speak a memory or upload a recording. VirsaAI transcribes and
            translates it, writes a lasting biography, and builds timeline and
            family-tree suggestions automatically.
          </p>

          <div className="mb-8">
            <label className="block text-sm font-medium mb-2 text-[#6B5B3D]">
              Whose story is this? (optional)
            </label>
            <input
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              disabled={busy}
              placeholder="e.g. Gurmeet Kaur"
              className="w-full max-w-md rounded-xl border border-[#E8D9C0] bg-white px-4 py-3 outline-none focus:border-[#D4AF37]"
            />
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="grid md:grid-cols-5 gap-8">
            <div className="md:col-span-3 rounded-3xl border border-[#F5E6D3] bg-white p-10 shadow-sm">
              {mode === "uploading" ? (
                <div className="flex flex-col items-center text-center py-16">
                  <Loader2 className="w-12 h-12 text-[#B8860B] animate-spin mb-4" />
                  <p className="text-xl font-semibold text-[#4C3B23]">
                    Starting your archive…
                  </p>
                  <p className="text-[#6B5B3D]/70 mt-2">
                    Uploading and queuing transcription
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  {mode === "recording" ? (
                    <>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="w-28 h-28 rounded-full bg-[#B33A3A] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      >
                        <Square className="w-10 h-10 text-white fill-white" />
                      </button>
                      <p className="mt-6 text-2xl font-semibold text-[#4C3B23] tabular-nums">
                        {Math.floor(seconds / 60)
                          .toString()
                          .padStart(2, "0")}
                        :{(seconds % 60).toString().padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-[#6B5B3D]/70">
                        Recording… tap to finish
                      </p>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startRecording}
                        className="w-28 h-28 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-lg hover:scale-105 transition-transform"
                      >
                        <Mic className="w-12 h-12 text-white" />
                      </button>
                      <p className="mt-6 text-xl text-[#6B5B3D]/80">
                        Tap to record a spoken memory
                      </p>
                    </>
                  )}

                  <div className="w-full border-t border-[#F5E6D3] my-10" />

                  <p className="text-[#6B5B3D]/60 mb-4">
                    Or upload an existing recording
                  </p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                    className="hidden"
                    onChange={(e) => onFile(e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => fileRef.current?.click()}
                    className="px-6 py-3 rounded-xl font-medium border border-[#D4AF37] text-[#B8860B] hover:bg-[#FFF6DD] transition inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    <Upload className="h-5 w-5" />
                    Upload audio
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPaste((v) => !v)}
                    className="mt-6 text-sm text-[#8B6914] underline-offset-2 hover:underline"
                  >
                    {showPaste ? "Hide transcript paste" : "Have a written transcript instead?"}
                  </button>

                  {showPaste && (
                    <div className="mt-6 w-full text-left">
                      <textarea
                        value={transcriptDraft}
                        onChange={(e) => setTranscriptDraft(e.target.value)}
                        rows={8}
                        placeholder="Paste the spoken story transcript here…"
                        className="w-full rounded-xl border border-[#E8D9C0] bg-[#FFFCF5] px-4 py-3 text-sm outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void submitTranscript()}
                        className="mt-3 px-5 py-2.5 rounded-xl bg-[#4C3B23] text-white text-sm font-medium hover:bg-[#3a2d1a] disabled:opacity-50"
                      >
                        Create archive from transcript
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <aside className="md:col-span-2 space-y-6">
              <div className="rounded-3xl border border-[#F5E6D3] bg-gradient-to-br from-[#FFF8E2] to-[#FFF4D7] p-7">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-[#B8860B]" />
                  <h2 className="text-lg font-semibold text-[#4C3B23]">
                    What happens next
                  </h2>
                </div>
                <ol className="space-y-4 text-sm text-[#6B5B3D]/85">
                  <li>
                    <span className="font-semibold text-[#4C3B23]">1. Transcribe</span>
                    <br />
                    Speech is translated into clear English text.
                  </li>
                  <li>
                    <span className="font-semibold text-[#4C3B23]">2. Write</span>
                    <br />
                    A warm, documentary-style biography is crafted.
                  </li>
                  <li>
                    <span className="font-semibold text-[#4C3B23]">3. Structure</span>
                    <br />
                    Timeline events and family links are suggested and saved.
                  </li>
                </ol>
              </div>

              <div className="rounded-3xl border border-[#F5E6D3] bg-white p-7">
                <div className="flex items-center gap-2 mb-3">
                  <FileAudio className="w-5 h-5 text-[#B8860B]" />
                  <h2 className="text-lg font-semibold text-[#4C3B23]">
                    Recording tips
                  </h2>
                </div>
                <ul className="space-y-2 text-sm text-[#6B5B3D]/80">
                  <li>Name people and places clearly</li>
                  <li>Mention years or life stages when you can</li>
                  <li>Share how relationships connect the family</li>
                  <li>A few minutes of focused memory is enough</li>
                </ul>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </Sidebar>
  );
}
