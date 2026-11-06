import { prisma, Prisma } from "@algoforge/db";
import type { SessionMessage } from "../services/explanation-session.service";
import { AppError } from "../utils/app-error";
import { explanationMessageRepository } from "./explanation-message.repository";

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

  /**
   * Replaces the messages array (and optionally the title) of a session the user owns, and mirrors the
   * messages into explanation_messages in the same transaction. The JSON column stays authoritative until Phase 8.
   */
  appendMessages(id: string, userId: string, messages: SessionMessage[], title?: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.explanationSession.updateMany({
        where: { id, userId },
        data: {
          messages: messages as unknown as Prisma.InputJsonValue,
          ...(title ? { title } : {}),
        },
      });
      if (updated.count === 0) throw AppError.notFound("Session not found.");
      await explanationMessageRepository.replaceForSession(tx, id, messages);
    });
  },

  /** Make the session public and set its shareId (mirrored into the shares table). The owner is part of the query. */
  share(id: string, userId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.explanationSession.updateMany({
        where: { id, userId },
        data: { shareId, isPublic: true },
      });
      if (updated.count === 0) throw AppError.notFound("Session not found.");
      await tx.share.upsert({
        where: { type_targetId: { type: "explain", targetId: id } },
        create: { shareId, type: "explain", targetId: id, ownerId: userId },
        update: { shareId, revokedAt: null },
      });
    });
  },

  // ─── Delete ────────────────────────────────────────────────────────────────

  /** Hard-delete — returns count so callers can detect not-found. Also removes the session's share row (no orphans). */
  delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.share.deleteMany({ where: { type: "explain", targetId: id, ownerId: userId } });
      return tx.explanationSession.deleteMany({ where: { id, userId } });
    });
  },
};
