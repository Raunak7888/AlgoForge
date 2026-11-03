import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

/** Contracts for Phase 6 (saved work). No endpoint serves these yet. */
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
export const VisualizationListQuerySchema = pageQuerySchema({ defaultSize: 20, maxSize: 50 });

export const CreateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars),
  description: z.string().max(2000).optional(),
  script: z.string().min(1).max(LIMITS.script.maxChars),
  code: z.string().max(LIMITS.code.maxChars).optional(),
  language: AnalysisLanguageSchema.optional(),
});
export const UpdateVisualizationRequestSchema = CreateVisualizationRequestSchema.partial();
export const ValidateScriptRequestSchema = z.object({ script: z.string().min(1).max(LIMITS.script.maxChars) });
export const ValidateScriptResponseSchema = z.object({
  ok: z.boolean(),
  stepCount: z.number().int().min(0),
  structures: z.array(VisualizationStructureSchema),
  diagnostics: z.array(DiagnosticSchema),
});

export type Visualization = z.infer<typeof VisualizationSchema>;
export type CreateVisualizationRequest = z.infer<typeof CreateVisualizationRequestSchema>;
export type ValidateScriptResponse = z.infer<typeof ValidateScriptResponseSchema>;
