import { describe, expect, it } from "vitest";
import { appendAuthError, DEFAULT_RETURN_TO, sanitizeReturnTo } from "./return-to";

describe("sanitizeReturnTo", () => {
  it("falls back for missing or non-string values", () => {
    for (const v of [undefined, null, 42, {}, [], "", "   ", "dashboard"]) {
      expect(sanitizeReturnTo(v)).toBe(DEFAULT_RETURN_TO);
    }
  });

  it("keeps allowed internal paths and their query", () => {
    expect(sanitizeReturnTo("/")).toBe("/");
    expect(sanitizeReturnTo("/dashboard")).toBe("/dashboard");
    expect(sanitizeReturnTo("/dashboard?tab=history")).toBe("/dashboard?tab=history");
    expect(sanitizeReturnTo("/visualizer")).toBe("/visualizer");
    expect(sanitizeReturnTo("/s/abc123DEF456")).toBe("/s/abc123DEF456");
  });

  it("rejects external and protocol-relative targets", () => {
    for (const v of ["https://evil.com", "//evil.com", "/\\evil.com", "/%2F%2Fevil.com", "javascript:alert(1)", "/\\/evil.com"]) {
      expect(sanitizeReturnTo(v)).toBe(DEFAULT_RETURN_TO);
    }
  });

  it("rejects paths outside the allowlist, including dot-segment tricks", () => {
    for (const v of ["/api/auth/logout", "/admin", "/dashboard/../api/x", "/dashboard/%2e%2e/api/x", "/_next/data"]) {
      expect(sanitizeReturnTo(v)).toBe(DEFAULT_RETURN_TO);
    }
  });

  it("rejects control characters and very long values", () => {
    expect(sanitizeReturnTo("/dashboard\u0000")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("/dash\nboard")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo(`/dashboard?x=${"a".repeat(600)}`)).toBe(DEFAULT_RETURN_TO);
  });

  it("drops a stale authError parameter", () => {
    expect(sanitizeReturnTo("/dashboard?authError=oauth_failed&tab=a")).toBe("/dashboard?tab=a");
  });

  it("uses the given fallback", () => {
    expect(sanitizeReturnTo("https://evil.com", "/")).toBe("/");
  });
});

describe("appendAuthError", () => {
  it("adds the code to a path without a query", () => {
    expect(appendAuthError("/dashboard", "oauth_failed")).toBe("/dashboard?authError=oauth_failed");
  });
  it("keeps an existing query", () => {
    expect(appendAuthError("/dashboard?tab=a", "oauth_denied")).toBe("/dashboard?tab=a&authError=oauth_denied");
  });
  it("replaces an existing code", () => {
    expect(appendAuthError("/dashboard?authError=oauth_failed", "oauth_denied")).toBe("/dashboard?authError=oauth_denied");
  });
});
