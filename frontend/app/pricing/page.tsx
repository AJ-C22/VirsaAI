"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { useAuth } from "../lib/auth";

type Plan = {
  id: string;
  name: string;
  price_monthly: number;
  features: string[];
  highlighted?: boolean;
};

export default function PricingPage() {
  const { apiRoot, vaultId, authHeaders, user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${apiRoot}/plans`)
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => setPlans([]));
  }, [apiRoot]);

  const choose = async (planId: string) => {
    if (!user) {
      window.location.href = "/signup";
      return;
    }
    setMessage(null);
    const res = await fetch(`${apiRoot}/billing/set-plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({ plan: planId, vault_id: vaultId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.detail || "Could not update plan");
      return;
    }
    setMessage(
      `Switched to ${planId} plan (dev mode — Stripe checkout comes next).`
    );
  };

  return (
    <div className="min-h-screen text-ink">
      <nav className="border-b border-line/70 bg-mist/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/" className="font-display text-3xl tracking-tight">
            Virsa
          </Link>
          <div className="flex gap-5 text-sm items-center">
            <Link href="/login" className="text-ink-soft hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary !py-2.5 !px-4">
              Start free
            </Link>
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
                onClick={() => void choose(plan.id)}
                className={plan.highlighted ? "btn-accent w-full" : "btn-ghost w-full"}
              >
                {plan.price_monthly === 0 ? "Start free" : "Choose plan"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
