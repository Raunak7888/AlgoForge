import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  line: z.number().int().min(1),
  column: z.number().int().min(1),
  endLine: z.number().int().min(1),
  endColumn: z.number().int().min(1),
  fix: z.object({ label: z.string(), replacement: z.string() }).optional(),
});
export const VisualizationStructureSchema = z.object({ id: z.string(), ds: z.string(), label: z.string() });

export const VisualizationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  code: z.string().nullable(),
  language: AnalysisLanguageSchema.nullable(),
  structures: z.array(VisualizationStructureSchema),
  stepCount: z.number().int().min(0),
  schemaVersion: z.number().int().min(1),
  forkedFromId: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export const VisualizationSummarySchema = VisualizationSchema.omit({ script: true, code: true });
export const VisualizationListResponseSchema = paginatedResponse(VisualizationSummarySchema);
export const VisualizationListQuerySchema = pageQuerySchema(LIMITS.pagination.visualizations);

const ScriptSchema = z.string().min(1).max(LIMITS.script.maxChars);

export const CreateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars),
  description: z.string().max(2000).optional(),
  script: ScriptSchema,
  code: z.string().max(LIMITS.code.maxChars).optional(),
  language: AnalysisLanguageSchema.optional(),
});
/** Every field is optional; null clears description, code or language. */
export const UpdateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars).optional(),
  description: z.string().max(2000).nullable().optional(),
  script: ScriptSchema.optional(),
  code: z.string().max(LIMITS.code.maxChars).nullable().optional(),
  language: AnalysisLanguageSchema.nullable().optional(),
});
export const ValidateScriptRequestSchema = z.object({ script: ScriptSchema });
export const ValidateScriptResponseSchema = z.object({
  ok: z.boolean(),
  stepCount: z.number().int().min(0),
  structures: z.array(VisualizationStructureSchema),
  diagnostics: z.array(DiagnosticSchema),
});

export type Visualization = z.infer<typeof VisualizationSchema>;
export type VisualizationSummary = z.infer<typeof VisualizationSummarySchema>;
export type VisualizationListResponse = z.infer<typeof VisualizationListResponseSchema>;
export type CreateVisualizationRequest = z.infer<typeof CreateVisualizationRequestSchema>;
export type UpdateVisualizationRequest = z.infer<typeof UpdateVisualizationRequestSchema>;
export type ValidateScriptResponse = z.infer<typeof ValidateScriptResponseSchema>;
