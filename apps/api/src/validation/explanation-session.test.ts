import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { encodeSessionCursor, parseListMessagesQuery, parseListSessionsQuery, parseRenameSession, parseSendMessage } from "./explanation-session";

describe("explanation-session validation", () => {
  it("applies default and maximum page sizes", () => {
    expect(parseListSessionsQuery({}).limit).toBe(LIMITS.pagination.explainSessions.defaultSize);
    expect(parseListMessagesQuery({}).limit).toBe(LIMITS.pagination.explainMessages.defaultSize);
    expect(() => parseListSessionsQuery({ limit: "1000" })).toThrow(AppError);
    expect(() => parseListMessagesQuery({ limit: "101" })).toThrow(AppError);
  });

  it("round-trips a session cursor and rejects a forged one", () => {
    const cursor = encodeSessionCursor({ updatedAt: "2026-11-06T10:00:00.000Z", id: "s1" });
    const q = parseListSessionsQuery({ cursor });
    expect(q.cursorId).toBe("s1");
    expect(q.cursorUpdatedAt?.toISOString()).toBe("2026-11-06T10:00:00.000Z");
    expect(() => parseListSessionsQuery({ cursor: "nope" })).toThrow(AppError);
    expect(parseListSessionsQuery({ cursor: "" }).cursorId).toBeUndefined();
  });

  it("reads message cursors as sequence numbers", () => {
    expect(parseListMessagesQuery({ cursor: "12" }).afterSeq).toBe(12);
    expect(() => parseListMessagesQuery({ cursor: "abc" })).toThrow(AppError);
  });

  it("trims titles, rejects blank ones and validates the context", () => {
    expect(parseRenameSession({ title: "  Heaps " }).title).toBe("Heaps");
    expect(() => parseRenameSession({ title: " " })).toThrow(AppError);
    expect(parseSendMessage({ query: "explain this", context: { language: "python", code: "x" } }).context?.language).toBe("python");
    expect(() => parseSendMessage({ query: "explain this", context: { language: "cobol" } })).toThrow(AppError);
  });
});
