import { AppError } from "../utils/AppError.js";

const TARGET_TYPES = ["users", "user", "admin", "all"];

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
  if (!title) {
    throw new AppError(400, "title is required");
  }
  if (!message) {
    throw new AppError(400, "message is required");
  }
  if (!title || !message) {
    throw new AppError(400, "title and message are required");
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
  const hasEffectiveUpdate =
    Object.prototype.hasOwnProperty.call(body, "title") ||
    Object.prototype.hasOwnProperty.call(body, "body") ||
    Object.prototype.hasOwnProperty.call(body, "targetType");
  if (!hasEffectiveUpdate) {
    throw new AppError(400, "No fields are updated");
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
