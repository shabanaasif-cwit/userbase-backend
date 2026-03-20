function required(name) {
  const value = process.env[name];
  if (value === undefined || String(value).trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return String(value).trim();
}

const portRaw = process.env.PORT;
const port = portRaw !== undefined && portRaw !== "" ? Number(portRaw) : 3001;

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
};
