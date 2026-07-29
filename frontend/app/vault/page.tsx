"use client";

import { useEffect, useState } from "react";
import Sidebar from "../components/DashboardLayout";
import { RequireAuth } from "../components/RequireAuth";
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

type Invite = {
  id: string;
  email: string;
  role: string;
  status: string;
  invite_url?: string | null;
  expires_at?: string;
};

export default function VaultSettingsPage() {
  const { apiRoot, vaultId, authHeaders } = useAuth();
  const [vault, setVault] = useState<Vault | null>(null);
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);

  const vid = vaultId || "";

  const loadInvites = async () => {
    if (!vid) return;
    const res = await fetch(
      `${apiRoot}/vaults/invites?vault_id=${encodeURIComponent(vid)}`,
      { headers: authHeaders() }
    );
    if (!res.ok) return;
    const data = await res.json();
    setInvites(data.invites || []);
  };

  useEffect(() => {
    if (!vid) {
      setLoadError("No vault selected. Sign in again.");
      return;
    }
    fetch(`${apiRoot}/vault?vault_id=${encodeURIComponent(vid)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Vault not found");
        setVault(await r.json());
        setLoadError(null);
      })
      .catch(() => {
        setVault(null);
        setLoadError("Could not load vault settings.");
      });
    void loadInvites();
  }, [apiRoot, vid]);

  const save = async () => {
    if (!vault) return;
    setSaved(false);
    const res = await fetch(`${apiRoot}/vault`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        vault_id: vid,
        name: vault.name,
        cultural_context: vault.cultural_context,
        kinship_system: vault.kinship_system,
        primary_language: vault.primary_language,
      }),
    });
    if (!res.ok) return;
    setVault(await res.json());
    setSaved(true);
  };

  const sendInvite = async () => {
    setInviteBusy(true);
    setInviteMsg(null);
    try {
      const res = await fetch(`${apiRoot}/vaults/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          vault_id: vid,
          email: inviteEmail,
          role: "editor",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Invite failed");
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${data.invite_url}`
          : data.invite_url;
      try {
        await navigator.clipboard.writeText(url);
        setInviteMsg(`Invite link copied for ${data.email}`);
      } catch {
        setInviteMsg(`Invite created: ${url}`);
      }
      setInviteEmail("");
      await loadInvites();
    } catch (e: unknown) {
      setInviteMsg(e instanceof Error ? e.message : "Invite failed");
    } finally {
      setInviteBusy(false);
    }
  };

  const revoke = async (id: string) => {
    await fetch(`${apiRoot}/vaults/invites/${id}/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ vault_id: vid }),
    });
    await loadInvites();
  };

  return (
    <RequireAuth>
      <Sidebar>
        <div className="max-w-xl">
          <p className="label-eyebrow mb-3">Family vault</p>
          <h1 className="font-display text-4xl text-ink mb-3">Culture & kinship</h1>
          <p className="text-ink-soft mb-8 leading-relaxed">
            Virsa uses this context to label relatives with culturally correct
            kinship terms on the family tree.
          </p>

          {loadError && (
            <p className="text-sm text-[#9b2c2c] mb-6">{loadError}</p>
          )}

          {!vault && !loadError && (
            <p className="text-ink-soft">Loading vault…</p>
          )}

          {vault && (
            <>
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
            </>
          )}

          <div className="mt-14 pt-10 border-t border-line">
            <h2 className="font-display text-2xl text-ink mb-2">Invite family</h2>
            <p className="text-sm text-ink-soft mb-5 leading-relaxed">
              Send a link (email delivery comes with Stripe ship). They must use
              the invited email to accept.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <input
                className="field"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="relative@email.com"
              />
              <button
                type="button"
                disabled={inviteBusy || !inviteEmail.trim()}
                onClick={() => void sendInvite()}
                className="btn-accent shrink-0"
              >
                {inviteBusy ? "Creating…" : "Create invite link"}
              </button>
            </div>
            {inviteMsg && (
              <p className="text-sm text-ink-soft mb-4 break-all">{inviteMsg}</p>
            )}
            {invites.length > 0 && (
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <span className="font-medium text-ink">{inv.email}</span>
                      <span className="text-ink-soft">
                        {" "}
                        · {inv.role} · {inv.status}
                      </span>
                    </div>
                    {inv.status === "pending" && (
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#9b2c2c] hover:underline"
                        onClick={() => void revoke(inv.id)}
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Sidebar>
    </RequireAuth>
  );
}
