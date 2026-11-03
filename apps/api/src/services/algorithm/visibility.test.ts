import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  findMany: vi.fn(),
  findById: vi.fn(),
  findBySlug: vi.fn(),
  cache: new Map<string, string>(),
}));

vi.mock("../../repositories/algorithm.repository", () => ({
  algorithmRepository: {
    findMany: h.findMany,
    findById: h.findById,
    findBySlug: h.findBySlug,
  },
}));
vi.mock("../lib/layered-cache", () => ({
  layeredCache: {
    get: async (key: string): Promise<unknown> => {
      const v = h.cache.get(key);
      return v === undefined ? null : JSON.parse(v);
    },
    set: async (key: string, value: unknown): Promise<void> => {
      h.cache.set(key, JSON.stringify(value));
    },
    del: async (key: string): Promise<void> => {
      h.cache.delete(key);
    },
  },
}));
vi.mock("../lib/cache-version", () => ({
  getCacheVersion: async (): Promise<number> => 0,
  bumpCacheVersion: async (): Promise<void> => undefined,
}));
vi.mock("@algoforge/db", () => ({
  Prisma: { QueryMode: { insensitive: "insensitive" } },
  Difficulty: {},
}));

import { listAlgorithms } from "./query.service";
import { getAlgorithmById, getAlgorithmBySlug } from "./detail.service";
import { getAlgorithmVisualization } from "./viz.service";

const draftRow = {
  id: "a1",
  slug: "draft-algo",
  name: "Draft",
  description: "not public",
  difficulty: "beginner",
  categoryId: "sorting",
  isPublished: false,
  timeBest: null,
  timeAverage: null,
  timeWorst: null,
  spaceComplexity: null,
  displayCodes: [],
  tags: [],
  forge: null,
};

const anon = { isAdmin: false };
const admin = { isAdmin: true };

beforeEach(() => {
  h.cache.clear();
  h.findMany.mockReset();
  h.findById.mockReset();
  h.findBySlug.mockReset();
  h.findMany.mockResolvedValue([]);
});

describe("S-02: drafts are not public", () => {
  it("forces isPublished=true for anonymous callers even when they ask for drafts", async () => {
    await listAlgorithms({ isPublished: false }, anon);
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ isPublished: true }));
  });

  it("filters to published when an anonymous caller sends no filter", async () => {
    await listAlgorithms({}, anon);
    expect(h.findMany).toHaveBeenCalledWith(expect.objectContaining({ isPublished: true }));
  });

  it("lets admins see drafts and respects their isPublished filter", async () => {
    await listAlgorithms({ isPublished: false }, admin);
    expect(h.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ isPublished: false }));

    await listAlgorithms({}, admin);
    const where = h.findMany.mock.calls[1]?.[0] as Record<string, unknown>;
    expect(where).not.toHaveProperty("isPublished");
  });

  it("returns 404 for an unpublished algorithm by id, slug and visualize for anonymous callers", async () => {
    h.findById.mockResolvedValue(draftRow);
    h.findBySlug.mockResolvedValue(draftRow);
    await expect(getAlgorithmById("a1", undefined, anon)).rejects.toMatchObject({ statusCode: 404 });
    await expect(getAlgorithmBySlug("draft-algo", undefined, anon)).rejects.toMatchObject({ statusCode: 404 });
    await expect(getAlgorithmVisualization("a1", anon)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("lets admins read a draft", async () => {
    h.findById.mockResolvedValue(draftRow);
    await expect(getAlgorithmById("a1", undefined, admin)).resolves.toMatchObject({ id: "a1" });
  });

  it("never serves an admin-cached draft to an anonymous caller", async () => {
    h.findById.mockResolvedValue(draftRow);
    await getAlgorithmById("a1", undefined, admin); // populates the admin-scoped cache
    await expect(getAlgorithmById("a1", undefined, anon)).rejects.toMatchObject({ statusCode: 404 });
  });
});
