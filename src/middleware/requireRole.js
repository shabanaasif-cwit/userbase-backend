import { AppError } from "../utils/AppError.js";

export function requireRole(...allowedRoles) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role) {
      return next(new AppError(401, "Unauthorized"));
    }
    if (!allowedRoles.includes(role)) {
      return next(new AppError(403, "Forbidden (admin only)"));
    }
    next();
  };
}
