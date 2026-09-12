import { create } from "zustand";
import { api, apiErrorMessage, setStoredToken } from "../lib/api";
import type { ApiUser } from "../lib/types";

export type AuthStatus = "loading" | "authed" | "guest";
export type AppView = "landing" | "login" | "app";

interface AuthState {
  user: ApiUser | null;
  status: AuthStatus;
  view: AppView;
  lastError: string | null;
  go: (view: AppView) => void;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  status: "loading",
  view: "landing",
  lastError: null,

  go: (view) => set({ view, lastError: null }),

  bootstrap: async () => {
    try {
      const res = await api.get<{ user: ApiUser }>("/v1/auth/me");
      set({ user: res.data.user, status: "authed" });
    } catch {
      setStoredToken(null);
      set({ user: null, status: "guest" });
    }
  },

  login: async (email, password) => {
    set({ lastError: null });
    try {
      const res = await api.post<{ user: ApiUser; token: string }>(
        "/v1/auth/login",
        { email, password },
      );
      setStoredToken(res.data.token); // Bearer fallback; cookie is httpOnly
      set({ user: res.data.user, status: "authed", view: "app" });
      return true;
    } catch (err) {
      set({ lastError: apiErrorMessage(err) });
      return false;
    }
  },

  logout: async () => {
    try {
      await api.post("/v1/auth/logout");
    } catch {
      // logout is best-effort — clear local state regardless
    }
    setStoredToken(null);
    set({ user: null, status: "guest", view: "landing" });
  },
}));
