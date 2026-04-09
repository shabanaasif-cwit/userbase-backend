import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireRole } from "../middleware/requireRole.js";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { AppError } from "../utils/AppError.js";
import {
  deactivateUser,
  listUsers,
  toggleUserAccountStatus,
  updateUserByAdmin,
} from "../services/userAdminService.js";

const router = Router();
const adminOnly = [verifyJwt, requireRole("admin")];

const methodNotAllowed = (allowed) => (req, res, next) => {
  res.set("Allow", allowed);
  next(new AppError(405, `Method ${req.method} not allowed for ${req.path}`));
};

router.get(
  "/",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const data = await listUsers(req.query ?? {});
    res.json(data);
  })
);
router.all("/", methodNotAllowed("GET"));

router.patch(
  "/:userId",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const user = await updateUserByAdmin(req.params.userId, req.body ?? {});
    res.json({ user });
  })
);
router.all("/:userId", methodNotAllowed("PATCH"));

router.patch(
  "/:userId/deactivate",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const user = await deactivateUser(req.params.userId);
    res.json({ user });
  })
);
router.all("/:userId/deactivate", methodNotAllowed("PATCH"));

router.patch(
  "/:userId/toggle-account",
  ...adminOnly,
  asyncHandler(async (req, res) => {
    const user = await toggleUserAccountStatus(req.params.userId);
    res.json({ user });
  })
);
router.all("/:userId/toggle-account", methodNotAllowed("PATCH"));

export default router;