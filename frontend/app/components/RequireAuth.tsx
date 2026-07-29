"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../lib/auth";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/invite",
];

export function isPublicPath(pathname: string | null) {
  if (!pathname) return true;
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some(
    (p) => p !== "/" && (pathname === p || pathname.startsWith(`${p}/`))
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
}
