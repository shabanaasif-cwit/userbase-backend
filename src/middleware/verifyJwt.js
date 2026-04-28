import { AppError } from "../utils/AppError.js";
import { verifyAccessToken, signAccessToken } from "../utils/jwt.js";

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

export function verifyJwt(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return next(new AppError(401, "Unauthorized"));
  }
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
    next();
  } catch {
    next(new AppError(401, "Unauthorized"));
  }
}
