import { env } from "../config/env.js";

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "userbase-backend API",
    version: "1.0.0",
    description:
      "Authentication, user management (admin), notifications (admin broadcast + user list/read), and health endpoints for userbase-backend. Error responses are JSON objects `{ \"error\": string }`. Malformed JSON bodies return **400** with `error: \"Invalid JSON\"`. Admin-only routes return **403** with `error: \"Forbidden (admin only)\"` when the JWT role is insufficient.",
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development",
    },
  ],
  tags: [
    { name: "System" },
    { name: "Auth" },
    { name: "Users" },
    { name: "Notifications" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        properties: {
          error: { type: "string", example: "Unauthorized" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", example: "65f1f8c1dd1f8a2e9fcd1234" },
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          role: { type: "string", enum: ["user", "admin"] },
          accountStatus: { type: "string", enum: ["active", "deactivated"] },
          firstName: { type: "string", example: "Jane" },
          lastName: { type: "string", example: "Doe" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      UsersListResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/User" },
          },
          meta: {
            type: "object",
            properties: {
              total: { type: "number", example: 20 },
              page: { type: "number", example: 1 },
              limit: { type: "number", example: 10 },
              totalPages: { type: "number", example: 2 },
            },
          },
        },
      },
      UserResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
        },
      },
      SignupBody: {
        type: "object",
        required: ["email", "password", "confirmPassword", "role"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "Password123!",
          },
          confirmPassword: {
            type: "string",
            minLength: 8,
            example: "Password123!",
          },
          role: {
            type: "string",
            enum: ["user", "admin"],
            example: "user",
          },
        },
      },
      LoginBody: {
        type: "object",
        required: ["email", "password", "role"],
        properties: {
          email: {
            type: "string",
            format: "email",
            example: "user@example.com",
          },
          password: {
            type: "string",
            minLength: 8,
            example: "Password123!",
          },
          role: {
            type: "string",
            enum: ["user", "admin"],
            example: "user",
          },
        },
      },
      AuthSuccess: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
          accessToken: { type: "string", example: "eyJhbGciOi..." },
        },
      },
      MeResponse: {
        type: "object",
        properties: {
          user: { $ref: "#/components/schemas/User" },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          ok: { type: "boolean", example: true },
          service: { type: "string", example: "userbase-backend" },
          db: { type: "string", example: "connected" },
        },
      },
      UpdateUserBody: {
        type: "object",
        properties: {
          email: { type: "string", format: "email", example: "updated@example.com" },
          role: { type: "string", enum: ["user", "admin"] },
          accountStatus: { type: "string", enum: ["active", "deactivated"] },
        },
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          targetType: { type: "string", enum: ["users", "user", "admin", "all"] },
          targetUsers: { type: "array", items: { type: "string" } },
          targetRoles: {
            type: "array",
            items: { type: "string", enum: ["user", "admin"] },
          },
          recipientsCount: { type: "number" },
          myRead: { type: "boolean" },
          myReadAt: { type: "string", format: "date-time", nullable: true },
          createdBy: {
            type: "object",
            properties: {
              userId: { type: "string" },
              role: { type: "string", enum: ["admin"] },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      NotificationResponse: {
        type: "object",
        properties: {
          notification: { $ref: "#/components/schemas/Notification" },
        },
      },
      NotificationsListResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Notification" },
          },
          meta: {
            type: "object",
            properties: {
              total: { type: "number" },
              page: { type: "number" },
              limit: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
      },
      CreateNotificationBody: {
        type: "object",
        required: ["title", "body", "targetType"],
        properties: {
          title: { type: "string", example: "Maintenance Notice" },
          body: { type: "string", example: "System will be down at 10 PM." },
          targetType: { type: "string", enum: ["users", "user", "admin", "all"] },
          targetUsers: {
            type: "array",
            items: { type: "string" },
            description: "Required when targetType=users",
          },
          targetRoles: {
            type: "array",
            items: { type: "string", enum: ["user", "admin"] },
            description:
              "Optional; ignored on create. Recipients are determined only by targetType: users (targetUsers), user (all app users), admin (all admins), or all.",
          },
        },
      },
      UpdateNotificationBody: {
        type: "object",
        description:
          "Partial update. Send at least one field; changing targetType re-resolves recipients (same rules as create). Empty title/body strings are rejected.",
        properties: {
          title: { type: "string", example: "Updated title" },
          body: { type: "string", example: "Updated message." },
          targetType: { type: "string", enum: ["users", "user", "admin", "all"] },
          targetUsers: {
            type: "array",
            items: { type: "string" },
            description: "Required when setting targetType=users",
          },
          targetRoles: {
            type: "array",
            items: { type: "string", enum: ["user", "admin"] },
            description:
              "Optional; ignored on update. Use targetType user, admin, users, or all.",
          },
        },
      },
      ReminderBody: {
        type: "object",
        description:
          "Optional overrides when sending a reminder. If omitted/empty, the reminder uses the original title/body.",
        properties: {
          title: { type: "string", example: "Reminder: Maintenance Notice" },
          body: { type: "string", example: "Reminder: System will be down at 10 PM." },
        },
      },
      Reminder: {
        type: "object",
        properties: {
          id: { type: "string" },
          notificationId: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          targetType: { type: "string", enum: ["users", "user", "admin", "all"] },
          targetUsers: { type: "array", items: { type: "string" } },
          targetRoles: {
            type: "array",
            items: { type: "string", enum: ["user", "admin"] },
          },
          recipientsCount: { type: "number" },
          isRecipient: {
            type: "boolean",
            description:
              "Whether the authenticated user is in the reminder recipients list. Admins may list all reminders; use this to hide per-recipient actions (e.g. Mark read) when false.",
          },
          myRead: { type: "boolean" },
          myReadAt: { type: "string", format: "date-time", nullable: true },
          createdBy: {
            type: "object",
            properties: {
              userId: { type: "string" },
              role: { type: "string", enum: ["admin"] },
            },
          },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      ReminderResponse: {
        type: "object",
        properties: {
          reminder: { $ref: "#/components/schemas/Reminder" },
        },
      },
      RemindersListResponse: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: { $ref: "#/components/schemas/Reminder" },
          },
          meta: {
            type: "object",
            properties: {
              total: { type: "number" },
              page: { type: "number" },
              limit: { type: "number" },
              totalPages: { type: "number" },
            },
          },
        },
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["System"],
        summary: "Get API info",
        responses: {
          200: {
            description: "API message",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: {
                      type: "string",
                      example: "userbase-backend API",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "Healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
          503: {
            description: "Database unavailable",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SignupBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Signed up",
            headers: {
              "Set-Cookie": {
                schema: { type: "string" },
                description: "httpOnly refresh token cookie",
              },
            },
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccess" },
              },
            },
          },
          400: {
            description:
              "Validation error or malformed JSON body (`error`: `Invalid JSON`)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          409: {
            description: "Email already exists",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginBody" },
            },
          },
        },
        responses: {
          200: {
            description: "Logged in",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccess" },
              },
            },
          },
          400: {
            description:
              "Validation error or malformed JSON body (`error`: `Invalid JSON`)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          401: {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
          403: {
            description: "Account deactivated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Rotate refresh session and issue new access token",
        responses: {
          200: {
            description: "Token refreshed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthSuccess" },
              },
            },
          },
          401: {
            description: "Refresh token missing/invalid",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout and clear refresh cookie",
        responses: {
          204: { description: "Logged out" },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MeResponse" },
              },
            },
          },
          401: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorResponse" },
              },
            },
          },
        },
      },
    },
    "/api/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications for current user (admin can view broader)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "number", default: 1 } },
          { name: "limit", in: "query", schema: { type: "number", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "read",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
            description: "For non-admin users: filter by read state",
          },
        ],
        responses: {
          200: {
            description: "Notifications list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationsListResponse" },
              },
            },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      post: {
        tags: ["Notifications"],
        summary: "Admin: create notification",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateNotificationBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/NotificationResponse" },
              },
            },
          },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/notifications/{notificationId}": {
      patch: {
        tags: ["Notifications"],
        summary: "Admin: update notification",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "notificationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateNotificationBody" },
            },
          },
        },
        responses: {
          200: { description: "Updated", content: { "application/json": { schema: { $ref: "#/components/schemas/NotificationResponse" } } } },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Notification not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
      delete: {
        tags: ["Notifications"],
        summary: "Admin: delete notification",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "notificationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          204: { description: "Deleted" },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Notification not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/notifications/{notificationId}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark current user's notification as read",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "notificationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Marked as read", content: { "application/json": { schema: { $ref: "#/components/schemas/NotificationResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: {
            description: "JWT user is not among this notification's recipients",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          404: { description: "Notification not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/notifications/{notificationId}/remind": {
      post: {
        tags: ["Notifications"],
        summary: "Admin: send a reminder for an existing notification",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "notificationId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReminderBody" },
            },
          },
        },
        responses: {
          201: {
            description: "Reminder created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ReminderResponse" },
              },
            },
          },
          400: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "Notification not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/reminders": {
      get: {
        tags: ["Notifications"],
        summary: "List reminders for current user (admin can view broader)",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "number", default: 1 } },
          { name: "limit", in: "query", schema: { type: "number", default: 10 } },
          { name: "search", in: "query", schema: { type: "string" } },
          {
            name: "read",
            in: "query",
            schema: { type: "string", enum: ["true", "false"] },
            description:
              "Filter by the authenticated user’s read state for reminders where they are a recipient (`true` = read, `false` = unread). Reminders that do not include the user in `recipients` are omitted when this parameter is set.",
          },
        ],
        responses: {
          200: {
            description: "Reminders list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RemindersListResponse" },
              },
            },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/reminders/{reminderId}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark current user's reminder as read",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "reminderId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "Marked as read", content: { "application/json": { schema: { $ref: "#/components/schemas/ReminderResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: {
            description: "JWT user is not among this reminder's recipients",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
          },
          404: { description: "Reminder not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users": {
      get: {
        tags: ["Users"],
        summary: "Admin: list/filter/search users",
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "page", in: "query", schema: { type: "number", default: 1 } },
          {
            name: "limit",
            in: "query",
            schema: { type: "number", default: 10, maximum: 100 },
          },
          { name: "role", in: "query", schema: { type: "string", enum: ["user", "admin"] } },
          {
            name: "accountStatus",
            in: "query",
            schema: { type: "string", enum: ["active", "deactivated"] },
          },
          { name: "search", in: "query", schema: { type: "string" } },
        ],
        responses: {
          200: {
            description: "Users list",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UsersListResponse" },
              },
            },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users/{userId}": {
      patch: {
        tags: ["Users"],
        summary: "Admin: update user role/status/email",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateUserBody" },
            },
          },
        },
        responses: {
          200: { description: "User updated", content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } } },
          400: { description: "Invalid request", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          409: { description: "Email conflict", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users/{userId}/deactivate": {
      patch: {
        tags: ["Users"],
        summary: "Admin: deactivate user account",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: { description: "User deactivated", content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } } },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
    "/api/users/{userId}/toggle-account": {
      patch: {
        tags: ["Users"],
        summary: "Admin: toggle user account active/deactivated",
        description:
          "Sets account to deactivated if currently active, or active if currently deactivated. Use for a single admin action (e.g. profile icon) instead of branching on accountStatus.",
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "userId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          200: {
            description: "User account status toggled",
            content: { "application/json": { schema: { $ref: "#/components/schemas/UserResponse" } } },
          },
          401: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          403: { description: "Forbidden (admin only)", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
};
