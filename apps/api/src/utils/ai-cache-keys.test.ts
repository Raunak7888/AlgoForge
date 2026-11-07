import { describe, expect, it } from "vitest";
import { analysisCacheKey, deriveTitle, hashCode } from "./ai-cache-keys";

describe("analysisCacheKey", () => {
  const h = hashCode("code");
  it("changes with the prompt version, language and code", () => {
    const base = analysisCacheKey("python", h, "v1");
    expect(analysisCacheKey("python", h, "v2")).not.toBe(base);
    expect(analysisCacheKey("javascript", h, "v1")).not.toBe(base);
    expect(analysisCacheKey("python", hashCode("other"), "v1")).not.toBe(base);
    expect(analysisCacheKey("python", h, "v1")).toBe(base);
  });
});

describe("deriveTitle", () => {
  it("uses the first sentence of the summary", () => {
    expect(deriveTitle("Iterative binary search. It halves the range.", "x")).toBe("Iterative binary search");
  });
  it("falls back to the first line of code", () => {
    expect(deriveTitle("", "\n\n  def f(x):\n    pass")).toBe("def f(x):");
  });
  it("clips long titles and handles empty input", () => {
    expect(deriveTitle("a".repeat(200), "").length).toBeLessThanOrEqual(80);
    expect(deriveTitle(null, "")).toBe("Untitled analysis");
  });
});
