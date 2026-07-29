"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Mic,
  Search,
  Library,
  Layers,
  GitBranch,
  Calendar,
  Image as ImageIcon,
  Settings2,
  CreditCard,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../lib/auth";

const NAV = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/record", label: "Record", icon: Mic },
  { href: "/archive", label: "Search", icon: Search },
  { href: "/story_library", label: "Stories", icon: Library },
  { href: "/timeline_home", label: "Timelines", icon: Calendar },
  { href: "/memories", label: "Memories", icon: Layers },
  { href: "/family", label: "Tree", icon: GitBranch },
  { href: "/artifacts", label: "Artifacts", icon: ImageIcon },
  { href: "/vault", label: "Vault", icon: Settings2 },
  { href: "/pricing", label: "Plans", icon: CreditCard },
];

function NavLinks({
  pathname,
  onNavigate,
}: {
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active =
          pathname === href ||
          (href !== "/dashboard" && pathname?.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
              active
                ? "bg-sidebar-accent text-[#f2faf7]"
                : "text-[#9aada5] hover:bg-sidebar-accent/70 hover:text-[#e8efec]"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-brass" : ""}`} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-mist text-ink">
      <aside className="hidden md:flex w-[240px] shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="px-6 pt-8 pb-6">
          <Link href="/dashboard" className="block group">
            <div className="font-display text-3xl tracking-tight text-[#e8efec] group-hover:text-brass transition">
              Virsa
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6f837a]">
              Family history
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          <NavLinks pathname={pathname} />
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          {user ? (
            <div>
              <p className="text-xs text-[#6f837a] truncate px-1">{user.email}</p>
              <button
                type="button"
                onClick={logout}
                className="mt-3 flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-[#9aada5] hover:bg-sidebar-accent hover:text-[#e8efec] transition"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          ) : (
            <Link href="/signup" className="btn-accent w-full text-center">
              Start free
            </Link>
          )}
        </div>
      </aside>

      <div className="md:hidden fixed top-0 inset-x-0 z-40 bg-sidebar text-sidebar-foreground border-b border-sidebar-border px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-display text-2xl">
          Virsa
        </Link>
        <button
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="p-2 rounded-lg text-[#9aada5] hover:bg-sidebar-accent"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 z-30 bg-sidebar/95 pt-16 px-4 pb-8 overflow-y-auto">
          <nav className="space-y-0.5">
            <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
          <div className="mt-6 border-t border-sidebar-border pt-4">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  logout();
                }}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[#9aada5]"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            ) : (
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="btn-accent w-full text-center"
              >
                Start free
              </Link>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="md:hidden h-14" />
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8 md:py-12">{children}</div>
      </main>
    </div>
  );
}
