import { Server } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import { env } from "../config/env.js";

let ioInstance = null;

function userRoom(userId) {
  return `user:${String(userId)}`;
}

function roleRoom(role) {
  return `role:${String(role)}`;
}

/**
 * `targetType` on notifications/reminders matches the HTTP API and drives who receives socket events:
 * - `"admin"` — every admin (`role:admin` room)
 * - `"user"` — every non-admin user (`role:user` room)
 * - `"all"` — both roles (`role:user` + `role:admin`)
 * - `"users"` — specific accounts only; fan-out uses `targetUsers` (each joins `user:<id>`)
 */
function emitByTarget(targetType, targetUsers, targetRoles, eventName, payload) {
  //ioInstance is the socket.io instance
  if (!ioInstance) return;

  if (targetType === "users") {
    for (const userId of targetUsers ?? []) {
      ioInstance.to(userRoom(userId)).emit(eventName, payload);
    }
    return;
  }

  if (targetType === "user" || targetType === "admin") {
    ioInstance.to(roleRoom(targetType)).emit(eventName, payload);
    return;
  }

  if (targetType === "all") {
    ioInstance.to(roleRoom("user")).emit(eventName, payload);
    ioInstance.to(roleRoom("admin")).emit(eventName, payload);
    return;
  }

  for (const role of targetRoles ?? []) {
    ioInstance.to(roleRoom(role)).emit(eventName, payload);
  }
}

function extractBearerToken(socket) {
  const authHeader = socket.handshake.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim() !== "") {
    return authToken.trim();
  }
  const queryToken = socket.handshake.query?.token;
  if (typeof queryToken === "string" && queryToken.trim() !== "") {
    return queryToken.trim();
  }
  return null;
}

export function initSocketServer(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    },
  });

  ioInstance.use((socket, next) => {
    const token = extractBearerToken(socket);
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.user = {
        userId: payload.sub,
        role: payload.role,
      };
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const { userId, role } = socket.data.user;
    socket.join(userRoom(userId));
    socket.join(roleRoom(role));
  });

  return ioInstance;
}

export function emitNotificationCreated(notification) {
  emitByTarget(
    notification.targetType,
    notification.targetUsers,
    notification.targetRoles,
    "notification:created",
    { notification }
  );
}

export function emitNotificationUpdated(notification) {
  emitByTarget(
    notification.targetType,
    notification.targetUsers,
    notification.targetRoles,
    "notification:updated",
    { notification }
  );
}

export function emitNotificationDeleted(notification) {
  emitByTarget(
    notification.targetType,
    notification.targetUsers,
    notification.targetRoles,
    "notification:deleted",
    { notification }
  );
}

export function emitNotificationRead(userId, notification) {
  if (!ioInstance) return;
  ioInstance.to(userRoom(userId)).emit("notification:read", { notification });
}

export function emitReminderCreated(reminder) {
  emitByTarget(
    reminder.targetType,
    reminder.targetUsers,
    reminder.targetRoles,
    "reminder:created",
    { reminder }
  );
}

export function emitReminderRead(userId, reminder) {
  if (!ioInstance) return;
  ioInstance.to(userRoom(userId)).emit("reminder:read", { reminder });
}
