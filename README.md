# userbase-backend

Node.js + Express backend for userbase.

This project provides authentication, admin user management, notifications, reminders, and interactive API docs.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and configure:

- `MONGODB_URI` — e.g. `mongodb://127.0.0.1:27017/userbase`
- `FRONTEND_ORIGIN` — frontend origin for CORS and refresh cookie support (e.g. `http://localhost:3000`)
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — strong random secrets
- `ACCESS_TOKEN_TTL` / `REFRESH_TOKEN_TTL` — optional; defaults: `15m` / `7d`
- `ADMIN_SIGNUP_KEY` — required when creating an admin account; include it in the signup body as `adminKey`
- `PORT` — optional; default: `3001`

> Do not commit `.env` or secrets.

## Run

Requires MongoDB reachable at `MONGODB_URI`.

```bash
npm run dev
npm start
```

## Tests

```bash
npm test
npm test:watch
```

Tests use Vitest, Supertest, and an in-memory MongoDB server.

## Architecture

- `src/index.js` — app bootstrap, MongoDB connection, HTTP server, graceful shutdown
- `src/app.js` — Express app, security middleware, CORS, JSON parsing, cookies, routes, error handling
- `src/config/env.js` — environment validation
- `src/db/connect.js` — Mongoose connection and health state
- `src/routes/index.js` — public system routes
- `src/routes/auth.routes.js` — auth endpoints
- `src/routes/notifications.routes.js` — notification endpoints
- `src/routes/reminders.routes.js` — reminder endpoints
- `src/routes/users.routes.js` — admin user endpoints
- `src/services/*.js` — business logic for auth, notifications, reminders, and admin user management
- `src/middleware/*.js` — async wrapper, JWT verification, role guard, error handling
- `src/utils/*.js` — JWT helpers, refresh cookie helpers, AppError
- `src/docs/openapi.js` — OpenAPI spec served via `/openapi.json` and `/docs`

## Auth behavior

- Access JWT is sent in `Authorization: Bearer <accessToken>`.
- Refresh token is stored in a `refreshToken` httpOnly cookie at `/api/auth`.
- Refresh cookie uses `SameSite=lax` and `Secure` in production.
- `FRONTEND_ORIGIN` must match the frontend origin for CORS and cookies.

## Error responses

All operational errors return JSON:

```json
{ "error": "Human-readable message" }
```

Common response codes:

- `400` — validation error or malformed JSON
- `401` — unauthorized or invalid token
- `403` — forbidden / admin-only route
- `404` — resource not found
- `405` — method not allowed

## Endpoints

### System

- `GET /` — API info
- `GET /health` — health status; returns `503` when MongoDB is unavailable
- `GET /openapi.json` — OpenAPI spec
- `GET /docs` — interactive API docs

### Auth

- `POST /api/auth/signup`
  - body: `{ email, password, confirmPassword, role, firstName, lastName, adminKey? }`
  - admin accounts require `ADMIN_SIGNUP_KEY` in the environment and the matching `adminKey` in the request body
  - returns: `{ user, accessToken }`
  - sets a refresh cookie
- `POST /api/auth/login`
  - body: `{ email, password, role }`
  - returns: `{ user, accessToken }`
  - sets a refresh cookie
- `POST /api/auth/refresh`
  - uses refresh cookie
  - returns: `{ user, accessToken }`
- `POST /api/auth/logout`
  - revokes refresh session and clears cookie
  - returns `204`
- `GET /api/auth/me`
  - requires `Authorization: Bearer <accessToken>`
  - returns: `{ user }`

### Notifications

- `GET /api/notifications`
  - authenticated list
  - query: `page`, `limit`, `search`, `read`
- `POST /api/notifications`
  - admin-only
  - body: `title`, `body`, `targetType`, plus `targetUsers` or `targetRoles`
- `PATCH /api/notifications/:notificationId`
  - admin-only update
- `DELETE /api/notifications/:notificationId`
  - admin-only delete
- `POST /api/notifications/:notificationId/remind`
  - admin-only reminder for an existing notification
- `PATCH /api/notifications/:notificationId/read`
  - authenticated recipient marks notification read

### Reminders

- `GET /api/reminders`
  - authenticated list
  - query: `page`, `limit`, `search`, `read`
- `PATCH /api/reminders/:reminderId/read`
  - authenticated recipient marks reminder read

### Users

- `GET /api/users`
  - admin-only list/filter/search users
  - query: `page`, `limit`, `role`, `accountStatus`, `search`
- `PATCH /api/users/:userId`
  - admin-only update `email`, `role`, or `accountStatus`
- `PATCH /api/users/:userId/deactivate`
  - admin-only deactivate account

## Local test flow

1. Run `npm run dev`.
2. Open `http://localhost:3001/docs`.
3. Create a user with `POST /api/auth/signup`.
4. Log in with `POST /api/auth/login`.
5. Use the returned `accessToken` for authenticated requests.
6. Call `POST /api/auth/refresh` to rotate refresh tokens.
7. Call `POST /api/auth/logout`, then verify `POST /api/auth/refresh` fails.
