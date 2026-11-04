import { describe, expect, it } from "vitest";
import { buildLoginUrl, readAuthError, stripAuthError } from "./loginUrl";

describe("buildLoginUrl", () => {
  it("builds a same-origin link with an encoded return path", () => {
    expect(buildLoginUrl("/dashboard?tab=history", "")).toBe("/api/auth/google/start?returnTo=%2Fdashboard%3Ftab%3Dhistory");
  });
  it("uses the given API base and trims its trailing slash", () => {
    expect(buildLoginUrl("/dashboard", "http://localhost:4000/")).toBe("http://localhost:4000/api/auth/google/start?returnTo=%2Fdashboard");
  });
  it("replaces an unsafe return path", () => {
    expect(buildLoginUrl("https://evil.com", "")).toBe("/api/auth/google/start?returnTo=%2Fdashboard");
    expect(buildLoginUrl(undefined, "")).toBe("/api/auth/google/start?returnTo=%2Fdashboard");
  });
});

describe("readAuthError", () => {
  it("returns null when absent", () => {
    expect(readAuthError("")).toBeNull();
    expect(readAuthError("?tab=a")).toBeNull();
  });
  it("reads known codes", () => {
    expect(readAuthError("?authError=oauth_denied")).toBe("oauth_denied");
    expect(readAuthError("?x=1&authError=oauth_failed")).toBe("oauth_failed");
  });
  it("treats an unknown code as a failure", () => {
    expect(readAuthError("?authError=whatever")).toBe("oauth_failed");
  });
});

describe("stripAuthError", () => {
  it("removes only the error parameter", () => {
    expect(stripAuthError("http://localhost:3000/dashboard?authError=oauth_failed&tab=a#x")).toBe("/dashboard?tab=a#x");
    expect(stripAuthError("/dashboard?authError=oauth_failed")).toBe("/dashboard");
  });
});
