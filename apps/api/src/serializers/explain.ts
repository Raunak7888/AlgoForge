import {
  SessionMessageSchema,
  type ExplainSessionDetail,
  type ExplainSessionSummary,
  type SessionMessage,
  type SharedExplainSessionResponse,
} from "@algoforge/contracts";
import type { MessageRow } from "../repositories/explanation-session.repository";
import { logger } from "../utils/logger";
import { toIso } from "./dates";

type DateLike = Date | string;

/** Legacy JSON messages (public shares until Phase 9) have no seq: it is their position. */
export function parseMessages(raw: unknown): SessionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionMessage[] = [];
  raw.forEach((item, i) => {
    const parsed = SessionMessageSchema.safeParse(item && typeof item === "object" ? { ...item, seq: i + 1 } : item);
    if (parsed.success) out.push(parsed.data);
    else logger.warn("dropping malformed stored session message");
  });
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

export function serializeSessionSummary(row: SessionSummaryRow): ExplainSessionSummary {
  return { id: row.id, title: row.title, isPublic: row.isPublic, shareId: row.shareId, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

export function serializeMessage(row: MessageRow): SessionMessage {
  return { id: row.id, seq: row.seq, role: row.role, content: row.content, ...(row.intent ? { intent: row.intent } : {}), createdAt: toIso(row.createdAt) };
}

/** Strips internal fields (userId). Dates are always ISO strings, so a fresh read and a cached read look the same (A-07). */
export function serializeSessionDetail(summary: SessionSummaryRow, rows: readonly MessageRow[]): ExplainSessionDetail {
  return { ...serializeSessionSummary(summary), messages: rows.map(serializeMessage) };
}

export interface SharedSessionRow extends SessionSummaryRow {
  messages: unknown;
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
