import { z } from "zod";
import { IsoDateTimeSchema } from "./common";

export const ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "TOO_MANY_REQUESTS",
  "QUOTA_EXCEEDED",
  "BAD_GATEWAY",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_TIMEOUT",
  "AI_INVALID_OUTPUT",
  "INTERNAL_ERROR",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  QUOTA_EXCEEDED: 429,
  BAD_GATEWAY: 502,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_PROVIDER_TIMEOUT: 504,
  AI_INVALID_OUTPUT: 502,
  INTERNAL_ERROR: 500,
};

export const ErrorDetailSchema = z.object({ path: z.string(), message: z.string() });
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/** One quota window: how much is allowed, used and left, and when it resets. */
export const QuotaWindowSchema = z.object({
  limit: z.number().int().min(0),
  used: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetAt: IsoDateTimeSchema,
});
export type QuotaWindow = z.infer<typeof QuotaWindowSchema>;

/** The window that rejected a request (sent with QUOTA_EXCEEDED). */
export const QuotaInfoSchema = z.object({
  scope: z.enum(["minute", "day"]),
  limit: z.number().int().min(0),
  remaining: z.number().int().min(0),
  resetAt: IsoDateTimeSchema,
});
export type QuotaInfo = z.infer<typeof QuotaInfoSchema>;

/** The one error envelope. 429 responses also carry a Retry-After header. */
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
    retryAfterSeconds: z.number().int().min(0).optional(),
    quota: QuotaInfoSchema.optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
