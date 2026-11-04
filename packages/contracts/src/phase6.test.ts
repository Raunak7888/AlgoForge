import { describe, expect, it } from "vitest";
import {
  AlgorithmListQuerySchema,
  CreateAlgorithmRequestSchema,
  CreateVisualizationRequestSchema,
  LIMITS,
  SearchQuerySchema,
  UpdateAlgorithmRequestSchema,
  UpdateVisualizationRequestSchema,
  routes,
} from "./index";

const algorithm = {
  slug: "bubble-sort",
  name: "Bubble Sort",
  description: "Swaps neighbours.",
  categoryId: "sorting",
  complexity: { time: { best: "O(n)", average: "O(n^2)", worst: "O(n^2)" }, space: "O(1)" },
  displayCodes: [{ language: "javascript", code: "x" }],
};

describe("phase 6 contracts", () => {
  it("keeps the JSON body limit large enough for the biggest script", () => {
    expect(LIMITS.body.jsonMaxBytes).toBeGreaterThanOrEqual(LIMITS.script.maxChars * 4);
  });

  it("accepts a script at the limit and rejects one above it", () => {
    const base = { title: "t" };
    expect(CreateVisualizationRequestSchema.safeParse({ ...base, script: "x".repeat(LIMITS.script.maxChars) }).success).toBe(true);
    expect(CreateVisualizationRequestSchema.safeParse({ ...base, script: "x".repeat(LIMITS.script.maxChars + 1) }).success).toBe(false);
  });

  it("lets an update clear description, code and language", () => {
    expect(UpdateVisualizationRequestSchema.safeParse({ description: null, code: null, language: null }).success).toBe(true);
  });

  it("creates and updates algorithms with a script and no forge", () => {
    expect(CreateAlgorithmRequestSchema.safeParse({ ...algorithm, script: "[]" }).success).toBe(true);
    expect(CreateAlgorithmRequestSchema.safeParse(algorithm).success).toBe(true);
    expect(UpdateAlgorithmRequestSchema.safeParse({ script: null }).success).toBe(true);
    expect("forge" in CreateAlgorithmRequestSchema.shape).toBe(false);
  });

  it("limits catalog page size", () => {
    expect(AlgorithmListQuerySchema.safeParse({ limit: LIMITS.pagination.algorithms.maxSize + 1 }).success).toBe(false);
    expect(AlgorithmListQuerySchema.safeParse({ q: "sort", limit: 10 }).success).toBe(true);
  });

  it("requires a search term", () => {
    expect(SearchQuerySchema.safeParse({ q: "   " }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: "bfs" }).success).toBe(true);
  });

  it("documents the new endpoints", () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const k of [
      "get /api/visualizations",
      "post /api/visualizations",
      "post /api/visualizations/validate",
      "get /api/visualizations/{id}",
      "patch /api/visualizations/{id}",
      "delete /api/visualizations/{id}",
      "get /api/search",
    ]) expect(keys.has(k)).toBe(true);
  });
});
