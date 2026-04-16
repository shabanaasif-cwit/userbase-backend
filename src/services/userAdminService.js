import { AdminUser } from "../models/AdminUser.js";
import { User } from "../models/User.js";
import { assertNonEmptyEmailLocal } from "../utils/email.js";
import { AppError } from "../utils/AppError.js";

const ALLOWED_ROLES = ["user", "admin"];
const ALLOWED_STATUSES = ["active", "deactivated"];

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function listUsers(query) {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100
  );
  const role = query.role;
  const accountStatus = query.accountStatus;
  const search = query.search?.trim();
  const safeRegex = search
    ? { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" }
    : null;

  const userFilter = {};
  const adminFilter = {};

  if (!role || role === "user") {
    userFilter.role = "user";
  } else if (role === "admin") {
    adminFilter.role = "admin";
  } else {
    userFilter.role = "user";
    adminFilter.role = "admin";
  }

  if (accountStatus && ALLOWED_STATUSES.includes(accountStatus)) {
    userFilter.accountStatus = accountStatus;
    adminFilter.accountStatus = accountStatus;
  }
  if (safeRegex) {
    userFilter.email = safeRegex;
    adminFilter.email = safeRegex;
  }

  const queries = [];
  if (!role || role === "user") {
    queries.push(User.find(userFilter));
  }
  if (!role || role === "admin") {
    queries.push(AdminUser.find(adminFilter));
  }

  const lists = await Promise.all(queries);
  const allUsers = lists.flat();
  allUsers.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const total = allUsers.length;
  const skip = (page - 1) * limit;
  const users = allUsers.slice(skip, skip + limit);

  return {
    items: users.map(sanitizeUser),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function updateUserByAdmin(userId, body) {
  const targetUser = await User.findById(userId);
  const targetAdmin = targetUser ? null : await AdminUser.findById(userId);
  const target = targetUser ?? targetAdmin;
  if (!target) {
    throw new AppError(404, "User not found");
  }

  const patch = {};

  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) {
      throw new AppError(400, "Email cannot be empty");
    }
    assertNonEmptyEmailLocal(email);
    patch.email = email;
  }

  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.includes(body.role)) {
      throw new AppError(400, "Invalid role");
    }
    patch.role = body.role;
  }

  if (body.accountStatus !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.accountStatus)) {
      throw new AppError(400, "Invalid account status");
    }
    patch.accountStatus = body.accountStatus;
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError(400, "No valid fields to update");
  }

  if (patch.email) {
    const [u, a] = await Promise.all([
      User.findOne({ email: patch.email, _id: { $ne: userId } }),
      AdminUser.findOne({ email: patch.email, _id: { $ne: userId } }),
    ]);
    if (u || a) {
      throw new AppError(409, "That email is taken. Try another.");
    }
  }

  const nextRole = patch.role ?? target.role;
  delete patch.role;

  if (target.role === "user" && nextRole === "admin") {
    const admin = await AdminUser.create({
      email: patch.email ?? target.email,
      passwordHash: target.passwordHash,
      role: "admin",
      accountStatus: patch.accountStatus ?? target.accountStatus,
    });
    await User.deleteOne({ _id: target._id });
    return sanitizeUser(admin);
  }

  if (target.role === "admin" && nextRole === "user") {
    const user = await User.create({
      email: patch.email ?? target.email,
      passwordHash: target.passwordHash,
      role: "user",
      accountStatus: patch.accountStatus ?? target.accountStatus,
    });
    await AdminUser.deleteOne({ _id: target._id });
    return sanitizeUser(user);
  }

  Object.assign(target, patch);
  await target.save();
  return sanitizeUser(target);
}

export async function deactivateUser(userId) {
  const user = await User.findById(userId);
  const admin = user ? null : await AdminUser.findById(userId);
  const target = user ?? admin;
  if (!target) {
    throw new AppError(404, "User not found");
  }
  target.accountStatus = "deactivated";
  await target.save();
  return sanitizeUser(target);
}

export async function toggleUserAccountStatus(userId) {
  const user = await User.findById(userId);
  const admin = user ? null : await AdminUser.findById(userId);
  const target = user ?? admin;
  if (!target) {
    throw new AppError(404, "User not found");
  }
  target.accountStatus =
    target.accountStatus === "deactivated" ? "active" : "deactivated";
  await target.save();
  return sanitizeUser(target);
}
