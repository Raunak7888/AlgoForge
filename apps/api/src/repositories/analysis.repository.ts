//# filename: apps/api/src/repositories/analysis.repository.ts

import { createHash } from "crypto";
import { prisma, Prisma } from "@algoforge/db";
import { AppError } from "../utils/app-error";

/** SHA-256 (hex) of the submitted code. Same formula as the Phase 5 backfill. */
export const hashCode = (code: string): string => createHash("sha256").update(code, "utf8").digest("hex");

export const analysisRepository = {
  create(data: {
    userId: string;
    code: string;
    language: string;
    complexity: string | null;
    suggestion: string | null;
    result: Prisma.InputJsonValue;
  }) {
    return prisma.analysis.create({
      data: { ...data, codeHash: hashCode(data.code) },
      select: { id: true, language: true, result: true, createdAt: true },
    });
  },

  findManyByUser(
    userId: string,
    opts: {
      cursorCreatedAt?: Date;
      cursorId?: string;
      take: number;
    },
  ) {
    return prisma.analysis.findMany({
      where: {
        userId,
        ...(opts.cursorCreatedAt && opts.cursorId
          ? {
              OR: [
                { createdAt: { lt: opts.cursorCreatedAt } },
                {
                  createdAt: { equals: opts.cursorCreatedAt },
                  id: { lt: opts.cursorId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.take,
      select: {
        id: true,
        language: true,
        complexity: true,
        suggestion: true,
        createdAt: true,
      },
    });
  },

  findOneByUser(userId: string, analysisId: string) {
    return prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      select: { id: true, language: true, result: true, createdAt: true },
    });
  },

  findForShare(analysisId: string, userId: string) {
    return prisma.analysis.findFirst({ where: { id: analysisId, userId } });
  },

  /**
   * Marks the analysis public AND mirrors that into the shares table in one transaction.
   * The legacy columns stay authoritative until Phase 9. The owner is part of the query.
   */
  setPublic(analysisId: string, userId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.analysis.updateMany({
        where: { id: analysisId, userId },
        data: { shareId, isPublic: true },
      });
      if (updated.count === 0) throw AppError.notFound("Analysis not found.");
      await tx.share.upsert({
        where: { type_targetId: { type: "analysis", targetId: analysisId } },
        create: { shareId, type: "analysis", targetId: analysisId, ownerId: userId },
        update: { shareId, revokedAt: null },
      });
      return { id: analysisId, shareId };
    });
  },

  findPublicByShareId(shareId: string) {
    return prisma.analysis.findUnique({
      where: { shareId, isPublic: true },
      select: {
        id: true,
        code: true,
        language: true,
        result: true,
        createdAt: true,
        isPublic: true,
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
  },
};
