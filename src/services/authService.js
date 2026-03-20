import bcrypt from "bcryptjs";
import ms from "ms";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
  };
}

async function issueSession(user) {
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });
  const { token: refreshToken, jti } = signRefreshToken({
    userId: user._id.toString(),
  });
  const expiresAt = new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL));
  await RefreshToken.create({
    userId: user._id,
    jti,
    expiresAt,
  });
  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function signup(body) {
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    throw new AppError(400, "Email and password required");
  }
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new AppError(
      400,
      `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  let user;
  try {
    user = await User.create({
      email: String(email).trim(),
      passwordHash,
      role: "user",
      accountStatus: "active",
    });
  } catch (err) {
    if (err.code === 11000) {
      throw new AppError(409, "Email already registered");
    }
    throw err;
  }
  return issueSession(user);
}

export async function login(body) {
  const email = body?.email;
  const password = body?.password;
  if (!email || !password) {
    throw new AppError(400, "Email and password required");
  }
  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  });
  if (!user?.passwordHash) {
    throw new AppError(401, "Invalid email or password");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(401, "Invalid email or password");
  }
  if (user.accountStatus !== "active") {
    throw new AppError(403, "Account deactivated");
  }
  return issueSession(user);
}

export async function refresh(refreshTokenFromCookie) {
  if (!refreshTokenFromCookie) {
    throw new AppError(401, "No refresh token");
  }
  let payload;
  try {
    payload = verifyRefreshToken(refreshTokenFromCookie);
  } catch {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  const doc = await RefreshToken.findOne({
    jti: payload.jti,
    userId: payload.sub,
  });
  if (!doc || doc.revokedAt) {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  if (doc.expiresAt.getTime() <= Date.now()) {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  const user = await User.findById(payload.sub);
  if (!user || user.accountStatus !== "active") {
    throw new AppError(401, "Invalid or expired refresh token");
  }
  doc.revokedAt = new Date();
  await doc.save();
  const accessToken = signAccessToken({
    userId: user._id.toString(),
    role: user.role,
  });
  const { token: refreshToken, jti } = signRefreshToken({
    userId: user._id.toString(),
  });
  const expiresAt = new Date(Date.now() + ms(env.REFRESH_TOKEN_TTL));
  await RefreshToken.create({
    userId: user._id,
    jti,
    expiresAt,
  });
  return {
    user: sanitizeUser(user),
    accessToken,
    refreshToken,
  };
}

export async function logout(refreshTokenFromCookie) {
  if (!refreshTokenFromCookie) return;
  try {
    const payload = verifyRefreshToken(refreshTokenFromCookie);
    await RefreshToken.updateOne(
      { jti: payload.jti, userId: payload.sub },
      { $set: { revokedAt: new Date() } }
    );
  } catch {
    // ignore invalid or expired token on logout
  }
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  if (user.accountStatus !== "active") {
    throw new AppError(403, "Account deactivated");
  }
  return sanitizeUser(user);
}
