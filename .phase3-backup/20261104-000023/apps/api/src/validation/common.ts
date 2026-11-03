import { AppError } from "../utils/app-error";

export function ensureString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest(message);
  }
  return value.trim();
}