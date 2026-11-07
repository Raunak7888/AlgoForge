import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/app-error";

vi.mock("../config/env", () => ({ env: { webAppUrl: "http://web.test", ai: { assistantTimeoutMs: 30000, assistantMaxOutputTokens: 2048 } } }));
vi.mock("../repositories/explanation-message.repository", () => ({ explanationMessageRepository: { countBySession: vi.fn(), listBySession: vi.fn() } }));
vi.mock("../repositories/explanation-session.repository", () => ({
  toMessageRow: (m: unknown) => m,
  explanationSessionRepository: {
    create: vi.fn(),
    findManyByUser: vi.fn(),
    findOwned: vi.fn(),
    listRecentMessages: vi.fn(),
    appendExchange: vi.fn(),
    rename: vi.fn(),
    delete: vi.fn(),
    share: vi.fn(),
    findPublicByShareId: vi.fn(),
  },
}));
vi.mock("../ai/context-builder", () => ({
  buildAssistantContext: vi.fn(),
  detectIntent: vi.fn(() => "explain"),
}));
vi.mock("./ai.service", () => ({ aiService: { generateText: vi.fn() } }));
vi.mock("./ai-usage.service", () => ({ aiUsageService: { record: vi.fn() } }));
vi.mock("./quota.service", () => ({ quotaService: { reserve: vi.fn() } }));
vi.mock("./lib/layered-cache", () => ({ layeredCache: { get: vi.fn(), set: vi.fn(), del: vi.fn() } }));

import { buildAssistantContext } from "../ai/context-builder";
import { explanationMessageRepository } from "../repositories/explanation-message.repository";
import { explanationSessionRepository as repo } from "../repositories/explanation-session.repository";
import { aiService } from "./ai.service";
import { aiUsageService } from "./ai-usage.service";
import { explanationSessionService as service, publicCacheKey } from "./explanation-session.service";
import { layeredCache } from "./lib/layered-cache";
import { quotaService } from "./quota.service";

const release = vi.fn();
const ctx = { language: "python", code: "x", codeTruncated: false, script: null, scriptTruncated: false, step: null, algorithm: null };
const exchange = { userMessage: { seq: 1 }, assistantMessage: { seq: 2 } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.findOwned).mockResolvedValue({ id: "s1", title: null, shareId: null, isPublic: false } as never);
  vi.mocked(explanationMessageRepository.countBySession).mockResolvedValue(0);
  vi.mocked(repo.listRecentMessages).mockResolvedValue([{ role: "user", content: "earlier" }, { role: "assistant", content: "reply" }] as never);
  vi.mocked(buildAssistantContext).mockResolvedValue(ctx as never);
  vi.mocked(quotaService.reserve).mockResolvedValue({ snapshot: {} as never, release });
  vi.mocked(aiService.generateText).mockResolvedValue("  ## Answer  ");
  vi.mocked(repo.appendExchange).mockResolvedValue(exchange as never);
});

