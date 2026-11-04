//# filename: apps/api/src/repositories/analysis.repository.ts

import { prisma, Prisma } from "@algoforge/db";

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
      data,
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

  setPublic(analysisId: string, shareId: string) {
    return prisma.analysis.update({
      where: { id: analysisId },
      data: { shareId, isPublic: true },
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