"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DashboardLayout from "../../components/DashboardLayout";
import { Pencil, Mic, Calendar } from "lucide-react";

export default function StoryPage() {
  const { storyId } = useParams();
  const [story, setStory] = useState<any>(null);

  useEffect(() => {
    async function loadStory() {
      try {
        const res = await fetch(`http://localhost:8000/story/${storyId}`);
        const data = await res.json();
        setStory(data);
      } catch (err) {
        console.error("Failed to fetch story", err);
      }
    }
    loadStory();
  }, [storyId]);  

  if (!story) {
    return (
      <DashboardLayout>
        <div className="p-10 text-center text-lg text-[#6B5B3D]">
          Loading story...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Title */}
        <h1 className="text-5xl font-bold mb-6 text-[#5C4A2A] tracking-tight">
          {story.person_name}
        </h1>

        {/* Subtitle / Dates */}
        <p className="text-[#6B5B3D]/70 text-lg mb-10 italic">
          A personal biography  
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 mb-12">
          <a
            href={`/story/${storyId}/edit`}
            className="flex items-center gap-2 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white px-5 py-3 rounded-xl shadow hover:shadow-lg transition-all"
          >
            <Pencil size={18} /> Edit Story
          </a>

          <a
            href={`/record/${story.story_id}`}
            className="flex items-center gap-2 bg-white border border-[#E6D8C2] px-5 py-3 rounded-xl shadow hover:shadow-md transition-all text-[#6B4E2E]"
          >
            <Mic size={18} /> Record Audio
          </a>

          <a
            href={`/timeline/${story.story_id}`}
            className="flex items-center gap-2 bg-white border border-[#E6D8C2] px-5 py-3 rounded-xl shadow hover:shadow-md transition-all text-[#6B4E2E]"
          >
            <Calendar size={18} /> View Timeline
          </a>
        </div>

        {/* Story Content Box */}
        <div className="bg-[#FFF8E8] border border-[#F0E2C2] rounded-2xl shadow p-10 leading-relaxed text-[#5A4A32] text-lg prose prose-lg max-w-none">
          {story.story_body?.split("\n").map((paragraph: string, idx: number) => (
            <p key={idx} className="mb-6">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-right text-sm text-[#6B5B3D]/60">
          Last updated:{" "}
          {story.created_at
            ? new Date(story.created_at).toLocaleDateString()
            : "N/A"}
        </div>
      </div>
    </DashboardLayout>
  );
}
