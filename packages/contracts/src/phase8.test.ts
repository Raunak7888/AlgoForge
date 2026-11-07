import { describe, expect, it } from "vitest";
import {
  ExplainContextSchema,
  ExplainMessageListQuerySchema,
  LIMITS,
  SendMessageRequestSchema,
  SessionMessageSchema,
  UpdateExplainSessionRequestSchema,
  routes,
} from "./index";

describe("phase 8 contracts", () => {
  it("accepts a full workspace context and rejects oversized or malformed parts", () => {
    const ok = ExplainContextSchema.safeParse({
      language: "python",
      code: "print(1)",
      script: "[]",
      step: { position: 2, total: 5, call: "A.swap(0, 1)", narration: "swap" },
      algorithmSlug: "bubble-sort",
    });
    expect(ok.success).toBe(true);
    expect(ExplainContextSchema.safeParse({ code: "x".repeat(LIMITS.code.maxChars + 1) }).success).toBe(false);
    expect(ExplainContextSchema.safeParse({ algorithmSlug: "Not A Slug" }).success).toBe(false);
    expect(ExplainContextSchema.safeParse({ step: { position: 0, total: 3 } }).success).toBe(false);
    expect(ExplainContextSchema.safeParse({ language: "cobol" }).success).toBe(false);
  });

  it("keeps context optional on a message", () => {
    expect(SendMessageRequestSchema.safeParse({ query: "explain this" }).success).toBe(true);
    expect(SendMessageRequestSchema.safeParse({ query: "hi" }).success).toBe(false);
  });

  it("requires a sequence number on stored messages", () => {
    const base = { id: "m", role: "user", content: "x", createdAt: "2026-11-06T00:00:00.000Z" };
    expect(SessionMessageSchema.safeParse({ ...base, seq: 1 }).success).toBe(true);
    expect(SessionMessageSchema.safeParse(base).success).toBe(false);
  });

  it("validates rename and message paging", () => {
    expect(UpdateExplainSessionRequestSchema.safeParse({ title: "  Heaps  " }).data?.title).toBe("Heaps");
    expect(UpdateExplainSessionRequestSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(ExplainMessageListQuerySchema.safeParse({ limit: 100 }).success).toBe(true);
    expect(ExplainMessageListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("documents rename and messages, and no longer documents the one-shot endpoint", () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    expect(keys.has("patch /api/explain-sessions/{id}")).toBe(true);
    expect(keys.has("get /api/explain-sessions/{id}/messages")).toBe(true);
    expect(keys.has("post /api/explain")).toBe(false);
  });
});
