import { z } from "zod";
import { CursorSchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ComplexitySummarySchema = z.object({
  timeBest: z.string().nullable(),
  timeAverage: z.string().nullable(),
  timeWorst: z.string().nullable(),
  space: z.string().nullable(),
});

export const TagSchema = z.object({ id: z.string(), label: z.string() });
export const DisplayCodeSchema = z.object({ language: z.string(), code: z.string() });

export const AlgorithmSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  categoryId: z.string(),
  categoryLabel: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
  tags: z.array(TagSchema),
});

/** `script` is the visualizer script (JSON text). It replaces the old executable `forge` config. */
export const AlgorithmDetailResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  difficulty: DifficultySchema,
  categoryId: z.string(),
  categoryLabel: z.string(),
  isPublished: z.boolean(),
  complexity: ComplexitySummarySchema.nullable(),
  displayCode: DisplayCodeSchema.nullable(),
  displayCodes: z.array(DisplayCodeSchema),
  tags: z.array(TagSchema),
  script: z.string().nullable(),
  scriptVersion: z.number().int().min(1),
});

export const AlgorithmListResponseSchema = paginatedResponse(AlgorithmSummarySchema);

export const AlgorithmExecutionResponseSchema = z.object({
  algorithmId: z.string(),
  name: z.string(),
  script: z.string(),
  scriptVersion: z.number().int().min(1),
});

export const AlgorithmListQuerySchema = z.object({
  q: z.string().max(LIMITS.search.maxQueryChars).optional().describe("Search name, description and tags."),
  search: z.string().max(LIMITS.search.maxQueryChars).optional().describe("Deprecated alias of q."),
  categoryId: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  tag: z.string().max(50).optional(),
  isPublished: z.enum(["true", "false"]).optional().describe("Honoured for admins only; everyone else sees published algorithms."),
  limit: z.number().int().min(1).max(LIMITS.pagination.algorithms.maxSize).optional().describe(`Page size. Default ${LIMITS.pagination.algorithms.defaultSize}.`),
  cursor: CursorSchema.optional().describe("Opaque cursor: meta.nextCursor of the previous page."),
});
export const AlgorithmLangQuerySchema = z.object({ lang: z.string().optional() });

const ComplexityInputSchema = z.object({
  time: z.object({ best: z.string().min(1), average: z.string().min(1), worst: z.string().min(1) }),
  space: z.string().min(1),
});
const ScriptSchema = z.string().min(1).max(LIMITS.script.maxChars);
const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

export const CreateAlgorithmRequestSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: ComplexityInputSchema,
  displayCodes: z.array(DisplayCodeSchema).min(1),
  script: ScriptSchema.optional().describe("Visualizer script. Required before an algorithm can be published."),
  tags: z.array(z.string().min(1)).optional(),
});

export const UpdateAlgorithmRequestSchema = z.object({
  slug: SlugSchema.optional(),
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
  script: ScriptSchema.nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export type AlgorithmSummary = z.infer<typeof AlgorithmSummarySchema>;
export type AlgorithmDetailResponse = z.infer<typeof AlgorithmDetailResponseSchema>;
export type AlgorithmListResponse = z.infer<typeof AlgorithmListResponseSchema>;
export type AlgorithmExecutionResponse = z.infer<typeof AlgorithmExecutionResponseSchema>;
export type AlgorithmListQuery = z.input<typeof AlgorithmListQuerySchema>;
export type CreateAlgorithmRequest = z.infer<typeof CreateAlgorithmRequestSchema>;
export type UpdateAlgorithmRequest = z.infer<typeof UpdateAlgorithmRequestSchema>;
