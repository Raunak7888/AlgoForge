import {
  SessionMessageSchema,
  type ExplainSessionDetail,
  type ExplainSessionSummary,
  type SessionMessage,
  type SharedExplainSessionResponse,
} from "@algoforge/contracts";
import { logger } from "../utils/logger";
import { toIso } from "./dates";

type DateLike = Date | string;

export function parseMessages(raw: unknown): SessionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionMessage[] = [];
  for (const item of raw) {
    const parsed = SessionMessageSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else logger.warn("dropping malformed stored session message");
  }
  return out;
}

export interface SessionSummaryRow {
  id: string;
  title: string | null;
  shareId: string | null;
  isPublic: boolean;
  createdAt: DateLike;
  updatedAt: DateLike;
}
export interface SessionRow extends SessionSummaryRow {
  messages: unknown;
}

export function serializeSessionSummary(row: SessionSummaryRow): ExplainSessionSummary {
  return { id: row.id, title: row.title, isPublic: row.isPublic, shareId: row.shareId, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

/** Strips internal fields (userId) and normalizes dates and messages. */
export function serializeSessionDetail(row: SessionRow): ExplainSessionDetail {
  return { ...serializeSessionSummary(row), messages: parseMessages(row.messages) };
}

export interface SharedSessionRow extends SessionRow {
  user: { id: string; name: string | null; username: string | null; image: string | null } | null;
}

export function serializeSharedSession(row: SharedSessionRow): SharedExplainSessionResponse {
  return {
    id: row.id,
    title: row.title,
    messages: parseMessages(row.messages),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    ...(row.user ? { creator: { id: row.user.id, name: row.user.name, username: row.user.username ?? row.user.name, avatarUrl: row.user.image } } : {}),
  };
}
