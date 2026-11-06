import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "../api/errors";
import { failureFrom } from "./failure";

describe("failureFrom", () => {
  it("uses the quota reset time as the retry time", () => {
    const err = new ApiError({
      status: 429,
      code: "QUOTA_EXCEEDED",
      message: "x",
      quota: { scope: "day", limit: 30, remaining: 0, resetAt: "2026-11-07T00:00:00.000Z" },
    });
    const f = failureFrom(err, 0);
    expect(f.code).toBe("QUOTA_EXCEEDED");
    expect(f.retryAt).toBe(Date.parse("2026-11-07T00:00:00.000Z"));
    expect(f.message).toContain("30 analyses");
  });

  it("falls back to Retry-After seconds", () => {
    const err = new ApiError({ status: 429, code: "QUOTA_EXCEEDED", message: "x", retryAfterSeconds: 20 });
    expect(failureFrom(err, 1000).retryAt).toBe(21_000);
  });

  it("has no retry time for provider failures, which never use quota", () => {
    const f = failureFrom(new ApiError({ status: 503, code: "AI_PROVIDER_UNAVAILABLE", message: "x" }), 0);
    expect(f.retryAt).toBeNull();
    expect(f.message).toContain("did not use your quota");
  });

  it("handles network and unknown errors", () => {
    expect(failureFrom(new NetworkError()).code).toBeNull();
    expect(failureFrom("boom").message).toBe("Something went wrong.");
  });
});
