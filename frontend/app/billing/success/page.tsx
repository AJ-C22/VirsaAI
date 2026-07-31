"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../lib/auth";

function SuccessInner() {
  const { apiRoot, authHeaders, setVaultId } = useAuth();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [plan, setPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setStatus("error");
      setError("Missing checkout session.");
      return;
    }
    fetch(`${apiRoot}/billing/session/${sessionId}`, {
      headers: authHeaders(),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.detail || "Could not confirm payment");
        if (data.vault_id) setVaultId(data.vault_id);
        setPlan(data.plan);
        setStatus("ok");
      })
      .catch((e: unknown) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Confirmation failed");
      });
  }, [sessionId, apiRoot, authHeaders, setVaultId]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <Link href="/" className="font-display text-3xl text-ink">
          Virsa
        </Link>
        {status === "loading" && (
          <p className="mt-10 text-ink-soft">Confirming your upgrade…</p>
        )}
        {status === "ok" && (
          <>
            <h1 className="font-display text-4xl text-ink mt-10 mb-3">
              You’re on {plan || "a paid"} plan
            </h1>
            <p className="text-ink-soft mb-8 leading-relaxed">
              Payment succeeded. Your vault limits update immediately — invite
              family and keep recording.
            </p>
            <Link href="/dashboard" className="btn-primary">
              Go to dashboard
            </Link>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="font-display text-4xl text-ink mt-10 mb-3">
              Almost there
            </h1>
            <p className="text-ink-soft mb-4">{error}</p>
            <p className="text-sm text-ink-soft mb-8">
              If you were charged, refresh in a minute or open Manage billing
              from Pricing.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/dashboard" className="btn-primary">
                Dashboard
              </Link>
              <Link href="/pricing" className="btn-ghost">
                Pricing
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function BillingSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-ink-soft">
          Loading…
        </div>
      }
    >
      <SuccessInner />
    </Suspense>
  );
}
