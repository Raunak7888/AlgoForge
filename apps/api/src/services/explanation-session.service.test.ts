import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  id: string;
  userId: string;
  title: string | null;
  shareId: string | null;
  isPublic: boolean;
  messages: unknown[];
}

const h = vi.hoisted(() => ({
  cache: new Map<string, string>(),
  rows: new Map<string, Row>(),
}));

vi.mock("./lib/layered-cache", () => ({
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

vi.mock("../repositories/explanation-session.repository", () => ({
  explanationSessionRepository: {
    findOneByUser: async (id: string, userId: string) => {
      const r = h.rows.get(id);
      return r && r.userId === userId ? r : null;
    },
    delete: async (id: string, userId: string) => {
      const r = h.rows.get(id);
      if (r && r.userId === userId) {
        h.rows.delete(id);
        return { count: 1 };
      }
      return { count: 0 };
    },
  },
}));

vi.mock("../ai/query-processor", () => ({ processQuery: vi.fn() }));
vi.mock("../ai/context-builder", () => ({
  buildCodebaseContext: vi.fn(),
  serializeContext: vi.fn(),
}));
vi.mock("../prompts/explanation.prompt", () => ({ buildExplanationPrompt: vi.fn() }));
vi.mock("./ai.service", () => ({ aiService: { generateText: vi.fn() } }));
vi.mock("../config/env", () => ({ env: { webAppUrl: "http://localhost:3000" } }));

import { explanationSessionService } from "./explanation-session.service";

beforeEach(() => {
  h.cache.clear();
  h.rows.clear();
  h.rows.set("s1", {
    id: "s1",
    userId: "alice",
    title: "t",
    shareId: "share1",
    isPublic: true,
    messages: [],
  });
});

describe("S-01: explanation session ownership", () => {
  it("does not serve another user's cached private session", async () => {
    await expect(explanationSessionService.getSession("alice", "s1")).resolves.toMatchObject({ id: "s1" });
    expect(h.cache.size).toBe(1);

    await expect(explanationSessionService.getSession("bob", "s1")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a cache entry whose owner differs from the caller", async () => {
    h.cache.set(
      "explain:session:bob:s1",
      JSON.stringify({ id: "s1", userId: "alice", title: "t", shareId: null, isPublic: false, messages: [] }),
    );
    await expect(explanationSessionService.getSession("bob", "s1")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("S-09: public cache purge", () => {
  it("purges the public cache entry when the owner deletes the session", async () => {
    h.cache.set("explain:public:share1", JSON.stringify({ id: "s1" }));
    await explanationSessionService.deleteSession("alice", "s1");
    expect(h.cache.has("explain:public:share1")).toBe(false);
  });

  it("does not let another user delete (or purge) someone else's session", async () => {
    h.cache.set("explain:public:share1", JSON.stringify({ id: "s1" }));
    await expect(explanationSessionService.deleteSession("bob", "s1")).rejects.toMatchObject({ statusCode: 404 });
    expect(h.cache.has("explain:public:share1")).toBe(true);
    expect(h.rows.has("s1")).toBe(true);
  });
});
