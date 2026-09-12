import type { CookieOptions, Response } from "express";

export const AUTH_COOKIE_NAME = "token";

// 7d to match JWT expiresIn in AuthUtils.generateToken
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function getAuthCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: SEVEN_DAYS_MS,
    path: "/",
  };
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, {
    ...getAuthCookieOptions(),
    maxAge: undefined,
  });
}
