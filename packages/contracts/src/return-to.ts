import { AUTH_ERROR_PARAM } from "./auth";

/**
 * Where a person lands after signing in. The value comes from the browser, so it is never trusted:
 * only plain internal paths under a short allowlist of app sections survive.
 * Used by the API (before storing and before redirecting) and by the web app (before building the sign-in link).
 */
export const DEFAULT_RETURN_TO = "/dashboard";
export const RETURN_TO_MAX_LENGTH = 512;

const PLACEHOLDER_ORIGIN = "http://internal.invalid";
const ALLOWED_ROOTS: ReadonlySet<string> = new Set(["dashboard", "visualizer", "algorithms", "s", "terms", "privacy"]);

/** Control characters and backslashes can turn a path into something else in some browsers. */
function hasUnsafeChars(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

export function sanitizeReturnTo(value: unknown, fallback: string = DEFAULT_RETURN_TO): string {
  if (typeof value !== "string") return fallback;
  const raw = value.trim();
  if (raw.length === 0 || raw.length > RETURN_TO_MAX_LENGTH) return fallback;
  if (raw[0] !== "/" || raw.startsWith("//") || hasUnsafeChars(raw)) return fallback;

  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || hasUnsafeChars(decoded)) return fallback;

  let url: URL;
  try {
    url = new URL(raw, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;

  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length > 0 && !ALLOWED_ROOTS.has(segments[0])) return fallback;

  // A stale error from an earlier attempt must never be carried into the next one.
  url.searchParams.delete(AUTH_ERROR_PARAM);
  return `${url.pathname}${url.search}`;
}

/** Adds ?authError=<code> to an (already sanitized) internal path. */
export function appendAuthError(path: string, code: string): string {
  const url = new URL(path, PLACEHOLDER_ORIGIN);
  url.searchParams.set(AUTH_ERROR_PARAM, code);
  return `${url.pathname}${url.search}`;
}
