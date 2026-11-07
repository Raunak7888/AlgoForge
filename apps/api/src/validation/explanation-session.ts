import { z } from "zod";
import {
  CreateExplainSessionRequestSchema,
  LIMITS,
  SendMessageRequestSchema,
  UpdateExplainSessionRequestSchema,
  type CreateExplainSessionRequest,
  type SendMessageRequest,
  type UpdateExplainSessionRequest,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

const sessions = LIMITS.pagination.explainSessions;
const messages = LIMITS.pagination.explainMessages;

export type CreateSessionInput = CreateExplainSessionRequest;
export type SendMessageInput = SendMessageRequest;
export type RenameSessionInput = UpdateExplainSessionRequest;
export interface ListSessionsQuery {
  limit: number;
  cursorUpdatedAt?: Date;
  cursorId?: string;
}
export interface ListMessagesQuery {
  limit: number;
  afterSeq?: number;
}

export function parseCreateSession(value: unknown): CreateSessionInput {
  const r = CreateExplainSessionRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid session data.");
  return r.data;
}
export function parseSendMessage(value: unknown): SendMessageInput {
  const r = SendMessageRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid message.");
  return r.data;
}
export function parseRenameSession(value: unknown): RenameSessionInput {
  const r = UpdateExplainSessionRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid title.");
  return r.data;
}

/* ── cursors: opaque to clients ── */

const SessionCursorSchema = z.object({ updatedAt: z.iso.datetime(), id: z.string().min(1).max(64) });
export const encodeSessionCursor = (c: { updatedAt: string; id: string }): string => Buffer.from(JSON.stringify(c), "utf8").toString("base64url");

function decodeSessionCursor(raw: string): { updatedAt: Date; id: string } {
  try {
    const parsed = SessionCursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return { updatedAt: new Date(parsed.updatedAt), id: parsed.id };
  } catch {
    throw AppError.badRequest("Invalid cursor.");
  }
}

const blankless = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== ""))
    : {};

const SessionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(sessions.maxSize).default(sessions.defaultSize),
  cursor: z.string().max(512).optional(),
});

export function parseListSessionsQuery(value: unknown): ListSessionsQuery {
  const r = SessionsQuery.safeParse(blankless(value));
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query params.");
  if (!r.data.cursor) return { limit: r.data.limit };
  const c = decodeSessionCursor(r.data.cursor);
  return { limit: r.data.limit, cursorUpdatedAt: c.updatedAt, cursorId: c.id };
}

const MessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(messages.maxSize).default(messages.defaultSize),
  cursor: z.string().regex(/^\d{1,6}$/, "Invalid cursor.").optional(),
});

export function parseListMessagesQuery(value: unknown): ListMessagesQuery {
  const r = MessagesQuery.safeParse(blankless(value));
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query params.");
  return { limit: r.data.limit, ...(r.data.cursor ? { afterSeq: Number(r.data.cursor) } : {}) };
}
