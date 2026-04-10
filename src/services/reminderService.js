import mongoose from "mongoose";
import { AdminUser } from "../models/AdminUser.js";
import { Notification } from "../models/Notification.js";
import { Reminder } from "../models/Reminder.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { validateReminderPayload } from "../validation/notificationPayload.js";

function sanitizeReminder(doc, viewerId) {
  const json = doc.toObject();
  let myRecipient = null;
  if (viewerId) {
    myRecipient = json.recipients.find(
      (r) => String(r.userId) === String(viewerId)
    );
  }
  return {
    id: String(json._id),
    notificationId: String(json.notificationId),
    title: json.title,
    body: json.body,
    targetType: json.targetType,
    targetUsers: (json.targetUsers ?? []).map((id) => String(id)),
    targetRoles: json.targetRoles ?? [],
    recipientsCount: json.recipients.length,
    isRecipient: Boolean(myRecipient),
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

async function resolveRecipients(targetType, targetUsers) {
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

export async function createReminderFromNotification(notificationId, body, actor) {
  validateReminderPayload(body);
  const original = await Notification.findById(notificationId);
  if (!original) {
    throw new AppError(404, "Notification not found");
  }

  const nextTitle =
    body?.title !== undefined ? String(body.title).trim() : original.title;
  const nextBody =
    body?.body !== undefined ? String(body.body).trim() : original.body;

  const recipients = dedupeRecipients(
    await resolveRecipients(
      original.targetType,
      (original.targetUsers ?? []).map((id) => String(id))
    )
  );

  const doc = await Reminder.create({
    notificationId: original._id,
    title: nextTitle,
    body: nextBody,
    targetType: original.targetType,
    targetUsers: original.targetType === "users" ? original.targetUsers ?? [] : [],
    targetRoles:
      original.targetType === "all"
        ? ["user", "admin"]
        : original.targetType === "user"
          ? ["user"]
          : original.targetType === "admin"
            ? ["admin"]
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

  return sanitizeReminder(doc, actor.userId);
}

export async function listRemindersForViewer(query, viewer) {
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
  const docs = await Reminder.find(filter).sort({ createdAt: -1 });

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
    items: sliced.map((d) => sanitizeReminder(d, viewer.userId)),
    meta: {
      total,
      page,
      limit,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    },
  };
}

export async function markReminderRead(reminderId, viewer) {
  const rid = String(reminderId ?? "").trim();
  const viewerIdStr = String(viewer?.userId ?? "").trim();
  if (!mongoose.isValidObjectId(rid)) {
    throw new AppError(404, "Reminder not found");
  }

  const reminder = await Reminder.findById(rid);
  if (!reminder) {
    throw new AppError(404, "Reminder not found");
  }

  const recipient = reminder.recipients.find(
    (r) => String(r.userId) === viewerIdStr
  );

  if (!recipient) {
    throw new AppError(403, "Not a recipient of this reminder");
  }

  if (!recipient.readAt) {
    recipient.readAt = new Date();
    await reminder.save();
  }

  return sanitizeReminder(reminder, viewerIdStr);
}