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
      {/* SOLID BACKGROUND */}
      <div className="min-h-screen bg-[#F7F1E5] px-6 py-12 flex justify-center">

        {/* WIDER CONTENT — now max-w-4xl */}
        <div className="max-w-4xl w-full">

          {/* Title */}
          <h1 className="text-5xl font-serif font-bold text-[#4C3B23] tracking-tight mb-3">
            {story.person_name}
          </h1>

          {/* Subtitle */}
          <p className="text-[#7B6A4B] italic text-lg mb-10">
            A documented personal history
          </p>

          {/* Buttons */}
          <div className="flex flex-wrap gap-4 mb-12">
            <a
              href={`/story/${storyId}/edit`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl 
              bg-[#C8A56A] text-white font-medium shadow 
              hover:shadow-lg hover:bg-[#b8965f] transition"
            >
              <Pencil size={18} /> Edit Story
            </a>

            <a
              href={`/record/${story.story_id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl 
              bg-white border border-[#DCCDB2] shadow 
              hover:shadow-lg transition text-[#5D4A2E]"
            >
              <Mic size={18} /> Record Audio
            </a>

            <a
              href={`/timeline/${story.story_id}`}
              className="flex items-center gap-2 px-5 py-3 rounded-xl 
              bg-white border border-[#DCCDB2] shadow 
              hover:shadow-lg transition text-[#5D4A2E]"
            >
              <Calendar size={18} /> View Timeline
            </a>
          </div>

          {/* WIDER STORY BOX */}
          <div className="bg-[#FFF7EB] border border-[#E5D6BB] rounded-2xl shadow-xl p-12">

            <article className="prose max-w-none text-[#4A3A25] leading-relaxed font-serif text-xl">

              {story.story
                ?.split("\n")
                .map((paragraph: string, idx: number) => (
                  <p
                    key={idx}
                    className={`mb-6 ${
                      idx === 0
                        ? "first-letter:text-6xl first-letter:font-bold first-letter:float-left first-letter:mr-2 first-letter:mt-1 first-letter:text-[#A38355]"
                        : ""
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}

            </article>

          </div>

          {/* Footer */}
          <div className="mt-6 text-sm text-[#7C6A50] italic text-right">
            Last updated:{" "}
            {story.updated_at
              ? new Date(story.updated_at).toLocaleDateString()
              : "N/A"}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
