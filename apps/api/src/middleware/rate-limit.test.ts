import type { NextFunction, Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ counts: new Map<string, number>(), fail: false }));

vi.mock("../config/redis", () => ({
  getRedisClient: () => ({
    eval: async (_script: string, _numKeys: number, key: string): Promise<number> => {
      if (h.fail) throw new Error("redis down");
      const next = (h.counts.get(key) ?? 0) + 1;
      h.counts.set(key, next);
      return next;
    },
    ttl: async (): Promise<number> => 120,
  }),
}));
vi.mock("../config/env", () => ({
  env: {
    isProduction: false,
    redis: { aiRateLimitPerHour: 2, defaultRateLimitPerMinute: 2 },
  },
}));

import { aiRateLimiter, generalRateLimiter } from "./rate-limit";

function fakeReq(ip: string, forwardedFor?: string, userId?: string): Request {
  return {
    ip,
    headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
    auth: userId ? { user: { id: userId } } : undefined,
  } as unknown as Request;
}

async function hit(
  mw: (req: Request, res: Response, next: NextFunction) => Promise<void>,
  req: Request,
): Promise<unknown> {
  const next = vi.fn();
  const res = { setHeader: vi.fn() } as unknown as Response;
  await mw(req, res, next as unknown as NextFunction);
  return next.mock.calls[0]?.[0];
}

beforeEach(() => {
  h.counts.clear();
  h.fail = false;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("S-03: spoofed X-Forwarded-For cannot bypass limits", () => {
  it("AI limiter keys on req.ip, not on X-Forwarded-For", async () => {
    const mw = aiRateLimiter("explain");
    expect(await hit(mw, fakeReq("10.0.0.1", "1.1.1.1"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.0.0.1", "2.2.2.2"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.0.0.1", "3.3.3.3"))).toMatchObject({ statusCode: 429 });
    // a different real client with the same forwarded header is a different bucket
    expect(await hit(mw, fakeReq("10.0.0.2", "3.3.3.3"))).toBeUndefined();
  });

  it("general limiter keys on req.ip, not on X-Forwarded-For", async () => {
    const mw = generalRateLimiter();
    expect(await hit(mw, fakeReq("10.1.0.1", "1.1.1.1"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.1.0.1", "2.2.2.2"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.1.0.1", "3.3.3.3"))).toMatchObject({ statusCode: 429 });
  });
});

describe("S-05: per-user AI limits", () => {
  it("limits by user id regardless of IP", async () => {
    const mw = aiRateLimiter("analysis");
    expect(await hit(mw, fakeReq("10.2.0.1", undefined, "u1"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.2.0.2", undefined, "u1"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.2.0.3", undefined, "u1"))).toMatchObject({ statusCode: 429 });
    // another user from the same IP is unaffected
    expect(await hit(mw, fakeReq("10.2.0.1", undefined, "u2"))).toBeUndefined();
  });
});

describe("S-06: AI limiter fails closed when Redis is down", () => {
  it("enforces the limit in memory", async () => {
    h.fail = true;
    const mw = aiRateLimiter("session");
    expect(await hit(mw, fakeReq("10.3.0.1", undefined, "redis-down-user"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.3.0.1", undefined, "redis-down-user"))).toBeUndefined();
    expect(await hit(mw, fakeReq("10.3.0.1", undefined, "redis-down-user"))).toMatchObject({ statusCode: 429 });
  });
});
