# userbase-backend

Node.js + Express API for the userbase project.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set:

- **`MONGODB_URI`** — local example: `mongodb://127.0.0.1:27017/userbase`
- **`FRONTEND_ORIGIN`** — your SPA origin (CORS + refresh cookie); must match how you open the frontend (e.g. Vite `http://localhost:5173`)
- **`JWT_ACCESS_SECRET`** / **`JWT_REFRESH_SECRET`** — long random strings in production
- **`ACCESS_TOKEN_TTL`** / **`REFRESH_TOKEN_TTL`** — optional (defaults `15m` / `7d`)
- **`PORT`** — optional (default `3001`)

Never commit `.env` or real secrets.

## Run

Requires a running MongoDB instance reachable at `MONGODB_URI`.

```bash
npm run dev   # dev with auto-reload (Node --watch)
npm start     # production-style run
```

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
| `src/services/authService.js` | Signup, login, refresh rotation, logout |
| `src/utils/jwt.js` | Sign / verify access & refresh JWTs |
| `src/utils/authCookies.js` | httpOnly refresh cookie options (`path: /api/auth`) |
| `src/middleware/verifyJwt.js` | Bearer access JWT → `req.user.userId`, `req.user.role` |
| `src/models/RefreshToken.js` | Stored refresh sessions (`jti`, revoke, TTL index) |

**Auth:** Access JWT in **`Authorization: Bearer`**. Refresh JWT in **`refreshToken` httpOnly cookie** (`Secure` in production, `SameSite=lax`, path `/api/auth`). Clients must use `fetch(..., { credentials: 'include' })` for `/api/auth/*` so the cookie is sent.

## Endpoints

- `GET /` — API info
- `GET /health` — liveness; returns **503** if MongoDB is not connected (`db` field in JSON)
- `GET /openapi.json` — OpenAPI spec used by Scalar
- `GET /docs` — Scalar interactive API reference
- `POST /api/auth/signup` — body `{ email, password }` → `{ user, accessToken }` + sets refresh cookie
- `POST /api/auth/login` — body `{ email, password }` → `{ user, accessToken }` + sets refresh cookie
- `POST /api/auth/refresh` — uses refresh cookie → new `{ user, accessToken }` + rotated refresh cookie
- `POST /api/auth/logout` — revokes refresh session (if cookie present), clears cookie → **204**
- `GET /api/auth/me` — header `Authorization: Bearer <accessToken>` → `{ user }`

## Testing flow (Scalar or manual)

1. Start server with `npm run dev`.
2. Open `http://localhost:3001/docs`.
3. Run `POST /api/auth/signup` (or `POST /api/auth/login`) with JSON body:
   - `{ "email": "you@example.com", "password": "Password123!" }`
4. Copy `accessToken` from the response.
5. Run `GET /api/auth/me` with header:
   - `Authorization: Bearer <accessToken>`
6. Run `POST /api/auth/refresh` (uses refresh cookie set by login/signup).
7. Run `POST /api/auth/logout`, then call `POST /api/auth/refresh` again (should return `401`).
