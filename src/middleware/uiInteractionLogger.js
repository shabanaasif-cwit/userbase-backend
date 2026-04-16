import { env } from "../config/env.js";

/**
 * Local address this connection hit (Express listener), e.g. 127.0.0.1:3001.
 */
function serverEndpoint(req) {
  const lp = req.socket?.localPort;
  const la = req.socket?.localAddress;
  if (lp != null && la != null) {
    const host =
      la === "::1" || la === "::ffff:127.0.0.1"
        ? "127.0.0.1"
        : la === "::"
          ? "0.0.0.0"
          : la;
    return `${host}:${lp}`;
  }
  if (lp != null) {
    return `127.0.0.1:${lp}`;
  }
  return `127.0.0.1:${env.PORT}`;
}

function statusLabel(code) {
  if (code >= 500) return "ERR";
  if (code >= 400) return "ERR";
  return "OK";
}

export function uiInteractionLogger(req, res, next) {
  if (req.method === "GET" && req.path === "/health") {
    next();
    return;
  }

  const path = req.path;
  const server = serverEndpoint(req);

  if (req.method === "POST" && path === "/api/auth/login" && req.body?.email) {
    console.log(
      `INFO: ${server} - [LOGIN] Attempting login for: ${req.body.email}`
    );
  }
  if (req.method === "POST" && path === "/api/auth/signup" && req.body?.email) {
    console.log(
      `INFO: ${server} - [SIGNUP] Attempting signup for: ${req.body.email}`
    );
  }

  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const requestLine = `${req.method} ${req.originalUrl} HTTP`;
    const label = statusLabel(res.statusCode);
    const errDetail =
      res.statusCode >= 400 && res.locals.__clientErrorText
        ? ` "${res.locals.__clientErrorText}"`
        : "";
    console.log(
      `INFO: ${server} - ${requestLine} ${res.statusCode} ${label}${errDetail} ${durationMs}ms`
    );

    const authz = req.headers.authorization;
    const hasBearer = typeof authz === "string" && authz.startsWith("Bearer ");

    if (hasBearer) {
      if (req.user) {
        console.log(
          `INFO: ${server} - [JWT] authenticated userId=${req.user.userId} role=${req.user.role} | ${req.method} ${path}`
        );
      } else if (res.statusCode === 401) {
        console.log(
          `INFO: ${server} - [JWT] rejected or unauthorized | ${req.method} ${path}`
        );
      }
    }

    if (path === "/api/auth/login" && req.method === "POST" && res.statusCode === 200 && req.body?.email) {
      console.log(`INFO: ${server} - [AUTH] User authenticated: ${req.body.email}`);
    }
    if (path === "/api/auth/signup" && req.method === "POST" && res.statusCode === 201 && req.body?.email) {
      console.log(`INFO: ${server} - [AUTH] User registered: ${req.body.email}`);
    }
    if (path === "/api/auth/logout" && req.method === "POST" && res.statusCode === 204) {
      console.log(`INFO: ${server} - [LOGOUT] Session cleared`);
    }
    if (path === "/api/auth/refresh" && req.method === "POST" && res.statusCode === 200) {
      console.log(`INFO: ${server} - [REFRESH] Access token refreshed`);
    }
  });

  next();
}
