import { Mic, BookOpen, Users, History, Sparkles, PlusCircle } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen flex bg-[#FFFEFA]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white/70 backdrop-blur-lg border-[#F5E6D3] p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-10">
          <img src="/VirsaLogo.png" className="h-10 w-10" />
          <span className="text-2xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
            VirsaAI
          </span>
        </div>

        <nav className="flex flex-col gap-3">
          <a className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition">
            <Sparkles className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Dashboard Overview</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition">
            <Mic className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Record New Story</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition">
            <BookOpen className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Story Library</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition">
            <History className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Timeline</span>
          </a>

          <a className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition">
            <Users className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Family Tree</span>
          </a>
        </nav>

        <div className="mt-auto pt-10">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF8E2] to-[#FFEFC5] border border-[#F5E6D3]">
            <p className="text-sm text-[#6B5B3D]">
              New updates available! Explore the refreshed story generator.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-10">
        <h1 className="text-4xl font-bold text-[#6B5B3D] mb-6">
          Dashboard
        </h1>

        {/* Main Sections */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="p-6 bg-white rounded-2xl border border-[#F5E6D3] shadow-sm hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-4">
              <Mic className="text-white h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-[#6B5B3D] mb-2">
              Record a New Story
            </h3>
            <p className="text-[#6B5B3D]/70 mb-4">
              Upload or record audio and let VirsaAI transcribe and transform it.
            </p>
            <button className="px-4 py-2 rounded-lg bg-[#D4AF37] text-white font-medium hover:scale-105 transition">
              Start Recording
            </button>
          </div>

          {/* Card 2 */}
          <div className="p-6 bg-white rounded-2xl border border-[#F5E6D3] shadow-sm hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-4">
              <BookOpen className="text-white h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-[#6B5B3D] mb-2">
              Story Library
            </h3>
            <p className="text-[#6B5B3D]/70 mb-4">
              Browse all the biographies and stories you've created.
            </p>
            <button className="px-4 py-2 rounded-lg border border-[#D4AF37] text-[#B8860B] font-medium hover:bg-[#FFF7E2] transition">
              View Stories
            </button>
          </div>

          {/* Card 3 */}
          <div className="p-6 bg-white rounded-2xl border border-[#F5E6D3] shadow-sm hover:shadow-xl transition-all">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-4">
              <Users className="text-white h-7 w-7" />
            </div>
            <h3 className="text-xl font-semibold text-[#6B5B3D] mb-2">
              Family Tree
            </h3>
            <p className="text-[#6B5B3D]/70 mb-4">
              Explore connections across generations and add new members.
            </p>
            <button className="px-4 py-2 rounded-lg bg-[#B8860B] text-white font-medium hover:scale-105 transition">
              View Tree
            </button>
          </div>
        </div>

        {/* Timeline + Recent */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
          {/* Recent Activity */}
          <div className="lg:col-span-1 p-6 bg-white rounded-2xl border border-[#F5E6D3] shadow-sm">
            <h3 className="text-xl font-semibold text-[#6B5B3D] mb-4">
              Recent Activity
            </h3>

            <ul className="space-y-4 text-[#6B5B3D]/80">
              <li className="flex items-start gap-3">
                <PlusCircle className="h-5 w-5 text-[#B8860B]" />
                Added new story from Grandma (Punjabi → English)
              </li>
              <li className="flex items-start gap-3">
                <PlusCircle className="h-5 w-5 text-[#B8860B]" />
                Updated biography “Life in the Village”
              </li>
              <li className="flex items-start gap-3">
                <PlusCircle className="h-5 w-5 text-[#B8860B]" />
                Added new member to family tree
              </li>
            </ul>
          </div>

          {/* Timeline Preview */}
          <div className="lg:col-span-2 p-6 bg-white rounded-2xl border border-[#F5E6D3] shadow-sm">
            <h3 className="text-xl font-semibold text-[#6B5B3D] mb-4">
              Family Timeline Preview
            </h3>
            <div className="h-48 bg-[#FFF8E7] border border-[#F5E6D3] rounded-xl flex items-center justify-center text-[#6B5B3D]/60">
              Timeline Visualization Placeholder
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
