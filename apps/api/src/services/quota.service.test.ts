import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../utils/app-error";

const { today } = vi.hoisted(() => ({ today: vi.fn() }));

vi.mock("../config/env", () => ({ env: { quotas: { analysisPerMinute: 2, analysisPerDay: 3 } } }));
vi.mock("../config/redis", () => ({
  getRedisClient: () => {
    throw new Error("redis down");
  },
}));
vi.mock("./ai-usage.service", () => ({ aiUsageService: { today } }));

import { dayWindow, minuteWindow, quotaService } from "./quota.service";

const now = new Date("2026-11-06T10:00:20.000Z");

async function rejection(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("expected a rejection");
}

describe("quotaService (redis down: memory minute counter, database daily count)", () => {
  beforeEach(() => today.mockReset());

  it("allows the configured number per minute, then answers 429 with a retry hint", async () => {
    today.mockResolvedValue(null);
    await quotaService.reserve("u-min", "analysis", now);
    await quotaService.reserve("u-min", "analysis", now);
    const err = await rejection(quotaService.reserve("u-min", "analysis", now));
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.extras?.quota?.scope).toBe("minute");
    expect(err.extras?.retryAfterSeconds).toBe(40);
    expect(err.extras?.quota?.resetAt).toBe(new Date(minuteWindow(now).resetAtMs).toISOString());
  });

  it("rejects when the day is used up and reports the next UTC midnight", async () => {
    today.mockResolvedValue({ requests: 3 });
    const err = await rejection(quotaService.reserve("u-day", "analysis", now));
    expect(err.extras?.quota).toMatchObject({ scope: "day", limit: 3, remaining: 0 });
    expect(err.extras?.quota?.resetAt).toBe("2026-11-07T00:00:00.000Z");
    expect(dayWindow(now).resetAtMs).toBe(Date.parse("2026-11-07T00:00:00.000Z"));
  });

  it("gives the unit back when the reservation is released", async () => {
    today.mockResolvedValue(null);
    const a = await quotaService.reserve("u-rel", "analysis", now);
    await quotaService.reserve("u-rel", "analysis", now);
    await a.release();
    await expect(quotaService.reserve("u-rel", "analysis", now)).resolves.toBeTruthy();
  });

  it("reports what is left without using anything", async () => {
    today.mockResolvedValue({ requests: 1 });
    const snap = await quotaService.peek("u-peek", "analysis", now);
    expect(snap.day).toMatchObject({ limit: 3, used: 1, remaining: 2 });
    expect(snap.minute).toMatchObject({ limit: 2, used: 0, remaining: 2 });
  });
});
