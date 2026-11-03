import { describe, expect, it } from "vitest";
import { CreateAnalysisInputSchema } from "@algoforge/analysis";
import {
  ANALYSIS_RESULT_SCHEMA_VERSION,
  CreateAnalysisRequestSchema,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ErrorResponseSchema,
  IsoDateTimeSchema,
  JSON_BODY_LIMIT_BYTES,
  LIMITS,
  PublicShareResponseSchema,
  SendMessageRequestSchema,
  paginatedResponse,
  parseStoredAnalysisResult,
  wrapStoredAnalysisResult,
  AnalysisResultSchema,
} from "./index";
import { z } from "zod";

const RESULT = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "code",
  edgeCases: [],
};

describe("limits", () => {
  it("keeps the body limit large enough for an escaped script", () => {
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThanOrEqual(LIMITS.script.maxChars * 4);
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThan(LIMITS.code.maxChars * 4);
  });
  it("has sane pagination and message bounds", () => {
    for (const p of Object.values(LIMITS.pagination)) expect(p.defaultSize).toBeLessThanOrEqual(p.maxSize);
    expect(LIMITS.message.minChars).toBeLessThan(LIMITS.message.maxChars);
  });
});

describe("errors", () => {
  it("maps every code to a status and validates the envelope", () => {
    for (const code of ERROR_CODES) expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    expect(ErrorResponseSchema.safeParse({ error: { code: "NOT_FOUND", message: "x" } }).success).toBe(true);
    expect(ErrorResponseSchema.safeParse({ error: { code: "NOPE", message: "x" } }).success).toBe(false);
    expect(ErrorResponseSchema.safeParse({ error: "Route not found." }).success).toBe(false);
  });
});

describe("shared schemas", () => {
  it("accepts only ISO 8601 UTC dates", () => {
    expect(IsoDateTimeSchema.safeParse("2026-05-04T10:15:30.000Z").success).toBe(true);
    expect(IsoDateTimeSchema.safeParse("2026-05-04").success).toBe(false);
    expect(IsoDateTimeSchema.safeParse("yesterday").success).toBe(false);
  });
  it("validates paginated envelopes", () => {
    const schema = paginatedResponse(z.object({ id: z.string() }));
    expect(schema.safeParse({ data: [{ id: "a" }], meta: { nextCursor: null, hasMore: false } }).success).toBe(true);
    expect(schema.safeParse({ data: [{ id: "a" }] }).success).toBe(false);
    expect(schema.safeParse({ data: [], meta: { nextCursor: "c", hasMore: "yes" } }).success).toBe(false);
  });
  it("uses the shared code limit and agrees with the analysis package", () => {
    const max = "a".repeat(LIMITS.code.maxChars);
    const over = "a".repeat(LIMITS.code.maxChars + 1);
    for (const schema of [CreateAnalysisRequestSchema, CreateAnalysisInputSchema]) {
      expect(schema.safeParse({ code: max, language: "python" }).success).toBe(true);
      expect(schema.safeParse({ code: over, language: "python" }).success).toBe(false);
    }
  });
  it("enforces message bounds", () => {
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.minChars - 1) }).success).toBe(false);
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.maxChars) }).success).toBe(true);
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.maxChars + 1) }).success).toBe(false);
  });
  it("discriminates public shares by type", () => {
    const base = { createdAt: "2026-05-04T10:15:30.000Z" };
    const ok = PublicShareResponseSchema.safeParse({ ...base, type: "analysis", data: { id: "a", code: "x", language: "python", result: null, resultStatus: "unreadable", createdAt: base.createdAt } });
    expect(ok.success).toBe(true);
    expect(PublicShareResponseSchema.safeParse({ ...base, type: "other", data: {} }).success).toBe(false);
  });
});

describe("stored analysis results (schema versioning)", () => {
  it("reads current, legacy, newer and invalid results without throwing", () => {
    expect(AnalysisResultSchema.safeParse(RESULT).success).toBe(true);
    const current = parseStoredAnalysisResult(wrapStoredAnalysisResult(RESULT));
    expect(current).toMatchObject({ status: "ok", version: ANALYSIS_RESULT_SCHEMA_VERSION });
    expect(parseStoredAnalysisResult(RESULT)).toMatchObject({ status: "ok", version: 0 });
    expect(parseStoredAnalysisResult({ schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION + 1, data: RESULT })).toMatchObject({ status: "unreadable", reason: "unsupported_version" });
    expect(parseStoredAnalysisResult({ schemaVersion: 1, data: { nope: true } })).toMatchObject({ status: "unreadable", reason: "invalid" });
    for (const junk of [null, undefined, 42, "x", [], {}]) expect(parseStoredAnalysisResult(junk).status).toBe("unreadable");
  });
});
