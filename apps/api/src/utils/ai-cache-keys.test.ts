import { describe, expect, it } from "vitest";
import { analysisCacheKey, deriveTitle, explainCacheKey, hashCode } from "./ai-cache-keys";

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

describe("explainCacheKey", () => {
  const input = { promptVersion: "p1", catalogVersion: 1, query: "how does bfs work", intent: "explain_flow", slugs: ["bfs"], routes: [] as string[] };
  it("changes with every input that changes the answer", () => {
    const base = explainCacheKey(input);
    expect(explainCacheKey({ ...input, promptVersion: "p2" })).not.toBe(base);
    expect(explainCacheKey({ ...input, catalogVersion: 2 })).not.toBe(base);
    expect(explainCacheKey({ ...input, slugs: ["dfs"] })).not.toBe(base);
    expect(explainCacheKey({ ...input, intent: "general" })).not.toBe(base);
    expect(explainCacheKey({ ...input, query: "How does BFS work" })).not.toBe(base);
  });
  it("ignores the order of matched slugs", () => {
    expect(explainCacheKey({ ...input, slugs: ["a", "b"] })).toBe(explainCacheKey({ ...input, slugs: ["b", "a"] }));
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
