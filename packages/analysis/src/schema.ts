import { z } from "zod";

export const AnalysisLanguageSchema = z.enum(["javascript", "python"]);

export const ComplexitySchema = z.object({
  time: z.object({
    best: z.string().min(1),
    average: z.string().min(1),
    worst: z.string().min(1),
  }),
  space: z.string().min(1),
});

export const BreakdownSchema = z.object({
  approach: z.string().min(1),
  steps: z.array(z.string().min(1)).min(1),
});

export const BottleneckSchema = z.object({
  issue: z.string().min(1),
  impact: z.string().min(1),
  location: z.string().min(1).optional(),
});

export const ImprovementSchema = z.object({
  suggestion: z.string().min(1),
  expectedImpact: z.string().min(1),
});

export const ComparisonSchema = z.object({
  originalVsOptimized: z.string().min(1),
  improvementSummary: z.string().min(1),
});

export const SafeUserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable().optional(),
});

export const AnalysisResultSchema = z.object({
  summary: z.string().min(1),
  complexity: ComplexitySchema,
  breakdown: BreakdownSchema,
  bottlenecks: z.array(BottleneckSchema),
  antiPatterns: z.array(z.string().min(1)),
  improvements: z.array(ImprovementSchema),
  optimizedCode: z.string().min(1),
  comparison: ComparisonSchema.optional(),
  edgeCases: z.array(z.string().min(1)),
  readabilityScore: z.number().min(0).max(100).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export const CreateAnalysisInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code must be a non-empty string.")
    .max(20000, "Code payload is too large."),
  language: AnalysisLanguageSchema,
});

export const AnalysisRecordSchema = z.object({
  id: z.string().min(1),
  language: AnalysisLanguageSchema,
  result: AnalysisResultSchema,
  createdAt: z.string().datetime(),
  creator: SafeUserSchema.optional(),
});

export const SharedAnalysisSchema = z.object({
  id: z.string(),
  code: z.string(),
  language: AnalysisLanguageSchema,
  result: AnalysisResultSchema,
  createdAt: z.string().datetime(),
  creator: SafeUserSchema.optional(),
});

export const AnalysisHistoryItemSchema = z.object({
  id: z.string().min(1),
  language: AnalysisLanguageSchema,
  complexity: z.string().nullable(),
  suggestion: z.string().nullable(),
  title: z.string().nullable(),
  isShared: z.boolean(),
  createdAt: z.string().datetime(),
});

export const AnalysisHistoryMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export const AnalysisHistoryResponseSchema = z.object({
  data: z.array(AnalysisHistoryItemSchema),
  meta: AnalysisHistoryMetaSchema,
});

export type SafeUser = z.infer<typeof SafeUserSchema>;
export type AnalysisLanguage = z.infer<typeof AnalysisLanguageSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type CreateAnalysisInput = z.infer<typeof CreateAnalysisInputSchema>;
export type AnalysisRecord = z.infer<typeof AnalysisRecordSchema>;
export type SharedAnalysis = z.infer<typeof SharedAnalysisSchema>;
export type AnalysisHistoryItem = z.infer<typeof AnalysisHistoryItemSchema>;
export type AnalysisHistoryResponse = z.infer<typeof AnalysisHistoryResponseSchema>;