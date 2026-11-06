import { CSRF_COOKIE_NAME } from "@algoforge/contracts";

/** Reads one cookie from a cookie header string. Pure, so it is testable without a DOM. */
export function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** The af_csrf cookie is readable by design (double-submit). The access and refresh cookies are httpOnly. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return readCookie(document.cookie, CSRF_COOKIE_NAME);
}
