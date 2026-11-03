import { z } from "zod";
import { AnalysisResultSchema, type AnalysisResult } from "@algoforge/analysis";

/**
 * AI results are stored as JSON. New rows are written as { schemaVersion, data };
 * older rows are a bare result (treated as version 0). Reading never throws:
 * a result that cannot be read is reported, and the API degrades to result: null.
 */
export const ANALYSIS_RESULT_SCHEMA_VERSION = 1;

export const StoredAnalysisResultSchema = z.object({ schemaVersion: z.number().int().min(1), data: z.unknown() });
export type StoredAnalysisResult = { schemaVersion: number; data: AnalysisResult };

export type ParsedStoredAnalysisResult =
  | { status: "ok"; version: number; result: AnalysisResult }
  | { status: "unreadable"; version: number | null; reason: "unsupported_version" | "invalid" };

export function wrapStoredAnalysisResult(result: AnalysisResult): StoredAnalysisResult {
  return { schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION, data: result };
}

export function parseStoredAnalysisResult(raw: unknown): ParsedStoredAnalysisResult {
  const wrapped = StoredAnalysisResultSchema.safeParse(raw);
  if (wrapped.success) {
    const { schemaVersion, data } = wrapped.data;
    if (schemaVersion > ANALYSIS_RESULT_SCHEMA_VERSION) return { status: "unreadable", version: schemaVersion, reason: "unsupported_version" };
    const parsed = AnalysisResultSchema.safeParse(data);
    return parsed.success ? { status: "ok", version: schemaVersion, result: parsed.data } : { status: "unreadable", version: schemaVersion, reason: "invalid" };
  }
  const legacy = AnalysisResultSchema.safeParse(raw);
  return legacy.success ? { status: "ok", version: 0, result: legacy.data } : { status: "unreadable", version: null, reason: "invalid" };
}
