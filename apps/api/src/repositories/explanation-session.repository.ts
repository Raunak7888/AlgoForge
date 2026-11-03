import { prisma, Prisma } from "@algoforge/db";
import type { SessionMessage } from "../services/explanation-session.service";

export const explanationSessionRepository = {
  // ─── Create ────────────────────────────────────────────────────────────────

  create(userId: string, title?: string) {
    return prisma.explanationSession.create({
      data: { userId, title: title ?? null, messages: [] },
    });
  },

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Paginated list — keyset by id (cursor = last seen id). */
  findManyByUser(userId: string, opts: { take: number; cursor?: string }) {
    return prisma.explanationSession.findMany({
      where: {
        userId,
        ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    opts.take,
      select:  {
        id:        true,
        title:     true,
        isPublic:  true,
        shareId:   true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /** Full session including messages — only accessible by owner. */
  findOneByUser(id: string, userId: string) {
    return prisma.explanationSession.findFirst({
      where: { id, userId },
    });
  },

  /** Public session by shareId — includes basic creator info. */
  findPublicByShareId(shareId: string) {
    return prisma.explanationSession.findUnique({
      where:   { shareId, isPublic: true },
      include: {
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  /** Replace the messages array and optionally update the title. */
  appendMessages(id: string, messages: SessionMessage[], title?: string) {
    return prisma.explanationSession.update({
      where: { id },
      data:  {
        messages: messages as unknown as Prisma.InputJsonValue,
        ...(title ? { title } : {}),
      },
    });
  },

  /** Make the session public and set its shareId. */
  share(id: string, shareId: string) {
    return prisma.explanationSession.update({
      where: { id },
      data:  { shareId, isPublic: true },
    });
  },

  // ─── Delete ────────────────────────────────────────────────────────────────

  /** Hard-delete — returns count so callers can detect not-found. */
  delete(id: string, userId: string) {
    return prisma.explanationSession.deleteMany({ where: { id, userId } });
  },
};