import { z } from "zod";
import {
  CreateExplainSessionRequestSchema,
  LIMITS,
  SendMessageRequestSchema,
  type CreateExplainSessionRequest,
  type SendMessageRequest,
} from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

const { defaultSize, maxSize } = LIMITS.pagination.explainSessions;

export const CreateSessionSchema = CreateExplainSessionRequestSchema;
export const SendMessageSchema = SendMessageRequestSchema;
export const ListSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().optional(),
});

export type CreateSessionInput = CreateExplainSessionRequest;
export type SendMessageInput = SendMessageRequest;
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

export function parseCreateSession(value: unknown): CreateSessionInput {
  const r = CreateSessionSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid session data.");
  return r.data;
}

export function parseSendMessage(value: unknown): SendMessageInput {
  const r = SendMessageSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid message.");
  return r.data;
}

export function parseListSessionsQuery(value: unknown): ListSessionsQuery {
  const r = ListSessionsQuerySchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query params.");
  return r.data;
}
