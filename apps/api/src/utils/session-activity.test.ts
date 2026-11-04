import { describe, expect, it } from "vitest";
import { shouldTouchSession } from "./session-activity";

describe("shouldTouchSession", () => {
  const now = new Date("2026-11-04T12:00:00.000Z");
  const FIVE_MIN = 5 * 60_000;

  it("does not write when the last write is recent", () => {
    expect(shouldTouchSession(new Date(now.getTime() - 60_000), now, FIVE_MIN)).toBe(false);
  });
  it("writes exactly at the interval", () => {
    expect(shouldTouchSession(new Date(now.getTime() - FIVE_MIN), now, FIVE_MIN)).toBe(true);
  });
  it("writes when the last write is old", () => {
    expect(shouldTouchSession(new Date(now.getTime() - 3_600_000), now, FIVE_MIN)).toBe(true);
  });
});
