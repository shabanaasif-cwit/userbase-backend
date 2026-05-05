import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { AppError } from "../utils/AppError.js";

const router = Router();

const MAX_PATH = 500;
const MAX_TITLE = 200;

function normalizePath(raw) {
  const s = String(raw).trim();
  if (!s) return "";
  const withSlash = s.startsWith("/") ? s : `/${s}`;
  return withSlash.length > MAX_PATH ? withSlash.slice(0, MAX_PATH) : withSlash;
}

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    if (typeof body.path !== "string" || !body.path.trim()) {
      throw new AppError(400, "path is required");
    }

    const path = normalizePath(body.path);
    if (!path) {
      throw new AppError(400, "path is required");
    }

    let title;
    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim().slice(0, MAX_TITLE);
    }

    const payload = {
      at: new Date().toISOString(),
      path,
      ...(title ? { title } : {}),
      userAgent: req.get("user-agent") ?? undefined,
    };

    console.log("[navigation]", JSON.stringify(payload));
    res.status(204).send();
  })
);

export default router;
