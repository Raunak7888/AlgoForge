import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { recallAlgorithm, rememberAlgorithm } from "./algorithmContext";
import { assembleContext, type ContextSources } from "./context-core";
import { structuresIn, suggestionsFor } from "./suggestions";

const base: ContextSources = { language: "javascript", code: "", script: null, step: null, algorithmSlug: null };

describe("assembleContext", () => {
  it("sends only what exists", () => {
    expect(assembleContext(base)).toEqual({ language: "javascript" });
  });

  it("includes code, script, step with narration and a valid slug", () => {
    const ctx = assembleContext({
      language: "python",
      code: "print(1)",
      script: "[]",
      step: { position: 2, total: 4, call: "A.swap(0, 1)", messages: ["swap", "them"] },
      algorithmSlug: "bubble-sort",
    });
    expect(ctx).toEqual({ language: "python", code: "print(1)", script: "[]", step: { position: 2, total: 4, call: "A.swap(0, 1)", narration: "swap\nthem" }, algorithmSlug: "bubble-sort" });
  });

  it("clamps to the shared limits and drops an invalid slug or step", () => {
    const ctx = assembleContext({ ...base, code: "x".repeat(LIMITS.code.maxChars + 5), script: "y".repeat(LIMITS.script.maxChars + 5), algorithmSlug: "Bad Slug!", step: { position: 5, total: 3, call: null, messages: [] } });
    expect(ctx.code).toHaveLength(LIMITS.code.maxChars);
    expect(ctx.script).toHaveLength(LIMITS.script.maxChars);
    expect(ctx.algorithmSlug).toBeUndefined();
    expect(ctx.step).toBeUndefined();
  });
});

describe("suggestionsFor", () => {
  it("always offers one to three chips", () => {
    const s = suggestionsFor(base);
    expect(s.length).toBeGreaterThanOrEqual(1);
    expect(s.length).toBeLessThanOrEqual(3);
  });

  it("follows the step, the structure and the code on screen", () => {
    const script = '[{ "step": 1, "id": "G", "ds": "graph", "op": "addVertex", "value": "A" }]';
    const s = suggestionsFor({ ...base, code: "let a", script, step: { position: 1, total: 1, call: null, messages: [] } });
    expect(s[0]).toBe("Explain this step");
    expect(s).toContain("Explain my graph");
  });

  it("mentions the catalog algorithm when one is open", () => {
    expect(suggestionsFor({ ...base, algorithmSlug: "binary-search" })).toContain("Walk me through binary search");
  });

  it("finds structures with a regex so a broken script still works", () => {
    expect(structuresIn('{"ds":"bst"} oops {"dsname": "Array"')).toEqual(["bst", "array"]);
    expect(structuresIn(null)).toEqual([]);
  });
});

describe("algorithm hand-off", () => {
  const store = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  };

  it("recalls the slug only while the script is unchanged", () => {
    const s = store();
    rememberAlgorithm("bubble-sort", "[1]", s);
    expect(recallAlgorithm("[1]", s)).toBe("bubble-sort");
    expect(recallAlgorithm("[1, 2]", s)).toBeNull();
    expect(recallAlgorithm(null, s)).toBeNull();
  });
});
