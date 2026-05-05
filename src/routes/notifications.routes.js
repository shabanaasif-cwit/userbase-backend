import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireRole } from "../middleware/requireRole.js";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { AppError } from "../utils/AppError.js";
import {
  createNotification,
  deleteNotification,
  listNotificationsForViewer,
  markNotificationRead,
  updateNotification,
} from "../services/notificationService.js";
import { createReminderFromNotification } from "../services/reminderService.js";
import {
  emitNotificationCreated,
  emitNotificationDeleted,
  emitNotificationRead,
  emitNotificationUpdated,
  emitReminderCreated,
} from "../realtime/socketHub.js";

const router = Router();
const adminOnly = [verifyJwt, requireRole("admin")];

const methodNotAllowed = (allowed) => (req, res, next) => {
  res.set("Allow", allowed);
  next(new AppError(405, `Method ${req.method} not allowed for ${req.path}`));
};

router.get(
  "/",
  verifyJwt,
  asyncHandler(async (req, res) => {
    const data = await listNotificationsForViewer(req.query ?? {}, req.user);
    res.json(data);
  })
);
router.post(
  "/",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const notification = await createNotification(req.body ?? {}, req.user);
    emitNotificationCreated(notification);
    res.locals.__adminNotificationCreatedId = notification.id;
    res.status(201).json({ notification });
  })
);
router.all("/", methodNotAllowed("GET, POST"));

router.patch(
  "/:notificationId",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const { notification, changedFieldKeys } = await updateNotification(
      req.params.notificationId,
      req.body ?? {}
    );
    emitNotificationUpdated(notification);
    res.locals.__adminNotificationChangedFieldKeys = changedFieldKeys;
    res.json({ notification });
  })
);
router.delete(
  "/:notificationId",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const notification = await deleteNotification(req.params.notificationId);
    emitNotificationDeleted(notification);
    res.status(204).send();
  })
);
router.all("/:notificationId", methodNotAllowed("PATCH, DELETE"));

router.post(
  "/:notificationId/remind",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const reminder = await createReminderFromNotification(
      req.params.notificationId,
      req.body,
      req.user
    );
    emitReminderCreated(reminder);
    res.status(201).json({ reminder });
  })
);
router.all("/:notificationId/remind", methodNotAllowed("POST"));

router.patch(
  "/:notificationId/read",
  verifyJwt,
  asyncHandler(async (req, res) => {
    const notification = await markNotificationRead(
      req.params.notificationId,
      req.user
    );
    emitNotificationRead(req.user.userId, notification);
    res.json({ notification });
  })
);
router.all("/:notificationId/read", methodNotAllowed("PATCH"));

export default router;
