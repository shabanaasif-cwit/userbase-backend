import ms from "ms";

function required(name) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

/** @param {string} envKey */
function durationEnv(envKey, fallback) {
  const value = process.env[envKey]?.trim() || fallback;
  const n = ms(value);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(
      `${envKey} must be a valid positive duration (e.g. 15m, 1h, 7d)`
    );
  }
  return value;
}
/** It simply means: if process.env.PORT is not set, then use 3001 as the default port. */
const portRaw = process.env.PORT;
const port = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 3001;

//if port is not real number or less than 1, then throw an error instead of running with bad port
if (Number.isNaN(port) || port < 1) {
  throw new Error("PORT must be a positive number");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  PORT: port,
  MONGODB_URI: required("MONGODB_URI"),
  /** Browser origin for CORS + future httpOnly refresh cookies (no wildcard with credentials). */
  FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN?.trim() || "http://localhost:5173",

  JWT_ACCESS_SECRET: required("JWT_ACCESS_SECRET"),
  JWT_REFRESH_SECRET: required("JWT_REFRESH_SECRET"),
  ACCESS_TOKEN_TTL: durationEnv("ACCESS_TOKEN_TTL", "15m"),
  REFRESH_TOKEN_TTL: durationEnv("REFRESH_TOKEN_TTL", "7d"),
};
