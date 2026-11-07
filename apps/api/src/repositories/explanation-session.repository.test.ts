import { beforeEach, describe, expect, it, vi } from "vitest";

const { tx, prismaMock } = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    explanationMessage: { aggregate: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
    explanationSession: { updateMany: vi.fn() },
  };
  return { tx, prismaMock: { $transaction: (fn: (t: unknown) => unknown) => fn(tx) } };
});
vi.mock("@algoforge/db", () => ({ prisma: prismaMock }));

import { explanationMessageRowId } from "./explanation-message.repository";
import { explanationSessionRepository } from "./explanation-session.repository";

const at = new Date("2026-11-06T10:00:00.000Z");
const mk = (seq: number, role: "user" | "assistant") => ({ id: `m${seq}`, seq, role, content: `c${seq}`, intent: role === "assistant" ? "explain" : null, createdAt: at });
const input = { query: "How does this work?", answer: "Like so.", intent: "explain", title: "How does this work?", maxMessages: 200 };

beforeEach(() => {
  vi.clearAllMocks();
  tx.$queryRaw.mockResolvedValue([{ id: "s1", title: null }]);
  tx.explanationMessage.aggregate.mockResolvedValue({ _max: { seq: 4 } });
  tx.explanationMessage.createMany.mockResolvedValue({ count: 2 });
  tx.explanationMessage.findMany.mockResolvedValue([mk(1, "user"), mk(2, "assistant"), mk(3, "user"), mk(4, "assistant"), mk(5, "user"), mk(6, "assistant")]);
  tx.explanationSession.updateMany.mockResolvedValue({ count: 1 });
});

describe("appendExchange", () => {
  it("locks the owner's session row and appends seq n+1 and n+2 with stable ids", async () => {
    const out = await explanationSessionRepository.appendExchange("s1", "u1", input);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String(tx.$queryRaw.mock.calls[0][0].join(""))).toContain("FOR UPDATE");
    const data = tx.explanationMessage.createMany.mock.calls[0][0].data;
    expect(data.map((d: { seq: number }) => d.seq)).toEqual([5, 6]);
    expect(data[0].id).toBe(explanationMessageRowId("s1", 5));
    expect(data[1].role).toBe("assistant");
    expect(out.userMessage.seq).toBe(5);
    expect(out.assistantMessage.seq).toBe(6);
  });

  it("mirrors all messages into the legacy JSON column and names an untitled chat", async () => {
    await explanationSessionRepository.appendExchange("s1", "u1", input);
    const call = tx.explanationSession.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "s1", userId: "u1" });
    expect(call.data.messages).toHaveLength(6);
    expect(call.data.title).toBe("How does this work?");
  });

  it("keeps an existing title", async () => {
    tx.$queryRaw.mockResolvedValue([{ id: "s1", title: "Mine" }]);
    await explanationSessionRepository.appendExchange("s1", "u1", input);
    expect("title" in tx.explanationSession.updateMany.mock.calls[0][0].data).toBe(false);
  });

  it("is a 404 when the session is not the caller's", async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(explanationSessionRepository.appendExchange("s1", "intruder", input)).rejects.toMatchObject({ statusCode: 404 });
    expect(tx.explanationMessage.createMany).not.toHaveBeenCalled();
  });

  it("is a 409 once the chat is full, and writes nothing", async () => {
    tx.explanationMessage.aggregate.mockResolvedValue({ _max: { seq: 199 } });
    await expect(explanationSessionRepository.appendExchange("s1", "u1", input)).rejects.toMatchObject({ statusCode: 409 });
    expect(tx.explanationMessage.createMany).not.toHaveBeenCalled();
  });
});
