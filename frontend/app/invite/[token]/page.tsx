"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";

type Peek = {
  email: string;
  role: string;
  status: string;
  vault_name?: string;
  expires_at?: string;
};

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const { user, apiRoot, authHeaders, setVaultId, login, register, loading } =
    useAuth();
  const router = useRouter();
  const [peek, setPeek] = useState<Peek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("signup");

  useEffect(() => {
    if (!token) return;
    fetch(`${apiRoot}/vaults/invite/${token}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Invite not found");
        setPeek(data);
        if (data.email) setEmail(data.email);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Invite not found")
      );
  }, [token, apiRoot]);

  const accept = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${apiRoot}/vaults/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not accept invite");
      setVaultId(data.vault_id);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not accept invite");
    } finally {
      setBusy(false);
    }
  };

  const onAuth = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await register(email, password, name || undefined);
      } else {
        await login(email, password);
      }
      // accept after auth — need fresh token from localStorage after persist
      const t = localStorage.getItem("virsa_token");
      const res = await fetch(`${apiRoot}/vaults/accept-invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not accept invite");
      setVaultId(data.vault_id);
      router.push("/onboarding");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="font-display text-3xl text-ink">
          Virsa
        </Link>
        <p className="label-eyebrow mt-8 mb-3">Family invite</p>
        <h1 className="font-display text-4xl text-ink mb-3">
          {peek?.vault_name || "Join a vault"}
        </h1>

        {peek && peek.status === "pending" && (
          <p className="text-ink-soft mb-6 leading-relaxed">
            You’ve been invited as <span className="text-ink font-medium">{peek.role}</span>
            {peek.email ? (
              <>
                {" "}
                for <span className="text-ink font-medium">{peek.email}</span>
              </>
            ) : null}
            . Accept to start preserving stories together.
          </p>
        )}

        {peek && peek.status !== "pending" && (
          <p className="text-ink-soft mb-6">
            This invite is {peek.status}. Ask a family member to send a new one.
          </p>
        )}

        {error && (
          <p className="text-sm text-[#9b2c2c] bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        {peek?.status === "pending" && user && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void accept()}
            className="btn-primary w-full"
          >
            {busy ? "Joining…" : "Accept invite"}
          </button>
        )}

        {peek?.status === "pending" && !user && (
          <form onSubmit={onAuth} className="space-y-4 surface-panel rounded-2xl p-6">
            <div className="flex gap-2 text-sm mb-2">
              <button
                type="button"
                className={mode === "signup" ? "font-semibold text-ink" : "text-ink-soft"}
                onClick={() => setMode("signup")}
              >
                Create account
              </button>
              <span className="text-line">·</span>
              <button
                type="button"
                className={mode === "login" ? "font-semibold text-ink" : "text-ink-soft"}
                onClick={() => setMode("login")}
              >
                Sign in
              </button>
            </div>
            {mode === "signup" && (
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            )}
            <input
              className="field"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email (must match invite)"
            />
            <input
              className="field"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {busy
                ? "Working…"
                : mode === "signup"
                  ? "Create account & join"
                  : "Sign in & join"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
