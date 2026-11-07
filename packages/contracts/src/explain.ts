import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";
import { SafeUserSchema } from "./users";

export const SessionMessageSchema = z.object({
  id: z.string().min(1),
  /** 1-based position inside the chat. Messages are ordered and paged by it. */
  seq: z.number().int().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  intent: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

/** The visualizer step the person is looking at. */
export const ExplainStepContextSchema = z.object({
  position: z.number().int().min(1).max(1_000_000).describe("1-based step on screen."),
  total: z.number().int().min(1).max(1_000_000),
  call: z.string().max(300).optional().describe('The operation, e.g. "A.swap(0, 3)".'),
  narration: z.string().max(1_000).optional(),
});

/** What the assistant is allowed to know about the workspace. Everything is optional and treated as untrusted data. */
export const ExplainContextSchema = z.object({
  language: AnalysisLanguageSchema.optional(),
  code: z.string().max(LIMITS.code.maxChars).optional(),
  script: z.string().max(LIMITS.script.maxChars).optional(),
  step: ExplainStepContextSchema.optional(),
  algorithmSlug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional().describe("A published catalog algorithm."),
});
export type ExplainContext = z.infer<typeof ExplainContextSchema>;

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

export const ExplainMessageListResponseSchema = paginatedResponse(SessionMessageSchema);
export const ExplainMessageListQuerySchema = pageQuerySchema(LIMITS.pagination.explainMessages);

export const CreateExplainSessionRequestSchema = z.object({ title: z.string().trim().min(1).max(LIMITS.title.maxChars).optional() });
export const UpdateExplainSessionRequestSchema = z.object({ title: z.string().trim().min(1).max(LIMITS.title.maxChars) });
export const SendMessageRequestSchema = z.object({
  query: z.string().trim().min(LIMITS.message.minChars, `Query must be at least ${LIMITS.message.minChars} characters.`).max(LIMITS.message.maxChars, "Query is too long."),
  context: ExplainContextSchema.optional(),
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

export type ExplainSessionSummary = z.infer<typeof ExplainSessionSummarySchema>;
export type ExplainSessionDetail = z.infer<typeof ExplainSessionDetailSchema>;
export type ExplainSessionListResponse = z.infer<typeof ExplainSessionListResponseSchema>;
export type ExplainMessageListResponse = z.infer<typeof ExplainMessageListResponseSchema>;
export type CreateExplainSessionRequest = z.infer<typeof CreateExplainSessionRequestSchema>;
export type UpdateExplainSessionRequest = z.infer<typeof UpdateExplainSessionRequestSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;
export type SharedExplainSessionResponse = z.infer<typeof SharedExplainSessionResponseSchema>;
