import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError } from "../api/errors";

const MAX_RETRIES = 2;

/** Retry rules shared by every query: transient problems retry, caller mistakes do not. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500;
  return false; // 4xx (the API client already tried a session refresh) and contract violations
}

/** 429 waits for the server's hint (capped); everything else backs off exponentially. */
export function retryDelayMs(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: shouldRetry, retryDelay: retryDelayMs },
      mutations: { retry: false },
    },
  });
}
