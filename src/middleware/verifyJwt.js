import { AppError } from "../utils/AppError.js";
import { verifyAccessToken, signAccessToken, verifyRefreshToken } from "../utils/jwt.js";
import { REFRESH_COOKIE_NAME } from "../utils/authCookies.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { AdminUser } from "../models/AdminUser.js";

/** Browser clients must read this (CORS exposed) and replace stored Bearer when present. */
export const ACCESS_TOKEN_RENEWAL_HEADER = "X-New-Access-Token";

function attachRenewedAccessOnSend(res, newToken) {
  if (res.locals.__accessRenewalPatched) return;
  res.locals.__accessRenewalPatched = true;
  const stamp = () => {
    res.setHeader(ACCESS_TOKEN_RENEWAL_HEADER, newToken);
  };
  const origJson = res.json.bind(res);
  res.json = (...args) => {
    stamp();
    return origJson(...args);
  };
  const origSend = res.send.bind(res);
  res.send = (...args) => {
    stamp();
    return origSend(...args);
  };
}

async function tryRecoverSessionFromRefreshCookie(req, res) {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken) return false;
  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenDoc = await RefreshToken.findOne({
      jti: payload.jti,
      userId: payload.sub,
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    })
      .select("_id")
      .lean();
    if (!tokenDoc) return false;
    const user =
      (await User.findById(payload.sub).select("_id role accountStatus").lean()) ??
      (await AdminUser.findById(payload.sub).select("_id role accountStatus").lean());
    if (!user || user.accountStatus !== "active") return false;
    const accessToken = signAccessToken({
      userId: user._id.toString(),
      role: user.role,
    });
    req.user = {
      userId: user._id.toString(),
      role: user.role,
    };
    attachRenewedAccessOnSend(res, accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function verifyJwt(req, res, next) {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    //This removes "Bearer " from the Authorization header and returns the just token.
    //auth = "Bearer abc123token"
    //token = "abc123token"
    const token = auth.slice(7);
    try {
      const payload = verifyAccessToken(token);
      req.user = {
        userId: payload.sub,
        role: payload.role,
      };
      const newAccessToken = signAccessToken({
        userId: payload.sub,
        role: payload.role,
      });
      attachRenewedAccessOnSend(res, newAccessToken);
      return next();
    } catch {
      // fall through to refresh-cookie recovery
    }
  }
  const recovered = await tryRecoverSessionFromRefreshCookie(req, res);
  if (recovered) return next();
  return next(new AppError(401, "Unauthorized"));
}
