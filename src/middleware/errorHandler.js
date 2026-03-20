import { AppError } from "../utils/AppError.js";

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, "Not found"));
}

export function errorHandler(err, _req, res, _next) {
  const statusCode =
    err instanceof AppError ? err.statusCode : err.statusCode ?? 500;
  const isOperational = err instanceof AppError && err.isOperational;
  const message =
    isOperational && err instanceof Error
      ? err.message
      : "Internal server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ error: message });
}
