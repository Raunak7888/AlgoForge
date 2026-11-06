import { z } from "zod";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";
import { SafeUserSchema } from "./users";

export const SessionMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  intent: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

export const ExplainSessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  isPublic: z.boolean(),
  shareId: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export const ExplainSessionDetailSchema = ExplainSessionSummarySchema.extend({ messages: z.array(SessionMessageSchema) });
export const ExplainSessionListResponseSchema = paginatedResponse(ExplainSessionSummarySchema);
export const ExplainSessionListQuerySchema = pageQuerySchema(LIMITS.pagination.explainSessions);

export const CreateExplainSessionRequestSchema = z.object({ title: z.string().trim().min(1).max(LIMITS.title.maxChars).optional() });
export const SendMessageRequestSchema = z.object({
  query: z.string().trim().min(LIMITS.message.minChars, `Query must be at least ${LIMITS.message.minChars} characters.`).max(LIMITS.message.maxChars, "Query is too long."),
});
export const SendMessageResponseSchema = z.object({ userMessage: SessionMessageSchema, assistantMessage: SessionMessageSchema });

export const SharedExplainSessionResponseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  messages: z.array(SessionMessageSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  creator: SafeUserSchema.optional(),
});

/** One-shot explain endpoint (kept or removed in Phase 8). */
export const ExplainRequestSchema = SendMessageRequestSchema;
export const ExplainResponseSchema = z.object({
  query: z.string(),
  intent: z.string(),
  explanation: z.string(),
  relevantFiles: z.array(z.string()),
  relevantRoutes: z.array(z.string()),
  cachedAt: IsoDateTimeSchema.optional(),
});

export type ExplainSessionSummary = z.infer<typeof ExplainSessionSummarySchema>;
export type ExplainSessionDetail = z.infer<typeof ExplainSessionDetailSchema>;
export type ExplainSessionListResponse = z.infer<typeof ExplainSessionListResponseSchema>;
export type CreateExplainSessionRequest = z.infer<typeof CreateExplainSessionRequestSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;
export type SharedExplainSessionResponse = z.infer<typeof SharedExplainSessionResponseSchema>;
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;
