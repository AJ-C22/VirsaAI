"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Mic, BookOpen, History, Users } from "lucide-react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen w-full bg-[#FFFCF5]">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-white/70 backdrop-blur-lg border-[#F5E6D3] p-6 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10">
          <img src="/VirsaLogo.png" className="h-10 w-10" />
          <span className="text-2xl font-bold bg-gradient-to-r from-[#B8860B] to-[#D4AF37] bg-clip-text text-transparent">
            VirsaAI
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
          >
            <Sparkles className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">
              Dashboard Overview
            </span>
          </Link>

          <Link
            href="/record"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
          >
            <Mic className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Record New Story</span>
          </Link>

          <Link
            href="/story_library"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
          >
            <BookOpen className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Story Library</span>
          </Link>

          <Link
            href="/timeline_home"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
          >
            <History className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Timeline</span>
          </Link>

          <Link
            href="/family"
            className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#FFF4D8] transition"
          >
            <Users className="h-5 w-5 text-[#B8860B]" />
            <span className="font-medium text-[#6B5B3D]">Family Tree</span>
          </Link>
        </nav>

        {/* Footer Box */}
        <div className="mt-auto pt-10">
          <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FFF8E2] to-[#FFEFC5] border border-[#F5E6D3]">
            <p className="text-sm text-[#6B5B3D]">
              New updates available! Explore the refreshed story generator.
            </p>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto p-10">{children}</main>
    </div>
  );
}
