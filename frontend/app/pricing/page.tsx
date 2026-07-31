"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { Suspense } from "react";
import { useAuth } from "../lib/auth";

type Plan = {
  id: string;
  name: string;
  price_monthly: number;
  features: string[];
  highlighted?: boolean;
};

function PricingInner() {
  const { apiRoot, vaultId, authHeaders, user } = useAuth();
  const searchParams = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stripeOn, setStripeOn] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      setMessage("Checkout cancelled — your plan was not changed.");
    }
  }, [searchParams]);

  useEffect(() => {
    fetch(`${apiRoot}/plans`)
      .then((r) => r.json())
      .then((d) => {
        setPlans(d.plans || []);
        setStripeOn(Boolean(d.stripe_configured));
      })
      .catch(() => setPlans([]));
  }, [apiRoot]);

  const choose = async (planId: string) => {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    setMessage(null);
    setBusy(planId);
    try {
      if (planId === "free" || !stripeOn) {
        const res = await fetch(`${apiRoot}/billing/set-plan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({ plan: planId, vault_id: vaultId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Could not update plan");
        setMessage(
          stripeOn
            ? "Switched to Free."
            : `Applied ${planId} (dev mode — add Stripe keys for real Checkout).`
        );
        return;
      }

      const res = await fetch(`${apiRoot}/billing/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ plan: planId, vault_id: vaultId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Checkout failed");
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setMessage("Unexpected checkout response.");
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  };

  const openPortal = async () => {
    if (!user || !vaultId) return;
    setBusy("portal");
    setMessage(null);
    try {
      const res = await fetch(`${apiRoot}/billing/portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ vault_id: vaultId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not open billing portal");
      window.location.href = data.url;
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Portal failed");
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen text-ink">
      <nav className="border-b border-line/70 bg-mist/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display text-3xl tracking-tight">
            Virsa
          </Link>
          <div className="flex gap-5 text-sm items-center">
            {user ? (
              <>
                {stripeOn && (
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    className="text-ink-soft hover:text-ink"
                    disabled={busy === "portal"}
                  >
                    Manage billing
                  </button>
                )}
                <Link href="/dashboard" className="btn-primary !py-2.5 !px-4">
                  Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-ink-soft hover:text-ink">
                  Sign in
                </Link>
                <Link href="/signup" className="btn-primary !py-2.5 !px-4">
                  Start free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <div className="max-w-2xl mb-14">
          <p className="label-eyebrow mb-3">Plans</p>
          <h1 className="font-display text-4xl md:text-5xl text-ink mb-4 text-balance">
            Preserve a legacy that grows with your family
          </h1>
          <p className="text-lg text-ink-soft leading-relaxed">
            Start free. Upgrade when your vault needs more stories, relatives,
            and shared memory.
          </p>
          {!stripeOn && (
            <p className="mt-4 text-sm text-ink-soft rounded-xl border border-line bg-white px-4 py-3">
              Stripe Checkout is not configured yet — paid buttons apply plans in
              dev mode. Add keys from{" "}
              <code className="text-xs">.env.example</code> to go live.
            </p>
          )}
        </div>

        {message && (
          <p className="mb-8 text-sm rounded-xl border border-line bg-white px-4 py-3 text-ink-soft">
            {message}
          </p>
        )}

        <div className="grid md:grid-cols-3 gap-5">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-3xl border p-7 flex flex-col ${
                plan.highlighted
                  ? "border-brass bg-white shadow-sm"
                  : "border-line bg-white/70"
              }`}
            >
              <h2 className="font-display text-2xl text-ink">{plan.name}</h2>
              <p className="mt-3 mb-6">
                <span className="font-display text-4xl text-ink">
                  ${plan.price_monthly}
                </span>
                <span className="text-ink-soft text-sm"> / month</span>
              </p>
              <ul className="space-y-2.5 flex-1 mb-8">
                {(plan.features || []).map((f) => (
                  <li key={f} className="flex gap-2 text-sm text-ink-soft">
                    <Check className="w-4 h-4 text-brass shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy === plan.id}
                onClick={() => void choose(plan.id)}
                className={
                  plan.highlighted ? "btn-accent w-full" : "btn-ghost w-full"
                }
              >
                {busy === plan.id
                  ? "Working…"
                    : plan.price_monthly === 0
                      ? "Start free"
                      : stripeOn
                        ? "Choose plan"
                        : "Choose plan"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-ink-soft">
          Loading plans…
        </div>
      }
    >
      <PricingInner />
    </Suspense>
  );
}
