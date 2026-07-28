"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, FileText } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";

type Artifact = {
  id: string;
  title: string;
  caption?: string;
  artifact_type: string;
  taken_year?: number;
  taken_place?: string;
};

export default function ArtifactsPage() {
  const { apiRoot } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Artifact[]>([]);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [type, setType] = useState("photo");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch(`${apiRoot}/artifacts`);
    setItems(await res.json());
  };

  useEffect(() => {
    void load();
  }, [apiRoot]);

  const onUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", title || file.name);
      form.append("caption", caption);
      form.append("artifact_type", type);
      const res = await fetch(`${apiRoot}/artifacts/upload`, {
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
      <p className="label-eyebrow mb-3">Family artifacts</p>
      <h1 className="font-display text-4xl text-ink mb-3">Photos & documents</h1>
      <p className="text-ink-soft mb-8 max-w-2xl leading-relaxed">
        Add letters, certificates, and photographs. They become searchable
        alongside oral histories and timeline events.
      </p>

      <div className="rounded-2xl border border-line bg-white p-6 mb-8">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="field"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="field"
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
          className="field resize-y mb-4"
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
          className="btn-primary"
        >
          <ImagePlus className="w-4 h-4" />
          {uploading ? "Uploading…" : "Upload artifact"}
        </button>
        {error && <p className="text-sm text-[#9b2c2c] mt-3">{error}</p>}
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((a) => (
          <div key={a.id} className="rounded-2xl border border-line bg-white p-5">
            <div className="flex items-center gap-2 text-brass mb-2">
              {a.artifact_type === "photo" ? (
                <ImagePlus className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              <span className="text-xs uppercase tracking-wide font-semibold">
                {a.artifact_type}
              </span>
            </div>
            <h3 className="font-semibold text-ink">{a.title}</h3>
            {a.caption && <p className="text-sm text-ink-soft mt-1">{a.caption}</p>}
          </div>
        ))}
      </div>
    </Sidebar>
  );
}
