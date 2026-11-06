import {
  AUTH_ERROR_PARAM,
  AuthErrorCodeSchema,
  RETURN_TO_PARAM,
  sanitizeReturnTo,
  type AuthErrorCode,
} from "@algoforge/contracts";

export const LOGIN_START_PATH = "/api/auth/google/start";

export const AUTH_ERROR_MESSAGES: Readonly<Record<AuthErrorCode, string>> = {
  oauth_failed: "Google sign-in did not complete. Please try again.",
  oauth_denied: "Sign-in was cancelled. You can try again whenever you like.",
};

/** The link that starts Google sign-in. A full-page navigation, never an XHR. */
export function buildLoginUrl(returnTo: string | undefined, apiBaseUrl: string): string {
  const base = apiBaseUrl.replace(/\/+$/, "");
  const target = sanitizeReturnTo(returnTo);
  return `${base}${LOGIN_START_PATH}?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`;
}

/** Reads ?authError=… from a query string. An unknown value still counts as a failure. */
export function readAuthError(search: string): AuthErrorCode | null {
  const raw = new URLSearchParams(search).get(AUTH_ERROR_PARAM);
  if (raw === null) return null;
  const parsed = AuthErrorCodeSchema.safeParse(raw);
  return parsed.success ? parsed.data : "oauth_failed";
}

/** The same address without ?authError, so a reload does not show the error again. */
export function stripAuthError(href: string): string {
  const url = new URL(href, "http://internal.invalid");
  url.searchParams.delete(AUTH_ERROR_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}
