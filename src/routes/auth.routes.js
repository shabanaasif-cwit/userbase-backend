import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { verifyJwt } from "../middleware/verifyJwt.js";
import * as authService from "../services/authService.js";
import { AppError } from "../utils/AppError.js";
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
  clearRefreshCookie,
} from "../utils/authCookies.js";

const router = Router();
const methodNotAllowed = (allowed) => (req, res, next) => {
  res.set("Allow", allowed);
  next(new AppError(405, `Method ${req.method} not allowed for ${req.path}`));
};

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.signup(
      req.body ?? {}
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.status(201).json({ user, accessToken });
  })
);
router.all("/signup", methodNotAllowed("POST"));

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body ?? {}
    );
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ user, accessToken });
  })
);
router.all("/login", methodNotAllowed("POST"));

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE_NAME];
    const { user, accessToken, refreshToken } =
      await authService.refresh(token);
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions());
    res.json({ user, accessToken });
  })
);
router.all("/refresh", methodNotAllowed("POST"));

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const token = req.cookies[REFRESH_COOKIE_NAME];
    await authService.logout(token);
    clearRefreshCookie(res);
    res.status(204).send();
  })
);
router.all("/logout", methodNotAllowed("POST"));

router.get(
  "/me",
  verifyJwt,
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user.userId);
    res.json({ user });
  })
);
router.all("/me", methodNotAllowed("GET"));

export default router;
