import { AppError } from "../utils/AppError.js";

const TARGET_TYPES = ["users", "user", "admin", "all"];

const UPDATE_KEYS = ["title", "body", "targetType", "targetUsers", "targetRoles"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates admin create payload before persistence. Throws AppError(400, ...).
 * @param {unknown} body
 */
export function validateCreateNotificationPayload(body) {
  if (!isPlainObject(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    if (body.title === null || typeof body.title !== "string") {
      throw new AppError(400, "title must be a string");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "body")) {
    if (body.body === null || typeof body.body !== "string") {
      throw new AppError(400, "body must be a string");
    }
  }
  const title = String(body.title ?? "").trim();
  const message = String(body.body ?? "").trim();
  if (!title || !message) {
    throw new AppError(400, "title and body are required");
  }
  if (!TARGET_TYPES.includes(body.targetType)) {
    throw new AppError(
      400,
      "targetType must be users, user, admin, or all"
    );
  }
  if (body.targetUsers !== undefined && !Array.isArray(body.targetUsers)) {
    throw new AppError(400, "targetUsers must be an array");
  }
  if (body.targetRoles !== undefined && !Array.isArray(body.targetRoles)) {
    throw new AppError(400, "targetRoles must be an array");
  }
}

/**
 * Validates admin partial update payload. Throws AppError(400, ...).
 * @param {unknown} body
 */
export function validateUpdateNotificationPayload(body) {
  if (!isPlainObject(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  const hasUpdatable = UPDATE_KEYS.some((k) =>
    Object.prototype.hasOwnProperty.call(body, k)
  );
  if (!hasUpdatable) {
    throw new AppError(400, "No valid fields to update");
  }
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    if (body.title === null || typeof body.title !== "string") {
      throw new AppError(400, "title must be a string");
    }
    if (!String(body.title).trim()) {
      throw new AppError(400, "title cannot be empty");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "body")) {
    if (body.body === null || typeof body.body !== "string") {
      throw new AppError(400, "body must be a string");
    }
    if (!String(body.body).trim()) {
      throw new AppError(400, "body cannot be empty");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "targetType")) {
  if (!TARGET_TYPES.includes(body.targetType)) {
    throw new AppError(
      400,
      "targetType must be users, user, admin, or all"
    );
  }
  }
  if (body.targetUsers !== undefined && !Array.isArray(body.targetUsers)) {
    throw new AppError(400, "targetUsers must be an array");
  }
  if (body.targetRoles !== undefined && !Array.isArray(body.targetRoles)) {
    throw new AppError(400, "targetRoles must be an array");
  }
}

/**
 * Validates reminder payload (optional overrides). Throws AppError(400, ...).
 * @param {unknown} body
 */
export function validateReminderPayload(body) {
  if (body === undefined || body === null) return;
  if (!isPlainObject(body)) {
    throw new AppError(400, "Request body must be a JSON object");
  }
  if (Object.prototype.hasOwnProperty.call(body, "title")) {
    if (body.title === null || typeof body.title !== "string") {
      throw new AppError(400, "title must be a string");
    }
    if (!String(body.title).trim()) {
      throw new AppError(400, "title cannot be empty");
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, "body")) {
    if (body.body === null || typeof body.body !== "string") {
      throw new AppError(400, "body must be a string");
    }
    if (!String(body.body).trim()) {
      throw new AppError(400, "body cannot be empty");
    }
  }
}
