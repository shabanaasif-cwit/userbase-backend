import { AppError } from "../utils/AppError.js";
import { verifyAccessToken } from "../utils/jwt.js";

export function verifyJwt(req, _res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next(new AppError(401, "Unauthorized"));
  }
  const token = auth.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      userId: payload.sub,
      role: payload.role,
    };
    next();
  } catch {
    next(new AppError(401, "Unauthorized"));
  }
}
