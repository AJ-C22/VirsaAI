import { Upload, Mic, BookOpen, Users, History, Sparkles, PlusCircle } from "lucide-react";

export default function RecordStoryPage() {
  return (
    <div className="flex min-h-screen bg-[#FFFCF5] text-[#6B5B3D]">
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
      <main className="flex-1 px-16 py-12">
        <h1 className="text-4xl font-bold text-[#6B5B3D] mb-3">
          Record a New Story
        </h1>
        <p className="text-lg text-[#6B5B3D]/70 mb-12">
          Capture spoken memories directly or upload a recording. VirsaAI will
          transcribe, translate, and save your story.
        </p>

        <div className="grid grid-cols-3 gap-16">
          {/* Left section — main recorder */}
          <div className="col-span-2">
            <div className="rounded-3xl border border-[#F5E6D3] bg-white/70 shadow-xl backdrop-blur-md p-14">
              <div className="flex flex-col items-center text-center">
                {/* Mic Button */}
                <button className="w-30 h-30 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-2xl hover:scale-105 transition-transform">
                  <Mic className="w-14 h-14 text-white drop-shadow-md" />
                </button>

                <p className="mt-6 text-xl text-[#6B5B3D]/70">
                  Tap to start recording your story
                </p>

                {/* Divider */}
                <div className="w-full border-t border-[#F5E6D3] my-10"></div>

                {/* Upload Section */}
                <div>
                  <p className="text-[#6B5B3D]/60 mb-4">Already have a recording?</p>
                  <button className="px-6 py-3 rounded-xl font-medium border border-[#D4AF37] text-[#B8860B] hover:bg-[#FFF6DD] transition flex items-center gap-2">
                    <Upload className="h-5 w-5 text-[#B8860B]" />
                    Upload MP3
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Tips */}
          <div>
            <div className="rounded-3xl border border-[#F5E6D3] bg-gradient-to-br from-[#FFF8E2] to-[#FFF4D7] p-8 shadow-md">
              <h2 className="text-xl font-semibold text-[#6B5B3D] mb-4">
                Tips for Recording
              </h2>

              <ul className="space-y-3 text-[#6B5B3D]/80">
                <li>• Speak naturally at a comfortable pace</li>
                <li>• Minimize background noise if possible</li>
                <li>• Share memories, people, dates, and cultural details</li>
                <li>• You can always edit or add more later</li>
              </ul>

              <div className="mt-8 p-4 rounded-2xl bg-[#FFFDF5] border border-[#F5E6D3] text-sm">
                <span className="font-semibold">Pro Tip: </span>
                Start by describing the setting of your story—where you were,
                who was there, and how you felt.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
