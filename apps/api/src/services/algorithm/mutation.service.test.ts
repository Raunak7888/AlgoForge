import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateAlgorithm } from "@algoforge/forge";

const h = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  findCategory: vi.fn(),
  bump: vi.fn(),
}));

vi.mock("../../repositories/algorithm.repository", () => ({
  algorithmRepository: { findById: h.findById, update: h.update },
}));
vi.mock("../../repositories/category.repository", () => ({
  categoryRepository: { findByIdentifier: h.findCategory },
}));
vi.mock("../lib/layered-cache", () => ({
  layeredCache: { get: async () => null, set: async () => undefined, del: async () => undefined },
}));
vi.mock("../lib/cache-version", () => ({
  getCacheVersion: async (): Promise<number> => 0,
  bumpCacheVersion: h.bump,
}));
vi.mock("@algoforge/db", () => ({ Prisma: {}, Difficulty: {} }));

import { toUpdateData, updateAlgorithm } from "./mutation.service";

beforeEach(() => {
  h.findById.mockReset();
  h.update.mockReset();
  h.findCategory.mockReset();
  h.bump.mockReset();
});

describe("A-09: partial complexity updates", () => {
  it("writes only the complexity fields that were sent", () => {
    const input: UpdateAlgorithm = { complexity: { time: { best: "O(1)" } } };
    const data = toUpdateData(input, null);
    expect(Object.keys(data)).toEqual(["timeBest"]);
    expect(data).toEqual({ timeBest: "O(1)" });
  });

  it("writes space without touching the time columns", () => {
    const input: UpdateAlgorithm = { complexity: { space: "O(n)" } };
    expect(toUpdateData(input, null)).toEqual({ spaceComplexity: "O(n)" });
  });
});

describe("A-10: category change", () => {
  it("uses a relation connect instead of the unchecked categoryId scalar", () => {
    const data = toUpdateData({}, null, "sorting");
    expect(data).toEqual({ category: { connect: { id: "sorting" } } });
    expect("categoryId" in data).toBe(false);
  });
});

describe("A-11: cache invalidation", () => {
  it("bumps the algorithm cache version and passes a connect to the repository on update", async () => {
    h.findById.mockResolvedValue({ id: "a1", slug: "s", forge: null });
    h.findCategory.mockResolvedValue({ id: "sorting" });
    h.update.mockResolvedValue({ id: "a1" });

    await updateAlgorithm("a1", { categoryId: "sorting", complexity: { time: { best: "O(1)" } } });

    expect(h.update).toHaveBeenCalledWith("a1", {
      category: { connect: { id: "sorting" } },
      timeBest: "O(1)",
    });
    expect(h.bump).toHaveBeenCalledWith("algo");
  });
});
