import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken({ userId, role }) {
  return jwt.sign(
    { sub: userId, role, typ: "access" },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL }
  );
}

export function signRefreshToken({
  userId,
  expiresIn = env.REFRESH_TOKEN_TTL,
  rememberMe = false,
}) {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: userId, jti, typ: "refresh", rm: rememberMe ? 1 : 0 },
    env.JWT_REFRESH_SECRET,
    { expiresIn }
  );
  return { token, jti };
}

export function verifyAccessToken(token) {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (decoded.typ !== "access") {
    throw new jwt.JsonWebTokenError("Invalid token type");
  }
  return decoded;
}

export function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (decoded.typ !== "refresh") {
    throw new jwt.JsonWebTokenError("Invalid token type");
  }
  return decoded;
}
