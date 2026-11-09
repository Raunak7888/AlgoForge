import { prisma, type Prisma } from "@algoforge/db";
import { AppError } from "../utils/app-error";
import { explanationMessageRowId } from "./explanation-message.repository";
import { LIMITS } from "@algoforge/contracts";

export interface SessionSummaryRow {
  id: string;
  title: string | null;
  shareId: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}
export interface MessageRow {
  id: string;
  seq: number;
  role: "user" | "assistant";
  content: string;
  intent: string | null;
  createdAt: Date;
}

const summarySelect = { id: true, title: true, shareId: true, isPublic: true, createdAt: true, updatedAt: true } as const;

export const toMessageRow = (m: MessageRow): MessageRow => ({
  id: m.id,
  seq: m.seq,
  role: m.role,
  content: m.content,
  intent: m.intent,
  createdAt: m.createdAt,
});

export interface ListSessionsFilter {
  take: number;
  cursorUpdatedAt?: Date;
  cursorId?: string;
}

export const explanationSessionRepository = {
  create(userId: string, title?: string) {
    return prisma.explanationSession.create({ data: { userId, title: title ?? null, messages: [] }, select: summarySelect });
  },

  /** Keyset over (updatedAt, id), newest activity first. `take` should be limit + 1. */
  findManyByUser(userId: string, opts: ListSessionsFilter) {
    const at = opts.cursorUpdatedAt;
    return prisma.explanationSession.findMany({
      where: {
        userId,
        ...(at && opts.cursorId ? { OR: [{ updatedAt: { lt: at } }, { updatedAt: { equals: at }, id: { lt: opts.cursorId } }] } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: opts.take,
      select: summarySelect,
    });
  },

  /** Ownership is part of the query. */
  findOwned(id: string, userId: string) {
    return prisma.explanationSession.findFirst({ where: { id, userId }, select: summarySelect });
  },

  /** The last `take` messages, returned oldest first. */
  async listRecentMessages(sessionId: string, userId: string, take: number): Promise<MessageRow[]> {
    const rows = await prisma.explanationMessage.findMany({ where: { sessionId, session: { userId } }, orderBy: { seq: "desc" }, take });
    return rows.reverse().map(toMessageRow);
  },

  /**
   * Appends one question + answer as seq n+1 and n+2. The session row is locked (SELECT ... FOR UPDATE),
   * so two concurrent exchanges are serialized and can never overwrite or interleave (A-08).
   * The legacy JSON column is mirrored until Phase 9 moves sharing to the rows (verify:phase5 and public shares read it).
   */
  appendExchange(
    sessionId: string,
    userId: string,
    input: { query: string; answer: string; intent: string | null; title: string; maxMessages: number },
  ): Promise<{ userMessage: MessageRow; assistantMessage: MessageRow }> {
    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string; title: string | null }[]>`SELECT id, title FROM explanation_sessions WHERE id = ${sessionId} AND user_id = ${userId} FOR UPDATE`;
      const row = locked[0];
      if (!row) throw AppError.notFound("Session not found.");

      const agg = await tx.explanationMessage.aggregate({ where: { sessionId }, _max: { seq: true } });
      const last = agg._max.seq ?? 0;
      if (last + 2 > input.maxMessages) throw AppError.conflict(`This chat is full (${input.maxMessages} messages). Start a new chat to continue.`);

      const at = new Date();
      await tx.explanationMessage.createMany({
        data: [
          { id: explanationMessageRowId(sessionId, last + 1), sessionId, seq: last + 1, role: "user", content: input.query, intent: null, createdAt: at },
          { id: explanationMessageRowId(sessionId, last + 2), sessionId, seq: last + 2, role: "assistant", content: input.answer, intent: input.intent, createdAt: new Date() },
        ],
      });

      const rows = await tx.explanationMessage.findMany({ where: { sessionId }, orderBy: { seq: "asc" } });
      const mirror = rows.map((r) => ({ id: r.id, role: r.role, content: r.content, ...(r.intent ? { intent: r.intent } : {}), createdAt: r.createdAt.toISOString() }));
      await tx.explanationSession.updateMany({
        where: { id: sessionId, userId },
        data: { messages: mirror as unknown as Prisma.InputJsonValue, ...(row.title ? {} : { title: input.title }) },
      });

      return { userMessage: toMessageRow(rows[rows.length - 2]), assistantMessage: toMessageRow(rows[rows.length - 1]) };
    });
  },

  rename(id: string, userId: string, title: string) {
    return prisma.explanationSession.updateMany({ where: { id, userId }, data: { title } });
  },

  /** Hard-delete. Also removes the session's share row (no orphans). Messages cascade. */
  delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.share.deleteMany({ where: { type: "explain", targetId: id, ownerId: userId } });
      return tx.explanationSession.deleteMany({ where: { id, userId } });
    });
  },
  /** Public read. Only call after an ACTIVE share for this id was verified. */
  findPublicById(id: string) {
    return prisma.explanationSession.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        user: { select: { name: true, username: true, image: true } },
        messageRows: {
          orderBy: { seq: "asc" },
          take: LIMITS.assistant.maxMessagesPerSession,
          select: { id: true, seq: true, role: true, content: true, intent: true, createdAt: true },
        },
      },
    });
  },
};
