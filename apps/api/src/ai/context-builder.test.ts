import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@algoforge/contracts";

vi.mock("../repositories/algorithm.repository", () => ({ algorithmRepository: { findBySlug: vi.fn() } }));

import { algorithmRepository } from "../repositories/algorithm.repository";
import { buildAssistantContext, detectIntent } from "./context-builder";

const row = (over: Record<string, unknown> = {}) => ({
  slug: "bubble-sort",
  name: "Bubble Sort",
  description: "Swaps neighbours.",
  difficulty: "beginner",
  isPublished: true,
  category: { label: "Sorting" },
  timeBest: "O(n)",
  timeAverage: "O(n^2)",
  timeWorst: "O(n^2)",
  spaceComplexity: "O(1)",
  displayCodes: [{ language: "javascript", code: "js" }, { language: "python", code: "py" }],
  ...over,
});

beforeEach(() => vi.mocked(algorithmRepository.findBySlug).mockReset());

describe("buildAssistantContext", () => {
  it("is empty without input and never reads the catalog", async () => {
    const ctx = await buildAssistantContext(undefined);
    expect(ctx).toMatchObject({ language: null, code: null, script: null, step: null, algorithm: null });
    expect(algorithmRepository.findBySlug).not.toHaveBeenCalled();
  });

  it("keeps code, language, script, step and narration", async () => {
    const ctx = await buildAssistantContext({
      language: "python",
      code: "print(1)",
      script: "[]",
      step: { position: 2, total: 5, call: " A.swap(0, 1) ", narration: "5 > 3" },
    });
    expect(ctx.language).toBe("python");
    expect(ctx.code).toBe("print(1)");
    expect(ctx.script).toBe("[]");
    expect(ctx.step).toEqual({ position: 2, total: 5, call: "A.swap(0, 1)", narration: "5 > 3" });
  });

  it("truncates a large script to the assistant limit and says so", async () => {
    const ctx = await buildAssistantContext({ script: "x".repeat(LIMITS.assistant.scriptContextChars + 10) });
    expect(ctx.script).toHaveLength(LIMITS.assistant.scriptContextChars);
    expect(ctx.scriptTruncated).toBe(true);
  });

  it("resolves a published algorithm and prefers the editor language", async () => {
    vi.mocked(algorithmRepository.findBySlug).mockResolvedValue(row() as never);
    const ctx = await buildAssistantContext({ language: "python", algorithmSlug: "bubble-sort" });
    expect(ctx.algorithm?.name).toBe("Bubble Sort");
    expect(ctx.algorithm?.code).toEqual({ language: "python", code: "py" });
    expect(ctx.algorithm?.complexity?.average).toBe("O(n^2)");
  });

  it("ignores drafts, unknown slugs and lookup failures", async () => {
    vi.mocked(algorithmRepository.findBySlug).mockResolvedValueOnce(row({ isPublished: false }) as never);
    expect((await buildAssistantContext({ algorithmSlug: "draft" })).algorithm).toBeNull();
    vi.mocked(algorithmRepository.findBySlug).mockResolvedValueOnce(null as never);
    expect((await buildAssistantContext({ algorithmSlug: "nope" })).algorithm).toBeNull();
    vi.mocked(algorithmRepository.findBySlug).mockRejectedValueOnce(new Error("db down"));
    expect((await buildAssistantContext({ algorithmSlug: "x" })).algorithm).toBeNull();
  });
});

describe("detectIntent", () => {
  it("labels common questions", () => {
    expect(detectIntent("Suggest optimizations")).toBe("optimize");
    expect(detectIntent("Generate BFS code")).toBe("generate_code");
    expect(detectIntent("Explain my graph")).toBe("explain");
    expect(detectIntent("thanks")).toBe("general");
  });
});
