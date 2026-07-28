"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, FileText } from "lucide-react";
import Sidebar from "../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

type Artifact = {
  id: string;
  title: string;
  caption?: string;
  artifact_type: string;
  taken_year?: number;
  taken_place?: string;
};

export default function ArtifactsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Artifact[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [type, setType] = useState("photo");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`${API_ROOT}/artifacts`);
    setItems(await res.json());
  };

  useEffect(() => {
    void load();
  }, []);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name);
      form.append("caption", caption);
      form.append("artifact_type", type);
      const res = await fetch(`${API_ROOT}/artifacts/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Upload failed");
      setTitle("");
      setCaption("");
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Sidebar>
      <div className="max-w-4xl mx-auto">
        <p className="text-sm font-medium text-[#B8860B] mb-2 tracking-wide">
          FAMILY ARTIFACTS
        </p>
        <h1 className="text-4xl font-bold text-[#4C3B23] mb-3">
          Photos & documents
        </h1>
        <p className="text-[#6B5B3D]/75 mb-8 max-w-2xl">
          Add letters, certificates, and photographs to the vault. They become
          searchable alongside oral histories and timeline events.
        </p>

        <div className="rounded-2xl border border-[#E8D9C0] bg-white p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="rounded-xl border border-[#E8D9C0] px-4 py-3 outline-none focus:border-[#D4AF37]"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-xl border border-[#E8D9C0] px-4 py-3 outline-none focus:border-[#D4AF37] bg-white"
            >
              <option value="photo">Photo</option>
              <option value="document">Document</option>
              <option value="letter">Letter</option>
              <option value="certificate">Certificate</option>
              <option value="other">Other</option>
            </select>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption or context (who, when, where)"
            rows={3}
            className="w-full rounded-xl border border-[#E8D9C0] px-4 py-3 outline-none focus:border-[#D4AF37] mb-4"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#4C3B23] text-white font-medium disabled:opacity-50"
          >
            <ImagePlus className="w-4 h-4" />
            {uploading ? "Uploading…" : "Upload artifact"}
          </button>
          {error && <p className="text-sm text-red-700 mt-3">{error}</p>}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {items.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl border border-[#E8D9C0] bg-white p-5"
            >
              <div className="flex items-center gap-2 text-[#B8860B] mb-2">
                {a.artifact_type === "photo" ? (
                  <ImagePlus className="w-4 h-4" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span className="text-xs uppercase tracking-wide font-semibold">
                  {a.artifact_type}
                </span>
              </div>
              <h3 className="font-semibold text-[#4C3B23]">{a.title}</h3>
              {a.caption && (
                <p className="text-sm text-[#7B6A4B] mt-1">{a.caption}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </Sidebar>
  );
}
