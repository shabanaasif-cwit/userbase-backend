import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { AppError } from "../utils/AppError.js";
import {
  listRemindersForViewer,
  markReminderRead,
} from "../services/reminderService.js";

const router = Router();

const methodNotAllowed = (allowed) => (req, res, next) => {
  res.set("Allow", allowed);
  next(new AppError(405, `Method ${req.method} not allowed for ${req.path}`));
};

router.get(
  "/",
  verifyJwt,
  asyncHandler(async (req, res) => {
    const data = await listRemindersForViewer(req.query ?? {}, req.user);
    res.json(data);
  })
);
router.all("/", methodNotAllowed("GET"));

router.patch(
  "/:reminderId/read",
  verifyJwt,
  asyncHandler(async (req, res) => {
    const reminder = await markReminderRead(req.params.reminderId, req.user);
    res.json({ reminder });
  })
);
router.all("/:reminderId/read", methodNotAllowed("PATCH"));

export default router;

