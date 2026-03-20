import ms from "ms";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: ms(env.REFRESH_TOKEN_TTL),
  };
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
  });
}
