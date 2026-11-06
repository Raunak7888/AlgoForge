import type { ZodError } from "zod";
import type { ErrorDetail } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";

export function ensureString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest(message);
  }
  return value.trim();
}

export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.map((p) => String(p)).join("."), message: issue.message }));
}

/** 400 with the first issue as the message and every issue under error.details. */
export function badRequestFromZod(error: ZodError, fallback: string): AppError {
  return AppError.badRequest(error.issues[0]?.message ?? fallback, zodDetails(error));
}
