import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";
import { SharedAnalysisResponseSchema } from "./analysis";
import { SharedExplainSessionResponseSchema } from "./explain";
import { VisualizationStructureSchema } from "./visualizations";

export const ShareTypeSchema = z.enum(["analysis", "explain", "visualization"]);
export type ShareType = z.infer<typeof ShareTypeSchema>;

/** 12 base64url characters (randomBytes(9)). */
export const ShareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
export const ShareTargetIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/);

export const CreateShareRequestSchema = z.object({ type: ShareTypeSchema, targetId: ShareTargetIdSchema });
export type CreateShareRequest = z.infer<typeof CreateShareRequestSchema>;

/** GET /api/shares?target=analysis:<id> */
export const ShareListQuerySchema = z.object({
  target: z
    .string()
    .regex(/^(analysis|explain|visualization):[A-Za-z0-9_-]{1,64}$/)
    .describe("<type>:<targetId>, for example analysis:cm1abc."),
});

export function parseShareTarget(value: string): { type: ShareType; targetId: string } | null {
  const i = value.indexOf(":");
  if (i < 0) return null;
  const type = ShareTypeSchema.safeParse(value.slice(0, i));
  const targetId = ShareTargetIdSchema.safeParse(value.slice(i + 1));
  return type.success && targetId.success ? { type: type.data, targetId: targetId.data } : null;
}

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

/** Public creator card. Deliberately has no user id. */
export const PublicCreatorSchema = z.object({
  name: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

export const SharedVisualizationResponseSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  structures: z.array(VisualizationStructureSchema),
});

/** { type, data, creator }. createdAt is when the link was created. */
export const PublicShareResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("analysis"), createdAt: IsoDateTimeSchema, data: SharedAnalysisResponseSchema, creator: PublicCreatorSchema.optional() }),
  z.object({ type: z.literal("explain"), createdAt: IsoDateTimeSchema, data: SharedExplainSessionResponseSchema, creator: PublicCreatorSchema.optional() }),
  z.object({ type: z.literal("visualization"), createdAt: IsoDateTimeSchema, data: SharedVisualizationResponseSchema, creator: PublicCreatorSchema.optional() }),
]);

export type Share = z.infer<typeof ShareSchema>;
export type ShareListResponse = z.infer<typeof ShareListResponseSchema>;
export type PublicCreator = z.infer<typeof PublicCreatorSchema>;
export type SharedVisualizationResponse = z.infer<typeof SharedVisualizationResponseSchema>;
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;
