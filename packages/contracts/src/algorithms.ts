import { z } from "zod";
import { listResponse } from "./common";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ComplexitySummarySchema = z.object({
  timeBest: z.string().nullable(),
  timeAverage: z.string().nullable(),
  timeWorst: z.string().nullable(),
  space: z.string().nullable(),
});

export const AlgorithmSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  categoryId: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
});

export const TagSchema = z.object({ id: z.string(), label: z.string() });
export const DisplayCodeSchema = z.object({ language: z.string(), code: z.string() });

/** `forge` is the legacy executable config. It is opaque here and is replaced by a script in Phase 6. */
export const AlgorithmDetailResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
  displayCode: DisplayCodeSchema.nullable(),
  tags: z.array(TagSchema),
  forge: z.unknown().nullable().optional(),
});

export const AlgorithmListResponseSchema = listResponse(AlgorithmSummarySchema);
export const AlgorithmExecutionResponseSchema = z.object({ algorithmId: z.string(), name: z.string(), forge: z.unknown() });

export const AlgorithmListQuerySchema = z.object({
  categoryId: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  isPublished: z.enum(["true", "false"]).optional().describe("Honoured for admins only; everyone else sees published algorithms."),
  search: z.string().optional(),
});
export const AlgorithmLangQuerySchema = z.object({ lang: z.string().optional() });

const ComplexityInputSchema = z.object({
  time: z.object({ best: z.string().min(1), average: z.string().min(1), worst: z.string().min(1) }),
  space: z.string().min(1),
});
const LegacyForgeSchema = z.record(z.string(), z.unknown());

export const CreateAlgorithmRequestSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: ComplexityInputSchema,
  displayCodes: z.array(DisplayCodeSchema).min(1),
  forge: LegacyForgeSchema,
  tags: z.array(z.string().min(1)),
});

export const UpdateAlgorithmRequestSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  categoryId: z.string().min(1).optional(),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: z
    .object({
      time: z.object({ best: z.string().min(1).optional(), average: z.string().min(1).optional(), worst: z.string().min(1).optional() }).optional(),
      space: z.string().min(1).optional(),
    })
    .optional(),
  displayCodes: z.array(DisplayCodeSchema).min(1).optional(),
  forge: LegacyForgeSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export type AlgorithmSummary = z.infer<typeof AlgorithmSummarySchema>;
export type AlgorithmDetailResponse = z.infer<typeof AlgorithmDetailResponseSchema>;
export type AlgorithmListResponse = z.infer<typeof AlgorithmListResponseSchema>;
export type AlgorithmListQuery = z.input<typeof AlgorithmListQuerySchema>;
