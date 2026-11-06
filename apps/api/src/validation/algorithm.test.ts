import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { parseAlgorithmQuery, parseCreateAlgorithm } from "./algorithm";

describe("parseAlgorithmQuery", () => {
  it("applies the default page size", () => {
    expect(parseAlgorithmQuery({}).limit).toBe(LIMITS.pagination.algorithms.defaultSize);
  });

  it("reads q, and still accepts the old search name", () => {
    expect(parseAlgorithmQuery({ q: " sort " }).search).toBe("sort");
    expect(parseAlgorithmQuery({ search: "graph" }).search).toBe("graph");
  });

  it("ignores blank values", () => {
    const q = parseAlgorithmQuery({ q: "", categoryId: "", difficulty: "" });
    expect(q.search).toBeUndefined();
    expect(q.categoryId).toBeUndefined();
  });

  it("rejects an unknown difficulty, a huge page and a bad cursor with a 400", () => {
    for (const bad of [{ difficulty: "easy" }, { limit: "9999" }, { cursor: "nope" }]) {
      expect(() => parseAlgorithmQuery(bad)).toThrow(AppError);
    }
  });

  it("parses isPublished as a boolean", () => {
    expect(parseAlgorithmQuery({ isPublished: "false" }).isPublished).toBe(false);
  });
});

describe("parseCreateAlgorithm", () => {
  it("accepts a script and no forge", () => {
    const out = parseCreateAlgorithm({
      slug: "x",
      name: "X",
      description: "d",
      categoryId: "c",
      complexity: { time: { best: "a", average: "b", worst: "c" }, space: "d" },
      displayCodes: [{ language: "javascript", code: "1" }],
      script: "[]",
    });
    expect(out.script).toBe("[]");
  });
});
