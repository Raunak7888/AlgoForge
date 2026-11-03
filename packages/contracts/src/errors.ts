import { z } from "zod";

export const ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "TOO_MANY_REQUESTS",
  "BAD_GATEWAY",
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
  BAD_GATEWAY: 502,
  INTERNAL_ERROR: 500,
};

export const ErrorDetailSchema = z.object({ path: z.string(), message: z.string() });
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/** The one error envelope. 429 responses also carry a Retry-After header. */
export const ErrorResponseSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string(), details: z.array(ErrorDetailSchema).optional() }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
