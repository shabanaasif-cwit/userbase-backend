import { AppError } from "./AppError.js";

export function assertNonEmptyEmailLocal(email) {
  const local = email.split("@")[0] ?? "";
  if (!local) {
    throw new AppError(400, "Email local part (before @) cannot be empty");
  }
}
