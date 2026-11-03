import type { ErrorCode, ErrorDetail } from "@algoforge/contracts";

/** The API answered with a non-2xx status. Always carries the typed error envelope when the API sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly requestId: string | null;
  /** Seconds the server asked us to wait (429 only). */
  readonly retryAfterSeconds: number | null;

  constructor(init: { status: number; code: ErrorCode; message: string; details?: readonly ErrorDetail[]; requestId?: string | null; retryAfterSeconds?: number | null }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

/** The request never produced a response (offline, DNS, CORS, server down). */
export class NetworkError extends Error {
  constructor(message = "Could not reach the server.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkError";
  }
}

/** The API answered 2xx but the body did not match the shared contract. */
export class ResponseValidationError extends Error {
  readonly path: string;
  readonly issues: readonly ErrorDetail[];

  constructor(path: string, issues: readonly ErrorDetail[]) {
    super(`The response from ${path} did not match the API contract.`);
    this.name = "ResponseValidationError";
    this.path = path;
    this.issues = issues;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** A short message that is safe to show to people. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return error.retryAfterSeconds !== null ? `Too many requests. Try again in ${error.retryAfterSeconds}s.` : "Too many requests. Try again shortly.";
    }
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ResponseValidationError) return "The server sent an unexpected response.";
  return "Something went wrong.";
}
