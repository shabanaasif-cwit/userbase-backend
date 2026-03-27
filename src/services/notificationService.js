import mongoose from "mongoose";
import { AdminUser } from "../models/AdminUser.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import {
  validateCreateNotificationPayload,
  validateReminderPayload,
  validateUpdateNotificationPayload,
} from "../validation/notificationPayload.js";

function sanitizeNotification(doc, viewerId) {
  const json = doc.toObject();
  let myRecipient = null;
  if (viewerId) {
    myRecipient = json.recipients.find(
      (r) => String(r.userId) === String(viewerId)
    );
  }
  return {
    id: String(json._id),
    title: json.title,
    body: json.body,
    targetType: json.targetType,
    targetUsers: (json.targetUsers ?? []).map((id) => String(id)),
    targetRoles: json.targetRoles ?? [],
    recipientsCount: json.recipients.length,
    myRead: Boolean(myRecipient?.readAt),
    myReadAt: myRecipient?.readAt ?? null,
    createdBy: {
      userId: String(json.createdBy.userId),
      role: json.createdBy.role,
    },
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

async function getRoleUsers(role) {
  if (role === "admin") {
    const admins = await AdminUser.find({}, { _id: 1, role: 1 });
    return admins.map((a) => ({ userId: a._id, role: "admin" }));
  }
  const users = await User.find({}, { _id: 1, role: 1 });
  return users.map((u) => ({ userId: u._id, role: "user" }));
}

async function resolveRecipients(targetType, targetUsers, targetRoles) {
  if (targetType === "users") {
    if (!Array.isArray(targetUsers) || targetUsers.length === 0) {
      throw new AppError(400, "targetUsers is required for targetType=users");
    }
    let objectIds;
    try {
      objectIds = targetUsers.map((id) => new mongoose.Types.ObjectId(id));
    } catch {
      throw new AppError(400, "Invalid target user id");  
    }
    const [users, admins] = await Promise.all([
      User.find({ _id: { $in: objectIds } }, { _id: 1, role: 1 }),
      AdminUser.find({ _id: { $in: objectIds } }, { _id: 1, role: 1 }),
    ]);
    const found = [
      ...users.map((u) => ({ userId: u._id, role: "user" })),
      ...admins.map((a) => ({ userId: a._id, role: "admin" })),
    ];
    if (found.length === 0) {
      throw new AppError(400, "No valid target users found");
    }
    return found;
  }

  if (targetType === "user" || targetType === "admin") {
    return getRoleUsers(targetType);
  }

  if (targetType === "all") {
    const [users, admins] = await Promise.all([
      getRoleUsers("user"),
      getRoleUsers("admin"),
    ]);
    const recipients = [...users, ...admins];
    if (recipients.length === 0) {
      throw new AppError(400, "No recipients found for all users");
    }
    return recipients;
  }

  throw new AppError(400, "targetType must be users, user, admin, or all");
}

function dedupeRecipients(recipients) {
  const map = new Map();
  for (const recipient of recipients) {
    map.set(String(recipient.userId), recipient);
  }
  return Array.from(map.values());
}

export async function createNotification(body, actor) {
  validateCreateNotificationPayload(body);
  const title = String(body.title).trim();
  const message = String(body.body).trim();
  const targetType = body.targetType;
  const targetUsers = body.targetUsers ?? [];
  const targetRoles = body.targetRoles ?? [];

  const recipients = dedupeRecipients(
    await resolveRecipients(targetType, targetUsers, targetRoles)
  );

  const doc = await Notification.create({
    title,
    body: message,
    targetType,
    targetUsers:
      targetType === "users"
        ? recipients.map((r) => r.userId)
        : [],
    targetRoles:
      targetType === "user"
        ? ["user"]
        : targetType === "admin"
          ? ["admin"]
          : targetType === "all"
            ? ["user", "admin"]
            : [],
    recipients: recipients.map((r) => ({
      userId: r.userId,
      role: r.role,
      readAt: null,
    })),
    createdBy: {
      userId: actor.userId,
      role: "admin",
    },
  });

  return sanitizeNotification(doc);
}

export async function sendNotificationReminder(notificationId, body, actor) {
  // Backwards-compat shim: reminders now live in the `reminders` collection.
  // This function is kept to avoid breaking imports; routes should use reminderService.
  validateReminderPayload(body);
  throw new AppError(
    410,
    "Reminders are stored in /api/reminders; use POST /api/notifications/:notificationId/remind (returns reminder)"
  );
}

export async function listNotificationsForViewer(query, viewer) {
  const page = Math.max(Number.parseInt(query.page ?? "1", 10) || 1, 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit ?? "10", 10) || 10, 1),
    100
  );
  const search = query.search?.trim();
  const read = query.read;

  const filter = {};
  if (search) {
    const safe = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { title: { $regex: safe, $options: "i" } },
      { body: { $regex: safe, $options: "i" } },
    ];
  }

  if (viewer.role !== "admin") {
    filter["recipients.userId"] = new mongoose.Types.ObjectId(viewer.userId);
  }

  const skip = (page - 1) * limit;
  const docs = await Notification.find(filter).sort({ createdAt: -1 });

  let filtered = docs;
  if (viewer.role !== "admin" && (read === "true" || read === "false")) {
    const shouldRead = read === "true";
    filtered = docs.filter((doc) => {
      const rec = doc.recipients.find(
        (r) => String(r.userId) === String(viewer.userId)
      );
      return shouldRead ? Boolean(rec?.readAt) : !rec?.readAt;
    });
  }

  const total = filtered.length;
  const sliced = filtered.slice(skip, skip + limit);
  return {
    items: sliced.map((d) => sanitizeNotification(d, viewer.userId)),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function updateNotification(notificationId, body) {
  validateUpdateNotificationPayload(body);
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new AppError(404, "Notification not found");
  }

  const patch = {};
  if (body.title !== undefined) {
    patch.title = String(body.title).trim();
  }
  if (body.body !== undefined) {
    patch.body = String(body.body).trim();
  }

  let recipients = null;
  if (body.targetType !== undefined) {
    recipients = dedupeRecipients(
      await resolveRecipients(
        body.targetType,
        body.targetUsers ?? [],
        body.targetRoles ?? []
      )
    );
    patch.targetType = body.targetType;
    patch.targetUsers =
      body.targetType === "users" ? recipients.map((r) => r.userId) : [];
    patch.targetRoles =
      body.targetType === "user"
        ? ["user"]
        : body.targetType === "admin"
          ? ["admin"]
          : body.targetType === "all"
            ? ["user", "admin"]
            : [];
  }

  if (Object.keys(patch).length === 0) {
    throw new AppError(400, "No valid fields to update");
  }

  Object.assign(notification, patch);
  if (recipients) {
    notification.recipients = recipients.map((r) => ({
      userId: r.userId,
      role: r.role,
      readAt: null,
    }));
  }
  await notification.save();
  return sanitizeNotification(notification);
}

export async function deleteNotification(notificationId) {
  const deleted = await Notification.findByIdAndDelete(notificationId);
  if (!deleted) {
    throw new AppError(404, "Notification not found");
  }
}

export async function markNotificationRead(notificationId, viewer) {
  const notification = await Notification.findOne({
    _id: notificationId,
    "recipients.userId": new mongoose.Types.ObjectId(viewer.userId),
  });
  if (!notification) {
    throw new AppError(404, "Notification not found");
  }

  const recipient = notification.recipients.find(
    (r) => String(r.userId) === String(viewer.userId)
  );
  if (recipient && !recipient.readAt) {
    recipient.readAt = new Date();
    await notification.save();
  }
  return sanitizeNotification(notification, viewer.userId);
}
