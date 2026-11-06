/**
 * Where the API lives.
 *  - NEXT_PUBLIC_API_URL unset or empty: same-origin ("/api/..."), the default; Phase 4 adds the Next.js rewrite.
 *  - NEXT_PUBLIC_API_URL=http://localhost:4000: call the API directly (cookies then need a shared site).
 * Pure so it can be tested; the app reads the constant below.
 */
export function resolveApiBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.replace(/\/+$/, "");
}

// A literal process.env access so Next can inline it in client code.
export const API_BASE_URL: string = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
