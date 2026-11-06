import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { AppError } from "../utils/app-error";

vi.mock("@algoforge/db", () => ({ Prisma: { PrismaClientKnownRequestError: class extends Error {} } }));

import { errorHandler } from "./error-handler";

function run(err: unknown) {
  const headers: Record<string, string> = {};
  const res = {
    headersSent: false,
    setHeader: (k: string, v: string) => void (headers[k] = v),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
  const req = { requestId: "r1", method: "POST", originalUrl: "/api/analysis" } as Request;
  errorHandler(err, req, res, vi.fn());
  return { res, headers };
}

describe("errorHandler", () => {
  it("sends the quota, retry hint and Retry-After header for QUOTA_EXCEEDED", () => {
    const quota = { scope: "minute" as const, limit: 3, remaining: 0, resetAt: "2026-11-06T10:01:00.000Z" };
    const { res, headers } = run(AppError.quotaExceeded("slow down", quota, 25));
    expect(res.status).toHaveBeenCalledWith(429);
    expect(headers["Retry-After"]).toBe("25");
    expect(res.json).toHaveBeenCalledWith({ error: { code: "QUOTA_EXCEEDED", message: "slow down", retryAfterSeconds: 25, quota } });
  });

  it("uses distinct codes for provider outage, timeout and invalid output", () => {
    const cases: [AppError, number, string][] = [
      [AppError.aiUnavailable(), 503, "AI_PROVIDER_UNAVAILABLE"],
      [AppError.aiTimeout(), 504, "AI_PROVIDER_TIMEOUT"],
      [AppError.aiInvalidOutput(), 502, "AI_INVALID_OUTPUT"],
    ];
    for (const [err, status, code] of cases) {
      const { res } = run(err);
      expect(res.status).toHaveBeenCalledWith(status);
      expect(vi.mocked(res.json).mock.calls[0][0].error.code).toBe(code);
    }
  });

  it("hides the details of unexpected errors", () => {
    const { res } = run(new Error("secret"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(vi.mocked(res.json).mock.calls[0][0].error.message).toBe("An unexpected error occurred.");
  });
});
