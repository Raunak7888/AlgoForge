import { createHash } from "crypto";
import { prisma, type Prisma } from "@algoforge/db";

/** Same formula as the Phase 5 backfill (md5 of "<sessionId>:<seq>"), so rewrites keep stable ids. */
export const explanationMessageRowId = (sessionId: string, seq: number): string =>
  createHash("md5").update(`${sessionId}:${seq}`).digest("hex");

export interface MessageInput {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  createdAt: string;
}

export const explanationMessageRepository = {
  /** Messages of a session the user owns. Ownership is a relation filter in the query. */
  listBySession(sessionId: string, userId: string, opts: { take: number; afterSeq?: number }) {
    return prisma.explanationMessage.findMany({
      where: {
        sessionId,
        session: { userId },
        ...(opts.afterSeq !== undefined ? { seq: { gt: opts.afterSeq } } : {}),
      },
      orderBy: { seq: "asc" },
      take: opts.take,
    });
  },

  countBySession(sessionId: string, userId: string) {
    return prisma.explanationMessage.count({ where: { sessionId, session: { userId } } });
  },

  /**
   * Makes the table mirror the given messages (seq = position, starting at 1).
   * Must run inside the same transaction that has already verified ownership of the session.
   */
  async replaceForSession(tx: Prisma.TransactionClient, sessionId: string, messages: readonly MessageInput[]): Promise<void> {
    await tx.explanationMessage.deleteMany({ where: { sessionId } });
    if (messages.length === 0) return;
    await tx.explanationMessage.createMany({
      data: messages.map((m, i) => {
        const at = new Date(m.createdAt);
        return {
          id: explanationMessageRowId(sessionId, i + 1),
          sessionId,
          seq: i + 1,
          role: m.role,
          content: m.content,
          intent: m.intent ?? null,
          createdAt: Number.isNaN(at.getTime()) ? new Date() : at,
        };
      }),
    });
  },
};
