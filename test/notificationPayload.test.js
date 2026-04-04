import { describe, expect, it } from "vitest";
import { AppError } from "../src/utils/AppError.js";
import {
  validateCreateNotificationPayload,
  validateUpdateNotificationPayload,
} from "../src/validation/notificationPayload.js";

describe("validateCreateNotificationPayload", () => {
  it("rejects non-object body", () => {
    expect(() => validateCreateNotificationPayload(null)).toThrow(AppError);
    expect(() => validateCreateNotificationPayload(null)).toThrow(
      /Request body must be a JSON object/
    );
    expect(() => validateCreateNotificationPayload([])).toThrow(AppError);
  });

  it("rejects wrong types for title/body", () => {
    expect(() =>
      validateCreateNotificationPayload({
        title: 1,
        body: "x",
        targetType: "users",
        targetUsers: ["507f1f77bcf86cd799439011"],
      })
    ).toThrow(/title must be a string/);
    expect(() =>
      validateCreateNotificationPayload({
        title: "t",
        body: null,
        targetType: "users",
        targetUsers: ["507f1f77bcf86cd799439011"],
      })
    ).toThrow(/body must be a string/);
  });

  it("rejects missing title, body, or targetType", () => {
    expect(() =>
      validateCreateNotificationPayload({
        title: "",
        body: "m",
        targetType: "users",
        targetUsers: ["507f1f77bcf86cd799439011"],
      })
    ).toThrow(/title and body are required/);
    expect(() =>
      validateCreateNotificationPayload({
        title: "t",
        body: "   ",
        targetType: "users",
        targetUsers: ["507f1f77bcf86cd799439011"],
      })
    ).toThrow(/title and body are required/);
    expect(() =>
      validateCreateNotificationPayload({
        title: "t",
        body: "m",
        targetType: "broadcast",
        targetUsers: [],
      })
    ).toThrow(/targetType must be users, user, admin, or all/);
  });

  it("rejects non-array targetUsers/targetRoles", () => {
    expect(() =>
      validateCreateNotificationPayload({
        title: "t",
        body: "m",
        targetType: "users",
        targetUsers: "not-array",
      })
    ).toThrow(/targetUsers must be an array/);
    expect(() =>
      validateCreateNotificationPayload({
        title: "t",
        body: "m",
        targetType: "users",
        targetUsers: ["507f1f77bcf86cd799439011"],
        targetRoles: {},
      })
    ).toThrow(/targetRoles must be an array/);
  });
});

describe("validateUpdateNotificationPayload", () => {
  it("rejects non-object body", () => {
    expect(() => validateUpdateNotificationPayload(undefined)).toThrow(AppError);
    expect(() => validateUpdateNotificationPayload(undefined)).toThrow(
      /Request body must be a JSON object/
    );
  });

  it("rejects when no supported keys", () => {
    expect(() => validateUpdateNotificationPayload({})).toThrow(
      /No valid fields to update/
    );
    expect(() => validateUpdateNotificationPayload({ extra: 1 })).toThrow(
      /No valid fields to update/
    );
  });

  it("rejects invalid title/body/targetType", () => {
    expect(() => validateUpdateNotificationPayload({ title: "" })).toThrow(
      /title cannot be empty/
    );
    expect(() => validateUpdateNotificationPayload({ title: null })).toThrow(
      /title must be a string/
    );
    expect(() => validateUpdateNotificationPayload({ body: "  " })).toThrow(
      /body cannot be empty/
    );
    expect(() =>
      validateUpdateNotificationPayload({ targetType: "broadcast" })
    ).toThrow(/targetType must be users, user, admin, or all/);
  });

  it("rejects non-array targetUsers/targetRoles when present", () => {
    expect(() =>
      validateUpdateNotificationPayload({ title: "ok", targetUsers: "x" })
    ).toThrow(/targetUsers must be an array/);
    expect(() =>
      validateUpdateNotificationPayload({ body: "ok", targetRoles: 1 })
    ).toThrow(/targetRoles must be an array/);
  });
});
