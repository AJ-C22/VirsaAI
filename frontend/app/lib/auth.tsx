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

type AuthState = {
  user: User | null;
  token: string | null;
  vaultId: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ onboarding: boolean }>;
  logout: () => void;
  setVaultId: (id: string) => void;
  authHeaders: () => Record<string, string>;
  apiRoot: string;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [vaultId, setVaultIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const t = localStorage.getItem(TOKEN_KEY);
      const u = localStorage.getItem(USER_KEY);
      const v = localStorage.getItem(VAULT_KEY);
      if (t && u) {
        setToken(t);
        setUser(JSON.parse(u));
        setVaultIdState(v);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const persist = (t: string, u: User, v: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    localStorage.setItem(VAULT_KEY, v);
    setToken(t);
    setUser(u);
    setVaultIdState(v);
  };

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_ROOT}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");
    persist(data.token, data.user, data.vault_id);
  }, []);

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
      return { onboarding: Boolean(data.onboarding) };
    },
    []
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(VAULT_KEY);
    setToken(null);
    setUser(null);
    setVaultIdState(null);
  }, []);

  const setVaultId = useCallback((id: string) => {
    localStorage.setItem(VAULT_KEY, id);
    setVaultIdState(id);
  }, []);

  const authHeaders = useCallback(() => {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      vaultId,
      loading,
      login,
      register,
      logout,
      setVaultId,
      authHeaders,
      apiRoot: API_ROOT,
    }),
    [user, token, vaultId, loading, login, register, logout, setVaultId, authHeaders]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { API_ROOT };
