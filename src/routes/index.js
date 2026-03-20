import { Router } from "express";
import { isMongoConnected } from "../db/connect.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json({ message: "userbase-backend API" });
});

router.get("/health", (_req, res) => {
  const dbOk = isMongoConnected();
  res.status(dbOk ? 200 : 503).json({
    ok: dbOk,
    service: "userbase-backend",
    db: dbOk ? "connected" : "unavailable",
  });
});

export default router;
