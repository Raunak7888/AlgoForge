import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { encodeAnalysisCursor, parseAnalysisHistoryQuery } from "./analysis";

describe("parseAnalysisHistoryQuery", () => {
  it("applies defaults", () => {
    const q = parseAnalysisHistoryQuery({});
    expect(q.limit).toBe(LIMITS.pagination.analysisHistory.defaultSize);
    expect(q.sort).toBe("newest");
    expect(q.q).toBeUndefined();
  });

  it("reads search, language and sort, and ignores blanks", () => {
    const q = parseAnalysisHistoryQuery({ q: "  sort ", language: "python", sort: "oldest" });
    expect(q).toMatchObject({ q: "sort", language: "python", sort: "oldest" });
    expect(parseAnalysisHistoryQuery({ q: "", language: "", sort: "" }).language).toBeUndefined();
  });

  it("rejects bad filters, page sizes and cursors with a 400", () => {
    for (const bad of [{ sort: "random" }, { language: "cobol" }, { limit: "9999" }, { cursor: "nope" }, { q: ["a", "b"] }]) {
      expect(() => parseAnalysisHistoryQuery(bad)).toThrow(AppError);
    }
  });

  it("decodes a cursor and refuses one made for another sort order", () => {
    const cursor = encodeAnalysisCursor({ createdAt: "2026-01-01T00:00:00.000Z", id: "abc", sort: "newest" });
    const q = parseAnalysisHistoryQuery({ cursor });
    expect(q.cursorId).toBe("abc");
    expect(q.cursorCreatedAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(() => parseAnalysisHistoryQuery({ cursor, sort: "oldest" })).toThrow(AppError);
  });
});
