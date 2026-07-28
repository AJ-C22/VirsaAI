"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../lib/auth";

const SYSTEMS = [
  { id: "punjabi", label: "Punjabi", hint: "Chacha, Bhabi, Nani…" },
  { id: "cantonese", label: "Cantonese", hint: "Lao Lao, Suk, Bak…" },
  { id: "mandarin", label: "Mandarin", hint: "Shūshu, Lǎolao…" },
  { id: "generic", label: "English", hint: "Uncle, Aunt, Grandmother…" },
];

export default function OnboardingPage() {
  const { vaultId, apiRoot, authHeaders } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [vaultName, setVaultName] = useState("");
  const [kinship, setKinship] = useState("punjabi");
  const [saving, setSaving] = useState(false);

  const saveCulture = async () => {
    setSaving(true);
    try {
      await fetch(`${apiRoot}/vault`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          vault_id: vaultId,
          name: vaultName || undefined,
          kinship_system: kinship,
          cultural_context: kinship,
        }),
      });
      setStep(2);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? "bg-brass" : "bg-stone-2"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.35 }}
          >
            {step === 0 && (
              <>
                <p className="label-eyebrow mb-3">Welcome</p>
                <h1 className="font-display text-4xl md:text-5xl text-ink mb-4 text-balance">
                  Your family vault is ready
                </h1>
                <p className="text-ink-soft text-lg leading-relaxed mb-8">
                  Record interviews, keep artifacts, and watch Virsa connect
                  people, places, and shared memories — with kinship terms that
                  match your culture.
                </p>
                <button type="button" className="btn-primary" onClick={() => setStep(1)}>
                  Continue
                </button>
              </>
            )}

            {step === 1 && (
              <>
                <p className="label-eyebrow mb-3">Culture</p>
                <h1 className="font-display text-4xl text-ink mb-3">
                  How should we name relatives?
                </h1>
                <p className="text-ink-soft mb-6">
                  This shapes labels on your family tree.
                </p>
                <input
                  className="field mb-4"
                  value={vaultName}
                  onChange={(e) => setVaultName(e.target.value)}
                  placeholder="Vault name (optional)"
                />
                <div className="grid grid-cols-2 gap-3 mb-8">
                  {SYSTEMS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setKinship(s.id)}
                      className={`text-left rounded-xl border px-4 py-3 transition ${
                        kinship === s.id
                          ? "border-brass bg-white"
                          : "border-line bg-white/50 hover:border-brass/50"
                      }`}
                    >
                      <div className="font-semibold text-ink text-sm">{s.label}</div>
                      <div className="text-xs text-ink-soft mt-1">{s.hint}</div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={saving}
                  onClick={() => void saveCulture()}
                >
                  {saving ? "Saving…" : "Save & continue"}
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <p className="label-eyebrow mb-3">First memory</p>
                <h1 className="font-display text-4xl text-ink mb-3">
                  Capture an oral story
                </h1>
                <p className="text-ink-soft mb-8 leading-relaxed">
                  A few minutes is enough. We’ll write a biography and begin your
                  timeline and tree.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    className="btn-accent"
                    onClick={() => router.push("/record")}
                  >
                    Record a story
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => router.push("/dashboard")}
                  >
                    Go to home
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
