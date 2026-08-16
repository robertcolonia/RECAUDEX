import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";

export type User = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  fullName: string;
  role: string;
  jobTitle: string | null;
  phone: string | null;
  avatarUpdatedAt: string | null;
  organizationTaxId: string | null;
};

export type Registration = {
  organizationName: string;
  organizationTaxId?: string;
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (registration: Registration) => Promise<void>;
  updateSession: (user: User, token?: string) => void;
  refreshUser: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionStorage.getItem("recaudex_token")) {
      setLoading(false);
      return;
    }
    api<{ user: User }>("/api/auth/me")
      .then((response) => setUser(response.user))
      .catch(() => sessionStorage.removeItem("recaudex_token"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user,
    loading,
    async login(email, password) {
      const response = await api<{ token: string; user: User }>("/api/auth/login", { method: "POST", anonymous: true, body: JSON.stringify({ email, password }) });
      sessionStorage.setItem("recaudex_token", response.token);
      setUser(response.user);
    },
    async register(registration) {
      const response = await api<{ token: string; user: User }>("/api/auth/register", { method: "POST", anonymous: true, body: JSON.stringify(registration) });
      sessionStorage.setItem("recaudex_token", response.token);
      setUser(response.user);
    },
    updateSession(nextUser, token) {
      if (token) sessionStorage.setItem("recaudex_token", token);
      setUser(nextUser);
    },
    async refreshUser() {
      const response = await api<{ user: User }>("/api/auth/me");
      setUser(response.user);
    },
    logout() {
      sessionStorage.removeItem("recaudex_token");
      setUser(null);
    }
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return value;
}
