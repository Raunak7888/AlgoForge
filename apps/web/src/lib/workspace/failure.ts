import type { RunFailure } from "./store";
import { errorMessage, isApiError } from "../api/errors";

/** Turns any error from an analysis request into what the panel shows, including when trying again can work. */
export function failureFrom(error: unknown, now: number = Date.now()): RunFailure {
  if (isApiError(error)) {
    let retryAt: number | null = null;
    const reset = error.quota ? Date.parse(error.quota.resetAt) : Number.NaN;
    if (!Number.isNaN(reset)) retryAt = reset;
    else if (error.retryAfterSeconds !== null) retryAt = now + error.retryAfterSeconds * 1000;
    return { message: errorMessage(error), code: error.code, retryAt };
  }
  return { message: errorMessage(error), code: null, retryAt: null };
}
