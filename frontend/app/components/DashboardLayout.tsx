"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Mic,
  BookOpen,
  History,
  Users,
  Search,
  Layers,
  Image,
  Settings2,
} from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: Sparkles },
  { href: "/record", label: "Record story", icon: Mic },
  { href: "/archive", label: "Search archive", icon: Search },
  { href: "/story_library", label: "Story library", icon: BookOpen },
  { href: "/memories", label: "Shared memories", icon: Layers },
  { href: "/timeline_home", label: "Timelines", icon: History },
  { href: "/family", label: "Family tree", icon: Users },
  { href: "/artifacts", label: "Artifacts", icon: Image },
  { href: "/vault", label: "Culture & vault", icon: Settings2 },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-[#FFFCF5]">
      <aside className="w-64 border-r bg-white/70 backdrop-blur-lg border-[#F5E6D3] p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-8">
          <img src="/VirsaLogo.png" className="h-10 w-10" alt="VirsaAI" />
          <span className="text-2xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
            VirsaAI
          </span>
        </div>

        <nav className="flex flex-col gap-1 overflow-y-auto">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
            >
              <Icon className="h-5 w-5 text-[#B8860B] shrink-0" />
              <span className="font-medium text-[#6B5B3D] text-sm">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-auto pt-8">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF8E2] to-[#FFEFC5] border border-[#F5E6D3]">
            <p className="text-sm text-[#6B5B3D]">
              A living family history vault — stories, artifacts, and shared
              memories connected across generations.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-10">{children}</main>
    </div>
  );
}
