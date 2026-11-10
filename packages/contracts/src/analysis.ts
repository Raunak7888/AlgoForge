import { z } from "zod";
import {
  AnalysisHistoryItemSchema,
  AnalysisHistoryMetaSchema,
  AnalysisHistoryResponseSchema,
  AnalysisLanguageSchema,
  AnalysisResultSchema,
  BottleneckSchema,
  BreakdownSchema,
  ComparisonSchema,
  ComplexitySchema,
  ImprovementSchema,
} from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema } from "./common";
import { QuotaWindowSchema } from "./errors";
import { checkRunnableCode, LIMITS } from "./limits";
import { SafeUserSchema } from "./users";

export {
  AnalysisHistoryItemSchema,
  AnalysisHistoryMetaSchema,
  AnalysisHistoryResponseSchema,
  AnalysisLanguageSchema,
  AnalysisResultSchema,
  BottleneckSchema,
  BreakdownSchema,
  ComparisonSchema,
  ComplexitySchema,
  ImprovementSchema,
};
export type { AnalysisHistoryItem, AnalysisHistoryResponse, AnalysisLanguage, AnalysisResult } from "@algoforge/analysis";

export type ComplexityResult = z.infer<typeof ComplexitySchema>;
export type Breakdown = z.infer<typeof BreakdownSchema>;
export type Bottleneck = z.infer<typeof BottleneckSchema>;
export type Improvement = z.infer<typeof ImprovementSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;

export const CreateAnalysisRequestSchema = z.object({
  code: z.string().trim().min(1, "Code must be a non-empty string.").max(LIMITS.code.maxChars, "Code payload is too large.").superRefine((code, ctx) => {
    if (code.length > LIMITS.code.maxChars) return; // already reported by max()
    const check = checkRunnableCode(code);
    if (!check.ok) ctx.addIssue({ code: "custom", message: check.message });
  }),
  language: AnalysisLanguageSchema,
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

/** "ok": result parsed with the current schema. "unreadable": stored result is invalid or from a newer schema. */
export const ResultStatusSchema = z.enum(["ok", "unreadable"]);
export type ResultStatus = z.infer<typeof ResultStatusSchema>;

export const AnalysisRecordResponseSchema = z.object({
  id: z.string().min(1),
  language: AnalysisLanguageSchema,
  code: z.string(),
  title: z.string().nullable(),
  result: AnalysisResultSchema.nullable(),
  resultStatus: ResultStatusSchema,
  isShared: z.boolean(),
  createdAt: IsoDateTimeSchema,
});
export type AnalysisRecordResponse = z.infer<typeof AnalysisRecordResponseSchema>;

export const SharedAnalysisResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  language: AnalysisLanguageSchema,
  result: AnalysisResultSchema.nullable(),
  resultStatus: ResultStatusSchema,
  createdAt: IsoDateTimeSchema,
  creator: SafeUserSchema.optional(),
});
export type SharedAnalysisResponse = z.infer<typeof SharedAnalysisResponseSchema>;

export const AnalysisSortSchema = z.enum(["newest", "oldest"]);
export type AnalysisSort = z.infer<typeof AnalysisSortSchema>;

export const AnalysisHistoryQuerySchema = pageQuerySchema(LIMITS.pagination.analysisHistory).extend({
  q: z.string().max(LIMITS.search.maxQueryChars).optional().describe("Search title, suggestion and complexity."),
  language: AnalysisLanguageSchema.optional(),
  sort: AnalysisSortSchema.optional().describe("Default newest."),
});
export type AnalysisHistoryQuery = z.input<typeof AnalysisHistoryQuerySchema>;

/** Remaining analysis quota for the signed-in user. */
export const AnalysisQuotaResponseSchema = z.object({ minute: QuotaWindowSchema, day: QuotaWindowSchema });
export type AnalysisQuotaResponse = z.infer<typeof AnalysisQuotaResponseSchema>;

export const ShareUrlResponseSchema = z.object({ shareUrl: z.url() });
export type ShareUrlResponse = z.infer<typeof ShareUrlResponseSchema>;

/** A language plus a result: what the report screen renders. */
export const AnalysisReportSchema = z.object({ language: AnalysisLanguageSchema, result: AnalysisResultSchema });
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
