"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const API_ROOT =
  process.env.NEXT_PUBLIC_API_ROOT ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

const TOKEN_KEY = "virsa_token";
const VAULT_KEY = "virsa_vault_id";
const USER_KEY = "virsa_user";

type User = { id: string; email: string; display_name?: string };

export type VaultSummary = {
  id: string;
  name: string;
  plan?: string;
  plan_status?: string;
  kinship_system?: string;
  story_limit?: number | null;
  member_limit?: number | null;
  role?: string;
};

type AuthState = {
  user: User | null;
  token: string | null;
  vaultId: string | null;
  vaults: VaultSummary[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ onboarding: boolean }>;
  logout: () => void;
  setVaultId: (id: string) => void;
  refreshVaults: () => Promise<void>;
  authHeaders: () => Record<string, string>;
  /** Authenticated fetch; appends vault_id query when opts.vault is true (default). */
  apiFetch: (
    path: string,
    init?: RequestInit & { vault?: boolean; json?: unknown }
  ) => Promise<Response>;
  apiRoot: string;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vaultId, setVaultIdState] = useState<string | null>(null);
  const [vaults, setVaults] = useState<VaultSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshVaults = useCallback(async (authToken?: string | null) => {
    const t = authToken ?? localStorage.getItem(TOKEN_KEY);
    if (!t) {
      setVaults([]);
      return;
    }
    try {
      const res = await fetch(`${API_ROOT}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: VaultSummary[] = data.vaults || [];
      setVaults(list);
      const current = localStorage.getItem(VAULT_KEY);
      if (list.length && (!current || !list.some((v) => v.id === current))) {
        localStorage.setItem(VAULT_KEY, list[0].id);
        setVaultIdState(list[0].id);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      const v = localStorage.getItem(VAULT_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        setVaultIdState(v);
        void refreshVaults(t);
      }
    } finally {
      setLoading(false);
    }
  }, [refreshVaults]);

  const persist = (t: string, u: User, v: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem(VAULT_KEY, v);
    setToken(t);
    setUser(u);
    setVaultIdState(v);
  };

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_ROOT}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Login failed");
      persist(data.token, data.user, data.vault_id);
      await refreshVaults(data.token);
    },
    [refreshVaults]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const res = await fetch(`${API_ROOT}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      persist(data.token, data.user, data.vault_id);
      await refreshVaults(data.token);
      return { onboarding: Boolean(data.onboarding) };
    },
    [refreshVaults]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VAULT_KEY);
    setToken(null);
    setUser(null);
    setVaultIdState(null);
    setVaults([]);
  }, []);

  const setVaultId = useCallback((id: string) => {
    localStorage.setItem(VAULT_KEY, id);
    setVaultIdState(id);
  }, []);

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const apiFetch = useCallback(
    async (
      path: string,
      init?: RequestInit & { vault?: boolean; json?: unknown }
    ) => {
      const { vault = true, json, headers: initHeaders, ...rest } = init || {};
      const headers = new Headers(initHeaders || {});
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (json !== undefined) {
        headers.set("Content-Type", "application/json");
      }
      const base = API_ROOT.replace(/\/$/, "");
      const raw = path.startsWith("http")
        ? path
        : `${base}${path.startsWith("/") ? path : `/${path}`}`;
      const url = new URL(raw);
      if (vault && vaultId && !url.searchParams.has("vault_id")) {
        url.searchParams.set("vault_id", vaultId);
      }
      return fetch(url.toString(), {
        ...rest,
        headers,
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
    },
    [token, vaultId]
  );

  const value = useMemo(
    () => ({
      user,
      token,
      vaultId,
      vaults,
      loading,
      login,
      register,
      logout,
      setVaultId,
      refreshVaults: () => refreshVaults(),
      authHeaders,
      apiFetch,
      apiRoot: API_ROOT,
    }),
    [
      user,
      token,
      vaultId,
      vaults,
      loading,
      login,
      register,
      logout,
      setVaultId,
      refreshVaults,
      authHeaders,
      apiFetch,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { API_ROOT };
