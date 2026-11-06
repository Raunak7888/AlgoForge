import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/app-error";

vi.mock("../config/env", () => ({ env: { webAppUrl: "http://web.test" } }));
vi.mock("../repositories/analysis.repository", () => ({
  hashCode: (s: string) => `hash:${s}`,
  analysisRepository: {
    create: vi.fn(),
    findManyByUser: vi.fn(),
    findOneByUser: vi.fn(),
    deleteByUser: vi.fn(),
    findForShare: vi.fn(),
    setPublic: vi.fn(),
    findPublicByShareId: vi.fn(),
  },
}));
vi.mock("./ai.service", () => ({ aiService: { analyzeCode: vi.fn() } }));
vi.mock("./quota.service", () => ({ quotaService: { reserve: vi.fn(), peek: vi.fn() } }));
vi.mock("./ai-usage.service", () => ({ aiUsageService: { record: vi.fn() } }));
vi.mock("./lib/layered-cache", () => ({ layeredCache: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { ANALYSIS_PROMPT_VERSION } from "../prompts/analysis.prompt";
import { analysisRepository } from "../repositories/analysis.repository";
import { aiService } from "./ai.service";
import { aiUsageService } from "./ai-usage.service";
import { analysisService } from "./analysis.service";
import { layeredCache } from "./lib/layered-cache";
import { quotaService } from "./quota.service";

const result = {
  summary: "Linear search over an array. It checks every item.",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "scan", steps: ["a"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [{ suggestion: "Use a hash set", expectedImpact: "O(1)" }],
  optimizedCode: "x",
  edgeCases: [],
};
const input = { code: "let a = 1", language: "javascript" as const };
const release = vi.fn();

describe("analysisService.createAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(analysisRepository.create).mockResolvedValue({ id: "a1" } as never);
    vi.mocked(quotaService.reserve).mockResolvedValue({ snapshot: {} as never, release });
  });

  it("serves a cache hit without calling the provider or using quota", async () => {
    vi.mocked(layeredCache.get).mockResolvedValue({ result, model: "m-cached" } as never);
    await analysisService.createAnalysis("u1", input);
    expect(aiService.analyzeCode).not.toHaveBeenCalled();
    expect(quotaService.reserve).not.toHaveBeenCalled();
    expect(analysisRepository.create).toHaveBeenCalledWith(expect.objectContaining({ model: "m-cached", promptVersion: ANALYSIS_PROMPT_VERSION }));
  });

  it("on a miss: reserves quota, calls the provider, caches under a versioned key and records usage", async () => {
    vi.mocked(layeredCache.get).mockResolvedValue(null);
    vi.mocked(aiService.analyzeCode).mockResolvedValue({ result, model: "m1", promptVersion: ANALYSIS_PROMPT_VERSION } as never);
    await analysisService.createAnalysis("u1", input);

    expect(quotaService.reserve).toHaveBeenCalledWith("u1", "analysis");
    const key = vi.mocked(layeredCache.set).mock.calls[0][0];
    expect(key).toContain(ANALYSIS_PROMPT_VERSION);
    expect(key).toContain("javascript");
    expect(aiUsageService.record).toHaveBeenCalledWith("u1", "analysis");
    expect(analysisRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Linear search over an array", complexity: "O(n)", suggestion: "Use a hash set", model: "m1", schemaVersion: 1 }),
    );
    expect(release).not.toHaveBeenCalled();
  });

  it("returns the quota and stores nothing when the provider fails", async () => {
    vi.mocked(layeredCache.get).mockResolvedValue(null);
    vi.mocked(aiService.analyzeCode).mockRejectedValue(AppError.aiUnavailable());
    await expect(analysisService.createAnalysis("u1", input)).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(release).toHaveBeenCalledTimes(1);
    expect(layeredCache.set).not.toHaveBeenCalled();
    expect(analysisRepository.create).not.toHaveBeenCalled();
  });

  it("does not call the provider when the quota is exhausted", async () => {
    vi.mocked(layeredCache.get).mockResolvedValue(null);
    vi.mocked(quotaService.reserve).mockRejectedValue(AppError.quotaExceeded("limit", { scope: "day", limit: 1, remaining: 0, resetAt: "2026-11-07T00:00:00.000Z" }, 10));
    await expect(analysisService.createAnalysis("u1", input)).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(aiService.analyzeCode).not.toHaveBeenCalled();
  });
});

describe("analysisService.deleteAnalysis", () => {
  it("is 404 when the analysis is not the caller's", async () => {
    vi.mocked(analysisRepository.deleteByUser).mockResolvedValue(0);
    await expect(analysisService.deleteAnalysis("u1", "x")).rejects.toMatchObject({ statusCode: 404 });
    expect(analysisRepository.deleteByUser).toHaveBeenCalledWith("x", "u1");
  });
  it("resolves when a row was removed", async () => {
    vi.mocked(analysisRepository.deleteByUser).mockResolvedValue(1);
    await expect(analysisService.deleteAnalysis("u1", "x")).resolves.toBeUndefined();
  });
});
