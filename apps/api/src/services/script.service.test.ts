import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { assertValidScript, checkScript } from "./script.service";

const good = JSON.stringify([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [3, 1, 2] },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("assertValidScript", () => {
  it("returns the analysis for a valid script", () => {
    const a = assertValidScript(good);
    expect(a.stepCount).toBe(2);
    expect(a.structures[0]?.id).toBe("A");
  });

  it("rejects with a 400 that carries line and column", () => {
    try {
      assertValidScript(JSON.stringify([{ step: 1, id: "A", ds: "array", op: "apend", value: 1 }]));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const e = error as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.details?.[0]?.path).toMatch(/^script:\d+:\d+$/);
    }
  });

  it("rejects a script above the shared size limit", () => {
    expect(() => assertValidScript(" ".repeat(LIMITS.script.maxChars + 1))).toThrow(AppError);
  });

  it("allows a rejected operation, which is only a warning", () => {
    const text = JSON.stringify([
      { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] },
      { step: 2, id: "A", op: "swap", indexA: 0, indexB: 9 },
    ]);
    expect(() => assertValidScript(text)).not.toThrow();
  });

  it("checkScript never throws", () => {
    expect(checkScript("not json").ok).toBe(false);
  });
});
