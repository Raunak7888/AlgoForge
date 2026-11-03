import { z } from "zod";
import { AppError } from "../utils/app-error";

export const CreateSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

export const SendMessageSchema = z.object({
  query: z
    .string()
    .trim()
    .min(5, "Query must be at least 5 characters.")
    .max(2_000, "Query is too long."),
});

export const ListSessionsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type SendMessageInput   = z.infer<typeof SendMessageSchema>;
export type ListSessionsQuery  = z.infer<typeof ListSessionsQuerySchema>;

export function parseCreateSession(value: unknown): CreateSessionInput {
  const r = CreateSessionSchema.safeParse(value);
  if (!r.success) throw AppError.badRequest(r.error.issues[0]?.message ?? "Invalid session data.");
  return r.data;
}

export function parseSendMessage(value: unknown): SendMessageInput {
  const r = SendMessageSchema.safeParse(value);
  if (!r.success) throw AppError.badRequest(r.error.issues[0]?.message ?? "Invalid message.");
  return r.data;
}

export function parseListSessionsQuery(value: unknown): ListSessionsQuery {
  const r = ListSessionsQuerySchema.safeParse(value);
  if (!r.success) throw AppError.badRequest(r.error.issues[0]?.message ?? "Invalid query params.");
  return r.data;
}