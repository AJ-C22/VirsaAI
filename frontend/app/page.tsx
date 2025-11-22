import { ArrowRight, BookOpen, Users, History, Mic, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FEFBF3] via-white to-[#FFFEF7]">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-[#F5E6D3]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/VirsaLogo.png" className="h-8 w-8 object-contain" alt="Virsa Logo" />
              <span className="text-2xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
                VirsaAI
              </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-[#6B5B3D] hover:text-[#B8860B] transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm font-medium text-[#6B5B3D] hover:text-[#B8860B] transition-colors">
              How It Works
            </a>
            <button className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white font-medium hover:shadow-lg hover:scale-105 transition-all duration-200 cursor-pointer">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#FFF8E7] border border-[#F5E6D3] mb-8">
              <Sparkles className="w-4 h-4 text-[#B8860B]" />
              <span className="text-sm font-medium text-[#8B6914]">Preserve Your Legacy</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-[#6B5B3D] via-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
                Transform Spoken Stories
              </span>
              <br />
              <span className="text-[#6B5B3D]">Into Family History</span>
            </h1>
            <p className="text-xl text-[#6B5B3D]/80 max-w-2xl mx-auto mb-10 leading-relaxed">
              Upload audio recordings of your family's stories and watch as AI transforms them into beautifully written biographies, interactive timelines, and explorable family trees.
            </p>
            <div className="flex items-center justify-center gap-4">
              <button className="px-8 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white font-semibold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center gap-2 cursor-pointer">
                Start Preserving Stories
                <ArrowRight className="w-5 h-5" />
              </button>
              <button className="px-8 py-4 rounded-xl border-2 border-[#D4AF37] text-[#B8860B] font-semibold text-lg hover:bg-[#FFF8E7] transition-all duration-200 cursor-pointer">
                Watch Demo
              </button>
            </div>
          </div>

          {/* Hero Image/Preview */}
          <div className="relative mt-16 rounded-2xl overflow-hidden shadow-2xl border border-[#F5E6D3]">
            <div className="aspect-video bg-gradient-to-br from-[#FFF8E7] via-white to-[#FEFBF3] flex items-center justify-center">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center shadow-lg">
                  <Mic className="w-12 h-12 text-white" />
                </div>
                <p className="text-[#6B5B3D]/60 text-lg">Interactive Dashboard Preview</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#6B5B3D] mb-4">
              Everything You Need to Preserve History
            </h2>
            <p className="text-lg text-[#6B5B3D]/70 max-w-2xl mx-auto">
              Powerful features designed to capture, organize, and visualize your family's legacy
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-white to-[#FFF8E7] border border-[#F5E6D3] hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-6">
                <Mic className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#6B5B3D] mb-3">Audio Transcription</h3>
              <p className="text-[#6B5B3D]/70 leading-relaxed">
                Upload audio files in any language. Our AI transcribes and translates spoken stories into beautifully written biographies.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-white to-[#FFF8E7] border border-[#F5E6D3] hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-6">
                <History className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#6B5B3D] mb-3">Interactive Timeline</h3>
              <p className="text-[#6B5B3D]/70 leading-relaxed">
                Visualize your family's journey through time with an interactive, expandable timeline that updates as new stories are added.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 rounded-2xl bg-gradient-to-br from-white to-[#FFF8E7] border border-[#F5E6D3] hover:shadow-xl transition-all duration-300 hover:scale-105">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-[#6B5B3D] mb-3">Family Tree</h3>
              <p className="text-[#6B5B3D]/70 leading-relaxed">
                Explore your family connections with an interactive tree. Zoom, click, and discover relationships across generations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-[#6B5B3D] mb-4">
              Simple Process, Powerful Results
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                1
              </div>
              <h3 className="text-xl font-bold text-[#6B5B3D] mb-3">Upload Audio</h3>
              <p className="text-[#6B5B3D]/70">
                Record or upload audio files of family members sharing their stories
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                2
              </div>
              <h3 className="text-xl font-bold text-[#6B5B3D] mb-3">AI Processing</h3>
              <p className="text-[#6B5B3D]/70">
                Our AI transcribes, translates, and extracts key information automatically
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                3
              </div>
              <h3 className="text-xl font-bold text-[#6B5B3D] mb-3">Explore & Share</h3>
              <p className="text-[#6B5B3D]/70">
                View your family history through timelines, trees, and beautifully written biographies
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-[#FFF8E7] to-[#FEFBF3]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-white border-2 border-[#F5E6D3] shadow-xl">
            <BookOpen className="w-16 h-16 mx-auto mb-6 text-[#B8860B]" />
            <h2 className="text-4xl md:text-5xl font-bold text-[#6B5B3D] mb-6">
              Start Building Your Family History Vault
            </h2>
            <p className="text-xl text-[#6B5B3D]/70 mb-8 max-w-2xl mx-auto">
              Every story matters. Preserve your family's legacy for generations to come.
            </p>
            <button className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-white font-semibold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center gap-2 mx-auto cursor-pointer">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-[#F5E6D3] bg-white/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8860B] flex items-center justify-center">
              <History className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
              VirsaAI
            </span>
          </div>
          <p className="text-sm text-[#6B5B3D]/60">
            © 2024 VirsaAI. Preserving family legacies, one story at a time.
          </p>
        </div>
      </footer>
    </div>
  );
}
