import bcrypt from "bcryptjs";
import ms from "ms";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { AdminUser } from "../models/AdminUser.js";
import { User } from "../models/User.js";
import { assertNonEmptyEmailLocal } from "../utils/email.js";
import { AppError } from "../utils/AppError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/jwt.js";

const SALT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 64;
const ALLOWED_ROLES = ["user", "admin"];
const HAS_WHITESPACE = /\s/;
const HAS_BACKTICK = /`/;
const HAS_NUMBER = /\d/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;
const HAS_TLD = /^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/;
const MAX_EMAIL_LOCAL_LENGTH = 20;
const STARTS_WITH_CAPITAL = /^[A-Z]/;

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    firstName: user.firstName,   // Add firstName
    lastName: user.lastName,     // Add lastName
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
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = body?.password;
  const confirmPassword = body?.confirmPassword;
  const role = body?.role;
  const adminKey = body?.adminKey; // <-- 1. Extract the key from the request body
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();

  // ... (Existing validations for email, firstName, lastName, etc.)

  if (!role) {
    throw new AppError(400, "Role is required");
  }

  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError(400, "Role must be user or admin");
  }

  // --- NEW ADMIN KEY VALIDATION ---
  if (role === "admin") {
    const serverAdminKey = process.env.ADMIN_KEY; // Or env.ADMIN_KEY based on your config

    if (!adminKey || adminKey !== serverAdminKey) {
      throw new AppError(401, "Invalid or missing Admin Secret Key");
    }
  }
  
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  let userDoc;
  try {
    userDoc =
      role === "admin"
        ? await AdminUser.create({
            email,
            passwordHash,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            role: "admin",
            accountStatus: "active",
          })
        : await User.create({
            email,
            passwordHash,
            firstName: firstName || undefined,
            lastName: lastName || undefined,
            role: "user",
            accountStatus: "active",
          });
  } catch (err) {
    if (err?.code === 11000) {
      throw new AppError(409, "Email already registered");
    }
    throw err;
  }
  return issueSession(userDoc);
}

export async function login(body) {
  let email = String(body?.email ?? "").trim().toLowerCase();
  const password = body?.password;
  const role = body?.role;
  if (email && !email.includes("@")) {
    email = `${email}@suybmol.com`;
  }
  if (!email || !password) {
    throw new AppError(400, "Email and password required");
  }
  assertNonEmptyEmailLocal(email);
  if (!HAS_TLD.test(email)) {
    throw new AppError(
      400,
      "Email must include a valid top-level domain(.com, .net, etc.)"
    );
  }
  const emailLocal = email.split("@")[0];
  if (emailLocal.length > MAX_EMAIL_LOCAL_LENGTH) {
    throw new AppError(
      400,
      `User email before @ must be ${MAX_EMAIL_LOCAL_LENGTH} characters or fewer`
    );
  }
  if (!role) {
    throw new AppError(400, "Role is required");
  }
  if (!ALLOWED_ROLES.includes(role)) {
    throw new AppError(400, "Role must be user or admin");
  }
  if (typeof password !== "string" || HAS_WHITESPACE.test(password)) {
    throw new AppError(400, "Password must not contain spaces");
  }
  if (HAS_BACKTICK.test(password)) {
    throw new AppError(400, "Password must not contain backticks (`)");
  }
  if (!HAS_NUMBER.test(password) || !HAS_SPECIAL.test(password)) {
    throw new AppError(
      400,
      "Password must include at least one number and one special character"
    );
  }
  const user =
    role === "admin"
      ? await AdminUser.findOne({ email })
      : await User.findOne({ email });
  if (!user?.passwordHash) {
    throw new AppError(401, "Invalid credentials");
  }
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    throw new AppError(401, "Invalid credentials");
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
  const user =
    (await User.findById(payload.sub)) ?? (await AdminUser.findById(payload.sub));
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
  const user = (await User.findById(userId)) ?? (await AdminUser.findById(userId));
  if (!user) {
    throw new AppError(401, "Unauthorized");
  }
  if (user.accountStatus !== "active") {
    throw new AppError(403, "Account deactivated");
  }
  return sanitizeUser(user);
}
