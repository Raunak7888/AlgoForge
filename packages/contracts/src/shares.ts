import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";
import { SharedAnalysisResponseSchema } from "./analysis";
import { SharedExplainSessionResponseSchema } from "./explain";
import { VisualizationStructureSchema } from "./visualizations";

/** Contracts for Phase 9 (unified shares). No endpoint serves these yet. */
export const ShareTypeSchema = z.enum(["analysis", "explain", "visualization"]);
export const ShareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);

export const CreateShareRequestSchema = z.object({ type: ShareTypeSchema, targetId: z.string().min(1) });
export const ShareSchema = z.object({
  shareId: ShareIdSchema,
  url: z.url(),
  type: ShareTypeSchema,
  targetId: z.string(),
  createdAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable(),
  viewCount: z.number().int().min(0),
});
export const ShareListResponseSchema = listResponse(ShareSchema);

export const SharedVisualizationResponseSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  structures: z.array(VisualizationStructureSchema),
});

export const PublicShareResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("analysis"), createdAt: IsoDateTimeSchema, data: SharedAnalysisResponseSchema }),
  z.object({ type: z.literal("explain"), createdAt: IsoDateTimeSchema, data: SharedExplainSessionResponseSchema }),
  z.object({ type: z.literal("visualization"), createdAt: IsoDateTimeSchema, data: SharedVisualizationResponseSchema }),
]);

export type Share = z.infer<typeof ShareSchema>;
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;
