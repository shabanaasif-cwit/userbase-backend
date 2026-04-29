import ms from "ms";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

export function refreshCookieOptions(refreshTokenTtl = env.REFRESH_TOKEN_TTL) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: ms(refreshTokenTtl),
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
