import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminUserSchema,
  AnalysisHistoryResponseSchema,
  AnalysisRecordResponseSchema,
  ExplainSessionDetailSchema,
  ExplainSessionListResponseSchema,
  SharedAnalysisResponseSchema,
  SharedExplainSessionResponseSchema,
  wrapStoredAnalysisResult,
  type AnalysisResult,
} from "@algoforge/contracts";
import { serializeAdminUser } from "../serializers/admin";
import { serializeAnalysisRecord, serializeHistoryItem, serializeSharedAnalysis } from "../serializers/analysis";
import { toIso } from "../serializers/dates";
import { serializeSessionDetail, serializeSessionSummary, serializeSharedSession } from "../serializers/explain";
import { paginate } from "../utils/pagination";
import { decodeAnalysisCursor, encodeAnalysisCursor } from "../validation/analysis";

const RESULT: AnalysisResult = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "code",
  edgeCases: [],
};
const D = new Date("2026-05-04T10:15:30.000Z");

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("dates", () => {
  it("serializes Date objects and cached strings to ISO UTC", () => {
    expect(toIso(D)).toBe("2026-05-04T10:15:30.000Z");
    expect(toIso("2026-05-04T10:15:30Z")).toBe("2026-05-04T10:15:30.000Z");
    expect(() => toIso("nope")).toThrow(RangeError);
  });
});

describe("analysis responses match the contracts", () => {
  it("serializes a versioned, a legacy and an unreadable stored result", () => {
    const rows = [
      { id: "a1", language: "python", result: wrapStoredAnalysisResult(RESULT), createdAt: D },
      { id: "a2", language: "javascript", result: RESULT, createdAt: D },
      { id: "a3", language: "python", result: { schemaVersion: 99, data: RESULT }, createdAt: D },
      { id: "a4", language: "python", result: { garbage: true }, createdAt: D },
    ];
    const out = rows.map((r) => AnalysisRecordResponseSchema.parse(serializeAnalysisRecord(r)));
    expect(out.map((o) => o.resultStatus)).toEqual(["ok", "ok", "unreadable", "unreadable"]);
    expect(out[2]?.result).toBeNull();
  });

  it("builds a paginated history page that validates", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      id: `id${i}`,
      language: "python",
      complexity: "O(n)",
      suggestion: null,
      createdAt: new Date(D.getTime() - i * 1000),
    }));
    const { items, meta } = paginate(rows, 3, (r) => encodeAnalysisCursor({ createdAt: r.createdAt.toISOString(), id: r.id }));
    const body = AnalysisHistoryResponseSchema.parse({ data: items.flatMap((r) => serializeHistoryItem(r) ?? []), meta });
    expect(body.data).toHaveLength(3);
    expect(meta.hasMore).toBe(true);
    expect(decodeAnalysisCursor(meta.nextCursor ?? "").id).toBe("id2");
  });

  it("skips a history row it cannot represent", () => {
    expect(serializeHistoryItem({ id: "x", language: "cobol", complexity: null, suggestion: null, createdAt: D })).toBeNull();
  });

  it("serializes a shared analysis with an optional creator", () => {
    const base = { id: "a1", language: "python", code: "x", result: wrapStoredAnalysisResult(RESULT), createdAt: D };
    const withUser = SharedAnalysisResponseSchema.parse(serializeSharedAnalysis({ ...base, user: { id: "u1", name: "N", username: null, image: null } }));
    expect(withUser.creator?.username).toBe("N");
    expect(SharedAnalysisResponseSchema.parse(serializeSharedAnalysis({ ...base, user: null })).creator).toBeUndefined();
  });
});

describe("explain responses match the contracts", () => {
  const row = {
    id: "s1",
    userId: "private-user-id",
    title: null,
    shareId: null,
    isPublic: false,
    createdAt: D,
    updatedAt: D,
    messages: [
      { id: "m1", role: "user", content: "hello there", createdAt: "2026-05-04T10:15:30.000Z" },
      { id: "m2", role: "robot", content: "malformed" },
    ],
  };

  it("drops malformed messages and never leaks userId", () => {
    const detail = ExplainSessionDetailSchema.parse(serializeSessionDetail(row));
    expect(detail.messages).toHaveLength(1);
    expect(JSON.stringify(detail)).not.toContain("private-user-id");
  });

  it("builds a paginated session list", () => {
    const { items, meta } = paginate([row, { ...row, id: "s2" }, { ...row, id: "s3" }], 2, (r) => r.id);
    const body = ExplainSessionListResponseSchema.parse({ data: items.map(serializeSessionSummary), meta });
    expect(body.meta).toEqual({ hasMore: true, nextCursor: "s2" });
  });

  it("serializes a public session", () => {
    const shared = SharedExplainSessionResponseSchema.parse(serializeSharedSession({ ...row, user: { id: "u1", name: "N", username: "n", image: null } }));
    expect(shared.creator?.username).toBe("n");
  });
});

describe("admin responses match the contracts", () => {
  it("serializes users with ISO dates", () => {
    expect(AdminUserSchema.parse(serializeAdminUser({ id: "u", email: null, name: null, role: "ADMIN", createdAt: D })).createdAt).toBe(D.toISOString());
  });
});

describe("paginate", () => {
  it("reports no next page when rows fit", () => {
    expect(paginate([1, 2], 3, String)).toEqual({ items: [1, 2], meta: { hasMore: false, nextCursor: null } });
    expect(paginate([], 3, String).meta).toEqual({ hasMore: false, nextCursor: null });
  });
  it("does not claim another page when the page is exactly full", () => {
    expect(paginate([1, 2, 3], 3, String).meta.hasMore).toBe(false);
  });
});
