"use client";

import { useState, useEffect } from "react";
import { PlusCircle } from "lucide-react";
import Sidebar from "../components/DashboardLayout";
import { useRouter } from "next/navigation";

export default function TimelinePage() {
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState([]);
  const router = useRouter();

  // --- Fetch people from FastAPI backend ---
  useEffect(() => {
    async function loadPeople() {
      try {
        const res = await fetch("http://localhost:8000/timeline");
        const data = await res.json();
        setPeople(data);
      } catch (err) {
        console.error("Failed to fetch people:", err);
      }
    }
    loadPeople();
  }, []);

  return (
    <Sidebar>
      <div className="flex min-h-screen bg-[#FFFCF6]">
        <main className="flex-1 p-10">
          <h1 className="text-4xl font-bold text-[#6B5B3D] mb-3">
            Family Timelines
          </h1>
          <p className="text-[#7A6A4F] mb-8">
            Each family member has one timeline that grows with their stories.
          </p>

          {/* Search */}
          <div className="flex items-center gap-4 mb-10">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="flex-1 px-4 py-3 rounded-xl border border-[#F1E0C9] bg-[#FFFAF2]"
            />

            <select className="px-4 py-3 rounded-xl border border-[#F1E0C9] bg-white text-[#6B5B3D]">
              <option>Sort by Recent</option>
              <option>A–Z</option>
              <option>Z–A</option>
              <option>Most Stories</option>
            </select>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

            {/* Add New Person */}
            <div className="p-8 rounded-2xl border-2 border-dashed border-[#E8D8BC] bg-[#FFFAF2] flex flex-col items-center justify-center hover:bg-[#FFF4D8] transition cursor-pointer shadow-sm">
              <PlusCircle className="h-12 w-12 text-[#B8860B] mb-4" />
              <p className="text-[#6B5B3D] font-medium">Add New Person</p>
            </div>

            {/* People Cards */}
            {people
              .filter((p: any) =>
                (p.person_name ?? "")
                .toLowerCase()
                .includes(search.toLowerCase())
              )
              .map((person: any) => (
                <div
                  key={person.story_id}
                  className="rounded-2xl bg-white border border-[#F1E0C9] shadow-md p-6 hover:shadow-xl hover:-translate-y-1 transition cursor-pointer"
                >
                  <div className="flex items-center gap-4 mb-5">
                    <img
                      src="/tempUser.png"
                      className="w-16 h-16 rounded-full object-cover border border-[#EADBC3]"
                    />
                    <div>
                      <h3 className="text-xl font-semibold text-[#6B5B3D]">
                        {person.person_name}
                      </h3>
                      <p className="text-sm text-[#947F63]">
                        {person.event_count} events • Updated{" "}
                        {new Date(person.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  {/* Mini Timeline Preview */}
                  <div className="w-full h-1 bg-[#F0E6D6] rounded-full mb-6 relative">
                    <div className="absolute left-1/4 -top-1 w-3 h-3 rounded-full bg-[#D4AF37]" />
                    <div className="absolute left-1/2 -top-1 w-3 h-3 rounded-full bg-[#D4AF37]" />
                    <div className="absolute right-1/4 -top-1 w-3 h-3 rounded-full bg-[#D4AF37]" />
                  </div>

                  {/* View Timeline Button */}
                  <button
                    onClick={() => router.push(`/timeline/${person.story_id}`)}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#B8860B] to-[#D4AF37] text-white font-medium shadow-md hover:opacity-90 transition"
                  >
                    View Timeline
                  </button>
                </div>
              ))}
          </div>
        </main>
      </div>
    </Sidebar>
  );
}
