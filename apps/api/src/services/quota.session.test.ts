import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppError } from "../utils/app-error";

const { today } = vi.hoisted(() => ({ today: vi.fn() }));

vi.mock("../config/env", () => ({
  env: { quotas: { analysisPerMinute: 2, analysisPerDay: 3, assistantPerMinute: 1, assistantPerDay: 5 } },
}));
vi.mock("../config/redis", () => ({
  getRedisClient: () => {
    throw new Error("redis down");
  },
}));
vi.mock("./ai-usage.service", () => ({ aiUsageService: { today } }));

import { quotaService } from "./quota.service";

const now = new Date("2026-11-06T10:00:20.000Z");
async function rejection(p: Promise<unknown>): Promise<AppError> {
  try {
    await p;
  } catch (e) {
    return e as AppError;
  }
  throw new Error("expected a rejection");
}

describe("assistant quota (AiUsage feature 'session')", () => {
  beforeEach(() => today.mockReset());

  it("uses its own limits and says 'assistant message'", async () => {
    today.mockResolvedValue(null);
    await quotaService.reserve("s-min", "session", now);
    const err = await rejection(quotaService.reserve("s-min", "session", now));
    expect(err.extras?.quota).toMatchObject({ scope: "minute", limit: 1 });
    expect(err.message).toContain("Assistant message limit");
  });

  it("seeds the daily count from AiUsage for the 'session' feature", async () => {
    today.mockResolvedValue({ requests: 5 });
    const err = await rejection(quotaService.reserve("s-day", "session", now));
    expect(today).toHaveBeenCalledWith("s-day", "session", now);
    expect(err.extras?.quota).toMatchObject({ scope: "day", limit: 5, remaining: 0 });
  });

  it("keeps analysis and assistant pools separate", async () => {
    today.mockResolvedValue(null);
    await quotaService.reserve("s-both", "analysis", now);
    await expect(quotaService.reserve("s-both", "session", now)).resolves.toBeTruthy();
  });
});
