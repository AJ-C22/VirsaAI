import { ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen text-ink">
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-line/70 bg-mist/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-display text-3xl tracking-tight">
            Virsa
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link href="/pricing" className="text-ink-soft hover:text-ink hidden sm:inline">
              Pricing
            </Link>
            <Link href="/login" className="text-ink-soft hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary !py-2.5 !px-4">
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <p className="label-eyebrow mb-5">Living family history</p>
            <h1 className="font-display text-5xl md:text-7xl text-ink leading-[1.05] text-balance mb-6">
              Spoken stories, kept forever
            </h1>
            <p className="text-lg md:text-xl text-ink-soft leading-relaxed max-w-xl mb-10">
              Record oral histories. Virsa writes biographies, builds timelines,
              and grows a culturally aware family tree — connecting memories
              across generations.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/signup" className="btn-accent">
                Create your vault
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/record" className="btn-ghost">
                Try recording
              </Link>
            </div>
          </div>

          <div className="mt-20 grid md:grid-cols-3 gap-6 border-t border-line pt-12">
            {[
              {
                title: "Oral → written",
                body: "Interviews become lasting biographies in clear language.",
              },
              {
                title: "People & kinship",
                body: "Trees that understand Chacha, Bhabi, Lao Lao — not just “uncle.”",
              },
              {
                title: "Shared memories",
                body: "The same wedding or migration, told from different voices.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h2 className="font-display text-2xl text-ink mb-2">{item.title}</h2>
                <p className="text-ink-soft text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
