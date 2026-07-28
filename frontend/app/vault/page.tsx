"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/DashboardLayout";
import { useAuth } from "../lib/auth";

const SYSTEMS = [
  { id: "punjabi", label: "Punjabi (Chacha, Bhabi, Nani…)" },
  { id: "cantonese", label: "Cantonese (Lao Lao, Suk, Bak…)" },
  { id: "mandarin", label: "Mandarin (Shūshu, Lǎolao…)" },
  { id: "generic", label: "Generic English" },
];

type Vault = {
  id: string;
  name: string;
  cultural_context?: string;
  kinship_system?: string;
  primary_language?: string;
};

export default function VaultSettingsPage() {
  const { apiRoot, authHeaders } = useAuth();
  const [vault, setVault] = useState<Vault | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${apiRoot}/vault`)
      .then((r) => r.json())
      .then(setVault)
      .catch(() => setVault(null));
  }, [apiRoot]);

  const save = async () => {
    if (!vault) return;
    setSaved(false);
    const res = await fetch(`${apiRoot}/vault`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        name: vault.name,
        cultural_context: vault.cultural_context,
        kinship_system: vault.kinship_system,
        primary_language: vault.primary_language,
      }),
    });
    setVault(await res.json());
    setSaved(true);
  };

  if (!vault) {
    return (
      <Sidebar>
        <p className="text-ink-soft">Loading vault…</p>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-xl">
        <p className="label-eyebrow mb-3">Family vault</p>
        <h1 className="font-display text-4xl text-ink mb-3">Culture & kinship</h1>
        <p className="text-ink-soft mb-8 leading-relaxed">
          Virsa uses this context to label relatives with culturally correct
          kinship terms on the family tree (e.g. Chacha, Bhabi, Lao Lao).
        </p>

        <label className="block text-xs font-medium text-ink-soft mb-1.5">
          Vault name
        </label>
        <input
          value={vault.name || ""}
          onChange={(e) => setVault({ ...vault, name: e.target.value })}
          className="field mb-5"
        />

        <label className="block text-xs font-medium text-ink-soft mb-1.5">
          Kinship system
        </label>
        <select
          value={vault.kinship_system || "punjabi"}
          onChange={(e) =>
            setVault({
              ...vault,
              kinship_system: e.target.value,
              cultural_context: e.target.value,
            })
          }
          className="field mb-5"
        >
          {SYSTEMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium text-ink-soft mb-1.5">
          Archive language
        </label>
        <select
          value={vault.primary_language || "en"}
          onChange={(e) =>
            setVault({ ...vault, primary_language: e.target.value })
          }
          className="field mb-6"
        >
          <option value="en">English</option>
          <option value="pa">Punjabi</option>
          <option value="zh">Chinese</option>
          <option value="hi">Hindi</option>
        </select>

        <button type="button" onClick={() => void save()} className="btn-primary">
          Save settings
        </button>
        {saved && (
          <p className="text-sm text-brass-deep mt-3">
            Saved. Open the family tree to see updated kinship labels.
          </p>
        )}
      </div>
    </Sidebar>
  );
}
