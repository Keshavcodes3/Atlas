import axios, { AxiosError } from "axios";
import type { ApiErrorShape } from "./types";

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "atlas_token";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private-mode browsers — token stays in memory only
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // backend sets httpOnly `token` cookie
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function apiErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const data = err.response?.data as ApiErrorShape | undefined;
    if (data?.error?.message) return data.error.message;
    if (err.code === "ECONNABORTED") return "Request timed out. Try again.";
    if (err.message === "Network Error")
      return `Cannot reach API at ${API_BASE_URL}. Is the server running?`;
    return err.message || "Request failed";
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