describe("sendMessage", () => {
  it("reserves the shared 'session' quota, sends role-separated messages and stores one exchange", async () => {
    const ac = new AbortController();
    const out = await service.sendMessage("u1", "s1", { query: "  Explain my graph  ", context: { language: "python" } }, ac.signal);
    expect(quotaService.reserve).toHaveBeenCalledWith("u1", "session");
    const [messages, options] = vi.mocked(aiService.generateText).mock.calls[0];
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(messages[messages.length - 1].content).toBe("  Explain my graph  ");
    expect(options).toMatchObject({ timeoutMs: 30000, maxOutputTokens: 2048, signal: ac.signal });
    expect(aiUsageService.record).toHaveBeenCalledWith("u1", "session");
    expect(vi.mocked(repo.appendExchange).mock.calls[0][2]).toMatchObject({ answer: "## Answer", intent: "explain", title: "Explain my graph", maxMessages: 200 });
    expect(out).toBe(exchange);
    expect(release).not.toHaveBeenCalled();
  });

  it("gives the quota back and stores nothing when the provider fails", async () => {
    vi.mocked(aiService.generateText).mockRejectedValue(AppError.aiUnavailable());
    await expect(service.sendMessage("u1", "s1", { query: "explain it" })).rejects.toMatchObject({ code: "AI_PROVIDER_UNAVAILABLE" });
    expect(release).toHaveBeenCalledTimes(1);
    expect(repo.appendExchange).not.toHaveBeenCalled();
    expect(aiUsageService.record).not.toHaveBeenCalled();
  });

  it("treats an empty answer as invalid output and releases the quota", async () => {
    vi.mocked(aiService.generateText).mockResolvedValue("   ");
    await expect(service.sendMessage("u1", "s1", { query: "explain it" })).rejects.toMatchObject({ code: "AI_INVALID_OUTPUT" });
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("never calls the provider when the quota is exhausted", async () => {
    vi.mocked(quotaService.reserve).mockRejectedValue(AppError.quotaExceeded("limit", { scope: "day", limit: 1, remaining: 0, resetAt: "2026-11-07T00:00:00.000Z" }, 10));
    await expect(service.sendMessage("u1", "s1", { query: "explain it" })).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    expect(aiService.generateText).not.toHaveBeenCalled();
  });

  it("is a 409 for a full chat, before any quota or provider work", async () => {
    vi.mocked(explanationMessageRepository.countBySession).mockResolvedValue(199);
    await expect(service.sendMessage("u1", "s1", { query: "explain it" })).rejects.toMatchObject({ statusCode: 409 });
    expect(quotaService.reserve).not.toHaveBeenCalled();
  });

  it("is a 404 for a session that is not the caller's", async () => {
    vi.mocked(repo.findOwned).mockResolvedValue(null as never);
    await expect(service.sendMessage("u2", "s1", { query: "explain it" })).rejects.toMatchObject({ statusCode: 404 });
    expect(quotaService.reserve).not.toHaveBeenCalled();
  });

  it("purges the public cache of a shared chat", async () => {
    vi.mocked(repo.findOwned).mockResolvedValue({ id: "s1", title: "t", shareId: "abc123", isPublic: true } as never);
    await service.sendMessage("u1", "s1", { query: "explain it" });
    expect(layeredCache.del).toHaveBeenCalledWith(publicCacheKey("abc123"));
  });
});

describe("reads and deletes", () => {
  it("never serves private data without an owner-scoped database read", async () => {
    vi.mocked(repo.findOwned).mockResolvedValue(null as never);
    await expect(service.getSession("intruder", "s1")).rejects.toMatchObject({ statusCode: 404 });
    expect(layeredCache.get).not.toHaveBeenCalled();
  });

  it("pages messages by sequence number", async () => {
    vi.mocked(explanationMessageRepository.listBySession).mockResolvedValue([{ seq: 1 }, { seq: 2 }, { seq: 3 }] as never);
    const page = await service.listMessages("u1", "s1", { limit: 2, afterSeq: 0 });
    expect(page.items).toHaveLength(2);
    expect(page.meta).toEqual({ hasMore: true, nextCursor: "2" });
  });

  it("deleting a shared chat purges its public cache", async () => {
    vi.mocked(repo.findOwned).mockResolvedValue({ id: "s1", shareId: "abc123" } as never);
    vi.mocked(repo.delete).mockResolvedValue({ count: 1 } as never);
    await service.deleteSession("u1", "s1");
    expect(layeredCache.del).toHaveBeenCalledWith(publicCacheKey("abc123"));
  });

  it("rename is a 404 for someone else's chat", async () => {
    vi.mocked(repo.rename).mockResolvedValue({ count: 0 } as never);
    await expect(service.renameSession("u2", "s1", "x")).rejects.toMatchObject({ statusCode: 404 });
  });
});
