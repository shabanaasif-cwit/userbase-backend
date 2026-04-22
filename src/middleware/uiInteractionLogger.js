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

/** Prefer `originalUrl` so auth paths match even when `req.path` differs (proxy / mount quirks). */
function normalizedPathname(req) {
  let raw = String(req.originalUrl ?? "").split("?")[0];
  if (!raw) raw = String(req.url ?? "").split("?")[0];
  if (!raw) raw = String(req.path ?? "");
  while (raw.length > 1 && raw.endsWith("/")) {
    raw = raw.slice(0, -1);
  }
  return raw;
}

function isAuthLoginPath(p) {
  return p === "/api/auth/login" || p === "/auth/login";
}

export function isAuthSignupPath(p) {
  return p === "/api/auth/signup" || p === "/auth/signup";
}

/** Mirrors `login()` order for early 400s so terminal still shows text if `__clientErrorText` is missing. */
export function inferLoginValidationMessage(req) {
  const body = req.body ?? {};
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = body.password;
  if (email && !email.includes("@")) return "Missing @ symbol";
  if (!email) return "Email is missing";
  if (!password) return "Password is missing";
  return "";
}

function inferSignupMissingAtMessage(req) {
  const body = req.body ?? {};
  const email = String(body.email ?? "").trim().toLowerCase();
  if (email && !email.includes("@")) return "Missing @ symbol";
  return "";
}

/** Matches PATCH /api/notifications/:id so logs match validation when __clientErrorText is unset. */
function isNotificationUpdatePath(path) {
  return /^\/api\/notifications\/[a-f0-9]{24}$/i.test(path);
}

/**
 * Mirrors validateUpdateNotificationPayload: no title/body/targetType means no patch.
 * Used when a 400 occurs but error middleware did not set __clientErrorText.
 */
export function inferNotificationPatchNoEffectiveFieldsMessage(req, path) {
  if (!isNotificationUpdatePath(path)) return "";
  const body = req.body ?? {};
  const hasEffective =
    Object.prototype.hasOwnProperty.call(body, "title") ||
    Object.prototype.hasOwnProperty.call(body, "body") ||
    Object.prototype.hasOwnProperty.call(body, "targetType");
  if (!hasEffective) return "No fields are updated";
  return "";
}

/** Keys present on PATCH body for admin notification edit (matches update payload shape). */
function adminNotificationPatchFieldKeys(body) {
  const b = body ?? {};
  return ["title", "body", "targetType", "targetUsers", "targetRoles"].filter(
    (k) => Object.prototype.hasOwnProperty.call(b, k)
  );
}

