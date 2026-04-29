# userbase-backend

Node.js + Express API for the userbase project.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set:

- **`MONGODB_URI`** — local example: `mongodb://127.0.0.1:3001/userbase`
- **`FRONTEND_ORIGIN`** — your SPA origin (CORS + refresh cookie); must match how you open the frontend (e.g. Vite `http://localhost:3000`)
- **`JWT_ACCESS_SECRET`** / **`JWT_REFRESH_SECRET`** — long random strings in production
- **`ACCESS_TOKEN_TTL`** / **`REFRESH_TOKEN_TTL`** — optional (defaults `15m` / `1d`)
- **`PORT`** — optional (default `3001`)

Never commit `.env` or real secrets.

## Run

Requires a running MongoDB instance reachable at `MONGODB_URI`.

```bash
npm run dev   # dev with auto-reload (Node --watch)
npm start     # production-style run
```

## Automated tests

Uses [Vitest](https://vitest.dev/), [Supertest](https://github.com/ladjs/supertest), and an in-memory MongoDB ([mongodb-memory-server](https://github.com/nodkz/mongodb-memory-server)). No separate MongoDB process is required for `npm test`.

```bash
npm test        # single run
npm test:watch  # watch mode
```

Coverage includes auth (signup, login, `/me`), RBAC (`403` on admin routes for non-admins), admin user listing, notification payload validation, notification admin/user flows (create → list → mark read → `read` query), and consistent **400** responses for malformed JSON.

## Error responses

All operational errors use a single JSON shape:

```json
{ "error": "Human-readable message" }
```

Examples:

- **400** — validation (e.g. weak password on signup, invalid notification payload, invalid Mongo id cast to **400** `Invalid id`), or **malformed JSON** body → `{ "error": "Invalid JSON" }`.
- **401** — missing/invalid access JWT, bad login credentials, etc.
- **403** — wrong role for the route (admin-only) → `{ "error": "Forbidden (admin only)" }`; deactivated account messages use their own `error` text.
- **404** — missing resource where applicable.
- **405** — wrong HTTP method (includes `Allow` header).

Full path-level response lists and request schemas live in **`GET /openapi.json`** and **`GET /docs`** (Scalar); keep the README endpoint list in sync when you add or change routes.

## Project layout

| Path | Role |
|------|------|
| `src/index.js` | Process entry: env, MongoDB, HTTP server, graceful shutdown (SIGINT/SIGTERM) |
| `src/app.js` | Express: Helmet, CORS (credentials), JSON, cookies, routes, errors |
| `src/config/env.js` | Validated environment variables |
| `src/db/connect.js` | Mongoose connection |
| `src/models/User.js` | Minimal user schema (roles / status stubs for auth & admin later) |
| `src/middleware/errorHandler.js` | 404 + centralized errors |
| `src/middleware/asyncHandler.js` | Async route wrapper |
| `src/routes/index.js` | Public HTTP routes |
| `src/routes/auth.routes.js` | Auth routes under `/api/auth` |
| `src/routes/notifications.routes.js` | Notification routes under `/api/notifications` |
| `src/routes/users.routes.js` | Admin user-management routes under `/api/users` |
| `src/services/authService.js` | Signup, login, refresh rotation, logout |
| `src/services/notificationService.js` | Notification create/list/update/delete/read logic |
| `src/validation/notificationPayload.js` | Create/update notification JSON validation (`AppError` 400) |
| `src/services/userAdminService.js` | Admin list/filter/search/update/deactivate user logic |
| `src/utils/jwt.js` | Sign / verify access & refresh JWTs |
| `src/utils/authCookies.js` | httpOnly refresh cookie options (`path: /api/auth`) |
| `src/middleware/verifyJwt.js` | Bearer access JWT → `req.user.userId`, `req.user.role` |
| `src/middleware/requireRole.js` | Role check middleware (e.g. admin-only routes) |
| `src/models/RefreshToken.js` | Stored refresh sessions (`jti`, revoke, TTL index) |
| `src/docs/openapi.js` | OpenAPI 3 spec (`/openapi.json`, Scalar `/docs`) |
| `test/http.integration.test.js` | HTTP integration: auth, RBAC, users, notifications |
| `test/notificationPayload.test.js` | Unit tests for notification payload validation |

**Auth:** Access JWT in **`Authorization: Bearer`**. Refresh JWT in **`refreshToken` httpOnly cookie** (`Secure` in production, `SameSite=lax`, path `/api/auth`). Clients must use `fetch(..., { credentials: 'include' })` for `/api/auth/*` so the cookie is sent.

## Endpoints

- `GET /` — API info
- `GET /health` — liveness; returns **503** if MongoDB is not connected (`db` field in JSON)
- `GET /openapi.json` — OpenAPI spec used by Scalar
- `GET /docs` — Scalar interactive API reference
- `POST /api/auth/signup` — body `{ email, password, confirmPassword, role }` → `{ user, accessToken }` + sets refresh cookie
- `POST /api/auth/login` — body `{ email, password, role }` → `{ user, accessToken }` + sets refresh cookie
- `POST /api/auth/refresh` — uses refresh cookie → new `{ user, accessToken }` + rotated refresh cookie
- `POST /api/auth/logout` — revokes refresh session (if cookie present), clears cookie → **204**
- `GET /api/auth/me` — header `Authorization: Bearer <accessToken>` → `{ user }`
- `GET /api/notifications` — authenticated list (users see own, admins see broader). Query: `page`, `limit`, `search`, `read` (`true`|`false`, non-admin read filter)
- `POST /api/notifications` — admin-only; JSON body matches OpenAPI **`CreateNotificationBody`**: `title`, `body`, `targetType` (`users` = specific ids in `targetUsers`, `user` = all app users, `admin` = all admins, `all` = everyone)
- `PATCH /api/notifications/:notificationId` — admin-only partial update; body matches OpenAPI **`UpdateNotificationBody`** (at least one field; changing `targetType` re-resolves recipients like create)
- `DELETE /api/notifications/:notificationId` — admin-only delete → **204**
- `POST /api/notifications/:notificationId/remind` — admin-only create a reminder record from an existing notification (stored in **`reminders`** collection; optional overrides body matches OpenAPI **`ReminderBody`**)
- `PATCH /api/notifications/:notificationId/read` — recipient marks their copy read (must be in `recipients`)
- `GET /api/reminders` — authenticated list (users see own, admins see broader). Query: `page`, `limit`, `search`, `read` (`true`|`false`, non-admin read filter)
- `PATCH /api/reminders/:reminderId/read` — recipient marks their reminder read
- `GET /api/users` — admin-only list/filter/search users (`page`, `limit`, `role`, `accountStatus`, `search`)
- `PATCH /api/users/:userId` — admin-only update user `email`, `role`, or `accountStatus`
- `PATCH /api/users/:userId/deactivate` — admin-only deactivate user account
- `PATCH /api/users/:userId/toggle-account` — admin-only flip `accountStatus` between active and deactivated (one call for activate/deactivate UI)

## Testing flow (Scalar or manual)

1. Start server with `npm run dev`.
2. Open `http://localhost:3001/docs`.
3. Run `POST /api/auth/signup` with JSON body:
   - `{ "email": "you@example.com", "password": "Password1@", "confirmPassword": "Password1@", "role": "user" }`
4. Or run `POST /api/auth/login` with JSON body:
   - `{ "email": "you@example.com", "password": "Password1@", "role": "user" }`
5. Copy `accessToken` from the response.
6. Run `GET /api/auth/me` with header:
   - `Authorization: Bearer <accessToken>`
7. Run `POST /api/auth/refresh` (uses refresh cookie set by login/signup).
8. Run `POST /api/auth/logout`, then call `POST /api/auth/refresh` again (should return `401`).
