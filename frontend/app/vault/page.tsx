"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/DashboardLayout";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

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
  const [vault, setVault] = useState<Vault | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`${API_ROOT}/vault`)
      .then((r) => r.json())
      .then(setVault)
      .catch(() => setVault(null));
  }, []);

  const save = async () => {
    if (!vault) return;
    setSaved(false);
    const res = await fetch(`${API_ROOT}/vault`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
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
        <p className="text-[#6B5B3D]">Loading vault…</p>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="max-w-xl">
        <p className="text-sm font-medium text-[#B8860B] mb-2 tracking-wide">
          FAMILY VAULT
        </p>
        <h1 className="text-4xl font-bold text-[#4C3B23] mb-3">Culture & kinship</h1>
        <p className="text-[#6B5B3D]/75 mb-8">
          VirsaAI uses this context to label relatives with culturally correct
          kinship terms on the family tree (e.g. Chacha, Bhabi, Lao Lao).
        </p>

        <label className="block text-sm font-medium mb-2">Vault name</label>
        <input
          value={vault.name || ""}
          onChange={(e) => setVault({ ...vault, name: e.target.value })}
          className="w-full rounded-xl border border-[#E8D9C0] px-4 py-3 mb-5 outline-none focus:border-[#D4AF37]"
        />

        <label className="block text-sm font-medium mb-2">Kinship system</label>
        <select
          value={vault.kinship_system || "punjabi"}
          onChange={(e) =>
            setVault({
              ...vault,
              kinship_system: e.target.value,
              cultural_context: e.target.value,
            })
          }
          className="w-full rounded-xl border border-[#E8D9C0] px-4 py-3 mb-5 outline-none focus:border-[#D4AF37] bg-white"
        >
          {SYSTEMS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="block text-sm font-medium mb-2">Archive language</label>
        <select
          value={vault.primary_language || "en"}
          onChange={(e) =>
            setVault({ ...vault, primary_language: e.target.value })
          }
          className="w-full rounded-xl border border-[#E8D9C0] px-4 py-3 mb-6 outline-none focus:border-[#D4AF37] bg-white"
        >
          <option value="en">English</option>
          <option value="pa">Punjabi</option>
          <option value="zh">Chinese</option>
          <option value="hi">Hindi</option>
        </select>

        <button
          type="button"
          onClick={() => void save()}
          className="px-6 py-3 rounded-xl bg-[#4C3B23] text-white font-medium"
        >
          Save settings
        </button>
        {saved && (
          <p className="text-sm text-emerald-700 mt-3">
            Saved. Open the family tree to see updated kinship labels.
          </p>
        )}
      </div>
    </Sidebar>
  );
}
