"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { BookOpen, Search } from "lucide-react";

export default function StoryLibraryPage() {
  const [stories, setStories] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadStories() {
      try {
        const res = await fetch("http://localhost:8000/story_library");
        const data = await res.json();
        setStories(data);
      } catch (err) {
        console.error("Failed to fetch story library", err);
      }
    }
    loadStories();
  }, []);

  const filteredStories = stories.filter((s) =>
    s.person_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-10">
        {/* Page title */}
        <h1 className="text-4xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent mb-10">
          Story Library
        </h1>

        {/* Search bar */}
        <div className="relative mb-10">
          <Search className="absolute left-4 top-3 h-5 w-5 text-[#6B5B3D]/50" />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-[#F5E6D3] bg-white/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Grid of story cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredStories.map((story) => (
            <a
              key={story.id}
              href={`/story/${story.id}`}
              className="block p-6 rounded-2xl border border-[#F5E6D3] bg-gradient-to-br from-[#FFF8E2] to-[#FFEFC5] shadow-md hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="h-6 w-6 text-[#B8860B]" />
                <h2 className="text-xl font-semibold text-[#6B5B3D]">
                  {story.person_name}
                </h2>
              </div>

              <p className="text-[#6B5B3D]/70 text-sm line-clamp-3">
                {story.summary || "No summary available."}
                </p>

                {/* Character Count */}
                <div className="mt-3 inline-block px-3 py-1 text-xs rounded-full bg-[#FAE8C8] text-[#6B4E2E] border border-[#E6D8C2]">
                {story.character_count ?? story.summary?.length ?? 0} chars
                </div>

              <div className="mt-4 text-xs text-[#6B5B3D]/50">
                Last updated:{" "}
                {story.created_at
                  ? new Date(story.created_at).toLocaleDateString()
                  : "N/A"}
              </div>
            </a>
          ))}
        </div>

        {filteredStories.length === 0 && (
          <p className="text-center text-[#6B5B3D]/60 mt-20 text-lg">
            No stories found.
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
