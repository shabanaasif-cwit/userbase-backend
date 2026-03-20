# userbase-backend

Node.js + Express API for the userbase project.

## Setup

```bash
npm install
```

Copy `.env.example` to `.env` and set:

- **`MONGODB_URI`** — local example: `mongodb://127.0.0.1:27017/userbase`
- **`FRONTEND_ORIGIN`** — your SPA origin (used for CORS with credentials, and for future refresh-cookie flows)
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
| `src/routes/index.js` | HTTP routes |

**Auth strategy (decided for this project):** short-lived **access JWT** in the **`Authorization: Bearer`** header, plus **refresh token** in an **httpOnly, `Secure`, `SameSite`** cookie (HTTPS + correct CORS/cookie flags in production). `cookie-parser` and CORS `credentials: true` are already enabled for that path. Placeholder env keys for JWT secrets live in `.env.example` (wired in when you add the auth module).

## Endpoints

- `GET /` — API info
- `GET /health` — liveness; returns **503** if MongoDB is not connected (`db` field in JSON)
