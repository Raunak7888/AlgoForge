import { describe, expect, it } from "vitest";
import { LIMITS as CONTRACT } from "@algoforge/contracts/src/limits";
import { analyzeScript, CATALOG_SCRIPTS, CATALOG_SLUGS, COMPILER_LIMITS, MAX_SCRIPT_CHARS } from "./index";

const good = JSON.stringify([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [3, 1, 2] },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("analyzeScript", () => {
  it("accepts a valid script and reports its shape", () => {
    const a = analyzeScript(good);
    expect(a.ok).toBe(true);
    expect(a.stepCount).toBe(2);
    expect(a.structures).toEqual([{ id: "A", ds: "array", label: "Array" }]);
  });

  it("reports errors with a position and a suggestion", () => {
    const a = analyzeScript(JSON.stringify([{ step: 1, id: "A", ds: "array", op: "apend", value: 1 }]));
    expect(a.ok).toBe(false);
    const err = a.diagnostics.find((d) => d.severity === "error");
    expect(err?.line).toBeGreaterThan(0);
    expect(err?.message).toContain("append");
  });

  it("treats a rejected operation as a warning, not an error", () => {
    const a = analyzeScript(
      JSON.stringify([
        { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] },
        { step: 2, id: "A", op: "swap", indexA: 0, indexB: 9 },
      ]),
    );
    expect(a.ok).toBe(true);
    expect(a.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("rejects invalid JSON and an empty script", () => {
    expect(analyzeScript("{ nope").ok).toBe(false);
    expect(analyzeScript("[]").ok).toBe(false);
  });

  it("uses the size limit from the contracts package", () => {
    expect(COMPILER_LIMITS.chars).toBe(CONTRACT.script.maxChars);
    expect(MAX_SCRIPT_CHARS).toBe(CONTRACT.script.maxChars);
    expect(analyzeScript(" ".repeat(MAX_SCRIPT_CHARS + 1)).ok).toBe(false);
  });
});

describe("catalog scripts", () => {
  it("covers the six seeded algorithms", () => {
    expect([...CATALOG_SLUGS].sort()).toEqual(
      ["binary-search", "breadth-first-search", "bubble-sort", "depth-first-search", "linear-search", "merge-sort"],
    );
  });
  for (const slug of CATALOG_SLUGS) {
    it(`${slug} compiles with no errors or warnings`, () => {
      const a = analyzeScript(CATALOG_SCRIPTS[slug]);
      expect(a.diagnostics).toEqual([]);
      expect(a.ok).toBe(true);
      expect(a.stepCount).toBeGreaterThan(0);
    });
  }
});