export function uiInteractionLogger(req, res, next) {
  const path = normalizedPathname(req);

  if (req.method === "GET" && path === "/health") {
    next();
    return;
  }

  const server = serverEndpoint(req);

  if (req.method === "POST" && isAuthLoginPath(path)) {
    const body = req.body ?? {};
    const loginEmail = String(body.email ?? "").trim().toLowerCase();
    const loginPassword = body.password;

    if (!loginEmail) {
      console.log(`INFO: ${server} - [LOGIN] Email is missing`);
    } else {
      console.log(
        `INFO: ${server} - [LOGIN] Attempting login for: ${body.email}`
      );
      if (!loginEmail.includes("@")) {
        console.log(`INFO: ${server} - [LOGIN] Missing @ symbol`);
      } else if (!loginPassword) {
        console.log(`INFO: ${server} - [LOGIN] Password is missing`);
      }
    }
  }
  if (req.method === "POST" && isAuthSignupPath(path)) {
    const body = req.body ?? {};
    const signupEmail = String(body.email ?? "").trim().toLowerCase();
    if (signupEmail) {
      console.log(
        `INFO: ${server} - [SIGNUP] Attempting signup for: ${body.email}`
      );
      if (!signupEmail.includes("@")) {
        console.log(`INFO: ${server} - [SIGNUP] Missing @ symbol`);
      }
    }
  }

  const started = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - started;
    const requestLine = `${req.method} ${req.originalUrl} HTTP`;
    const label = statusLabel(res.statusCode);

    let clientErr = res.locals.__clientErrorText;
    if (!clientErr && res.statusCode === 400) {
      if (req.method === "POST") {
        if (isAuthLoginPath(path)) {
          clientErr = inferLoginValidationMessage(req);
        } else if (isAuthSignupPath(path)) {
          clientErr = inferSignupMissingAtMessage(req);
        }
      } else if (req.method === "PATCH") {
        clientErr = inferNotificationPatchNoEffectiveFieldsMessage(req, path);
      }
    }
    const errDetail =
      res.statusCode >= 400 && clientErr ? ` "${clientErr}"` : "";

    const authz = req.headers.authorization;
    const hasBearer = typeof authz === "string" && authz.startsWith("Bearer ");
    let jwtSuffix = "";
    if (hasBearer) {
      if (req.user) {
        jwtSuffix = ` [JWT userId=${req.user.userId} role=${req.user.role}]`;
      } else if (res.statusCode === 401) {
        jwtSuffix = " [JWT unauthorized]";
      }
    }

    const accessLine = `INFO: ${server} - ${requestLine} ${res.statusCode} ${label}${errDetail} ${durationMs}ms${jwtSuffix}`;
    if (res.statusCode >= 400) {
      console.error(accessLine);
    } else {
      console.log(accessLine);
    }

    /* ---- Notification Admin Actions ---- */
    const notificationId = req.params?.notificationId;

    if (path === "/api/notifications" && req.method === "POST") {
      if (res.statusCode === 201) {
        const createdId = res.locals.__adminNotificationCreatedId;
        const body = req.body ?? {};
        const title =
          typeof body.title === "string"
            ? body.title.trim().slice(0, 120).replace(/\s+/g, " ")
            : "";
        console.log(
          `INFO: ${server} - [ADMIN_UI] Notification sent [notificationId=${createdId}] [title=${JSON.stringify(title)}] [targetType=${String(body.targetType ?? "")}]`
        );
      }
    }

    if (
      /^\/api\/notifications\/[a-f0-9]{24}$/i.test(path) &&
      req.method === "PATCH"
    ) {
      if (res.statusCode === 200) {
        const changed = res.locals.__adminNotificationChangedFieldKeys;
        if (Array.isArray(changed) && changed.length === 0) {
          console.log(
            `INFO: ${server} - [ADMIN_UI] Notification not updated (no data changes) [notificationId=${notificationId}]`
          );
        } else if (Array.isArray(changed) && changed.length > 0) {
          console.log(
            `INFO: ${server} - [ADMIN_UI] Notification Updated [notificationId=${notificationId}] [updatedFields=${changed.join(",")}]`
          );
        } else {
          const updatedFields = adminNotificationPatchFieldKeys(req.body);
          const fieldsPart =
            updatedFields.length > 0
              ? ` [updatedFields=${updatedFields.join(",")}]`
              : " [updatedFields=no field is updated]";
          console.log(
            `INFO: ${server} - [ADMIN_UI] Notification Updated [notificationId=${notificationId}]${fieldsPart}`
          );
        }
      }
    }
    
    if (
      /^\/api\/notifications\/[a-f0-9]{24}\/remind$/i.test(path) &&
      req.method === "POST"
      ) {
        if (res.statusCode === 201) {
          console.log(
            `INFO: ${server} - [ADMIN_UI] Reminder Sent [notificationId=${notificationId}]`
          );
        }
      }
    
    if (
      /^\/api\/notifications\/[a-f0-9]{24}$/i.test(path) &&
      req.method === "DELETE"
    ) {
      console.log(
        `INFO: ${server} - [ADMIN_UI] Notification Delete Clicked [notificationId=${notificationId}]`
      );
    
      if (res.statusCode === 204) {
        console.log(
          `INFO: ${server} - [ADMIN_UI] Notification Deleted [notificationId=${notificationId}]`
        );
      }
    }

     /* ---- Auth Actions ---- */

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
