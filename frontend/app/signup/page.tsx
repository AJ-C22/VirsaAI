"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "../lib/auth";

export default function SignupPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await register(email, password, name);
      router.push(result.onboarding ? "/onboarding" : "/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-[#0a1210] text-[#e8efec] overflow-hidden">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(ellipse at 25% 15%, rgba(13,107,92,0.4), transparent 55%), radial-gradient(ellipse at 90% 85%, rgba(8,82,70,0.25), transparent 50%)",
          }}
        />
        <div className="relative">
          <Link href="/" className="font-display text-4xl tracking-tight">
            Virsa
          </Link>
          <p className="mt-3 text-sm text-[#6f837a] max-w-xs leading-relaxed">
            A living vault for oral histories, family artifacts, and memories
            that connect across generations.
          </p>
        </div>
        <blockquote className="relative font-display text-3xl leading-snug text-balance max-w-md">
          “Every family has a story worth keeping — spoken once, remembered
          forever.”
        </blockquote>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          <p className="label-eyebrow mb-3">Create your vault</p>
          <h1 className="font-display text-4xl text-ink mb-2">Begin preserving</h1>
          <p className="text-ink-soft mb-8 leading-relaxed">
            Free to start. Invite family when you’re ready.
          </p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                Your name
              </label>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ajaichandi"
                autoComplete="name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                Email
              </label>
              <input
                className="field"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@family.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-ink-soft mb-1.5 block">
                Password
              </label>
              <input
                className="field"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                autoComplete="new-password"
              />
            </div>
            {error && (
              <p className="text-sm text-[#9b2c2c] bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy ? "Creating vault…" : "Create free vault"}
            </button>
          </form>

          <p className="text-sm text-ink-soft mt-6">
            Already have an account?{" "}
            <Link href="/login" className="text-brass-deep font-semibold underline-offset-2 hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
