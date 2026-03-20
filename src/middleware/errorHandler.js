import mongoose from "mongoose";
import { AppError } from "../utils/AppError.js";

export function notFoundHandler(_req, _res, next) {
  next(new AppError(404, "Not found"));
}

export function errorHandler(err, _req, res, _next) {
  let e = err;

  if (err instanceof mongoose.Error.CastError) {
    e = new AppError(400, "Invalid id");
  } else if (err.code === 11000) {
    e = new AppError(409, "Duplicate entry");
  }

  const statusCode =
    e instanceof AppError ? e.statusCode : e.statusCode ?? 500;
  const isOperational = e instanceof AppError && e.isOperational;
  const message =
    isOperational && e instanceof Error ? e.message : "Internal server error";

  if (statusCode >= 500) {
    console.error(e);
  }

  res.status(statusCode).json({ error: message });
}
