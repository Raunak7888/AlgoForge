import { describe, expect, it } from "vitest";
import {
  AnalysisHistoryQuerySchema,
  AnalysisQuotaResponseSchema,
  AnalysisRecordResponseSchema,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ErrorResponseSchema,
  routes,
} from "./index";

describe("phase 7 contracts", () => {
  it("maps every error code to an HTTP status", () => {
    for (const code of ERROR_CODES) expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    expect(ERROR_HTTP_STATUS.QUOTA_EXCEEDED).toBe(429);
    expect(ERROR_HTTP_STATUS.AI_PROVIDER_TIMEOUT).toBe(504);
  });

  it("accepts a structured quota error", () => {
    const parsed = ErrorResponseSchema.safeParse({
      error: {
        code: "QUOTA_EXCEEDED",
        message: "limit",
        retryAfterSeconds: 30,
        quota: { scope: "day", limit: 30, remaining: 0, resetAt: "2026-11-07T00:00:00.000Z" },
      },
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts history filters and sort", () => {
    expect(AnalysisHistoryQuerySchema.safeParse({ q: "sort", language: "python", sort: "oldest", limit: 10 }).success).toBe(true);
    expect(AnalysisHistoryQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });

  it("returns the code, title and share flag on a record", () => {
    const rec = { id: "a", language: "python", code: "x", title: null, result: null, resultStatus: "unreadable", isShared: false, createdAt: "2026-11-06T00:00:00.000Z" };
    expect(AnalysisRecordResponseSchema.safeParse(rec).success).toBe(true);
  });

  it("validates the quota response", () => {
    const w = { limit: 3, used: 1, remaining: 2, resetAt: "2026-11-06T10:00:00.000Z" };
    expect(AnalysisQuotaResponseSchema.safeParse({ minute: w, day: w }).success).toBe(true);
  });

  it("documents the new endpoints", () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    expect(keys.has("get /api/analysis/quota")).toBe(true);
    expect(keys.has("delete /api/analysis/{id}")).toBe(true);
  });
});
