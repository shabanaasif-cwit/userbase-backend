import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

const MAX_STRING = 8000;

function truncate(str) {
  if (str.length <= MAX_STRING) return str;
  return `${str.slice(0, MAX_STRING)}…`;
}

/**
 * Builds a compact, size-bounded payload for terminal logging from the request body.
 */
function buildReportPayload(body, req) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { note: "non-object body", receivedType: typeof body };
  }

  const out = {
    reportedAt: new Date().toISOString(),
    userAgent: req.get("user-agent") ?? null,
  };

  const stringKeys = [
    "message",
    "name",
    "stack",
    "componentStack",
    "filename",
    "url",
    "source",
    "reason",
    "digest",
  ];
  for (const key of stringKeys) {
    const v = body[key];
    if (v != null && typeof v === "string") {
      out[key] = truncate(v);
    }
  }

  for (const key of ["line", "column", "lineno", "colno"]) {
    const v = body[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    }
  }

  return out;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = buildReportPayload(req.body, req);
    console.error("[frontend-error]", JSON.stringify(payload));
    res.status(204).send();
  })
);

export default router;
