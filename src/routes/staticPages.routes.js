import { Router } from "express";

const router = Router();

/**
 * Lightweight GET endpoints for static marketing/content paths. When the SPA
 * calls these on route enter (same API origin), access logs show e.g. GET /gallery
 * alongside GET /api/notifications.
 */
const STATIC_PAGES = [
  ["/gallery", "gallery", "Gallery"],
  ["/contact", "contact", "Contact"],
  ["/about", "about", "About"],
];

for (const [path, page, title] of STATIC_PAGES) {
  router.get(path, (_req, res) => {
    res.json({
      kind: "static-route",
      page,
      title,
      status: "ok",
    });
  });
}

export default router;
