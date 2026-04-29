import ms from "ms";
import { env } from "../config/env.js";

export const REFRESH_COOKIE_NAME = "refreshToken";

export function refreshCookieOptions(refreshTokenTtl = env.REFRESH_TOKEN_TTL) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    // Keep refresh cookie available on protected API routes for silent recovery.
    path: "/",
    maxAge: ms(refreshTokenTtl),
  };
}

export function clearRefreshCookie(res) {
  const baseOptions = {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
  };
  // Clear current cookie path.
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseOptions,
    path: "/",
  });
  // Backward-compat: clear old cookie path used previously.
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseOptions,
    path: "/api/auth",
  });
}
