import type { ErrorCode, ErrorDetail, QuotaInfo } from "@algoforge/contracts";

/** The API answered with a non-2xx status. Always carries the typed error envelope when the API sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly requestId: string | null;
  /** Seconds the server asked us to wait (429 and some 503). */
  readonly retryAfterSeconds: number | null;
  /** The quota window that rejected the request (QUOTA_EXCEEDED only). */
  readonly quota: QuotaInfo | null;

  constructor(init: {
    status: number;
    code: ErrorCode;
    message: string;
    details?: readonly ErrorDetail[];
    requestId?: string | null;
    retryAfterSeconds?: number | null;
    quota?: QuotaInfo | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.quota = init.quota ?? null;
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

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

/** A short message that is safe to show to people. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case "QUOTA_EXCEEDED": {
        const q = error.quota;
        if (q?.scope === "day") return `You have used all ${q.limit} analyses for today. You can analyze again at ${timeOf(q.resetAt)}.`;
        const wait = error.retryAfterSeconds;
        return wait !== null ? `You are analyzing too quickly. Try again in ${wait}s.` : "You are analyzing too quickly. Try again in a moment.";
      }
      case "AI_PROVIDER_UNAVAILABLE":
        return "The analysis service is temporarily unavailable. Try again in a minute. This did not use your quota.";
      case "AI_PROVIDER_TIMEOUT":
        return "The analysis took too long and was stopped. Try again, or analyze a smaller piece of code. This did not use your quota.";
      case "AI_INVALID_OUTPUT":
        return "The analysis service returned an answer that could not be read. Try again. This did not use your quota.";
      default:
        break;
    }
    if (error.status === 429) {
      return error.retryAfterSeconds !== null ? `Too many requests. Try again in ${error.retryAfterSeconds}s.` : "Too many requests. Try again shortly.";
    }
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ResponseValidationError) return "The server sent an unexpected response.";
  return "Something went wrong.";
}
