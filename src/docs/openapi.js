import { env } from "../config/env.js";

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "userbase-backend API",
    version: "1.0.0",
    description:
      "Authentication, user management (admin), and health endpoints for userbase-backend.",
  },
  servers: [
    {
      url: `http://localhost:${env.PORT}`,
      description: "Local development",
    },
  ],
  tags: [{ name: "System" }, { name: "Auth" }, { name: "Users" }],
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
      AuthBody: {
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
              schema: { $ref: "#/components/schemas/AuthBody" },
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
            description: "Validation error",
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
              schema: { $ref: "#/components/schemas/AuthBody" },
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
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
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
          403: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
          404: { description: "User not found", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } } },
        },
      },
    },
  },
};
