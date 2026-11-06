//# filename: apps/api/src/repositories/analysis.repository.ts

import { prisma, Prisma } from "@algoforge/db";
import { AppError } from "../utils/app-error";
import { hashCode } from "../utils/ai-cache-keys";

export { hashCode };

const detailSelect = {
  id: true,
  language: true,
  code: true,
  title: true,
  result: true,
  isPublic: true,
  shareId: true,
  createdAt: true,
} as const;

export interface HistoryFilter {
  take: number;
  sort: "newest" | "oldest";
  cursorCreatedAt?: Date;
  cursorId?: string;
  q?: string;
  language?: string;
}

export const analysisRepository = {
  create(data: {
    userId: string;
    code: string;
    language: string;
    title: string;
    complexity: string | null;
    suggestion: string | null;
    model: string;
    promptVersion: string;
    schemaVersion: number;
    latencyMs: number;
    result: Prisma.InputJsonValue;
  }) {
    return prisma.analysis.create({
      data: { ...data, codeHash: hashCode(data.code) },
      select: detailSelect,
    });
  },

  /** Keyset pagination over (createdAt, id) in either direction, with optional search and language filter. */
  findManyByUser(userId: string, opts: HistoryFilter) {
    const asc = opts.sort === "oldest";
    const mode = Prisma.QueryMode.insensitive;
    const and: Prisma.AnalysisWhereInput[] = [];

    if (opts.q) {
      and.push({
        OR: [
          { title: { contains: opts.q, mode } },
          { suggestion: { contains: opts.q, mode } },
          { complexity: { contains: opts.q, mode } },
        ],
      });
    }
    if (opts.cursorCreatedAt && opts.cursorId) {
      const at = opts.cursorCreatedAt;
      and.push({
        OR: [
          { createdAt: asc ? { gt: at } : { lt: at } },
          { createdAt: { equals: at }, id: asc ? { gt: opts.cursorId } : { lt: opts.cursorId } },
        ],
      });
    }

    const dir: Prisma.SortOrder = asc ? "asc" : "desc";
    return prisma.analysis.findMany({
      where: { userId, ...(opts.language ? { language: opts.language } : {}), ...(and.length ? { AND: and } : {}) },
      orderBy: [{ createdAt: dir }, { id: dir }],
      take: opts.take,
      select: {
        id: true,
        language: true,
        complexity: true,
        suggestion: true,
        title: true,
        isPublic: true,
        shareId: true,
        createdAt: true,
      },
    });
  },

  findOneByUser(userId: string, analysisId: string) {
    return prisma.analysis.findFirst({ where: { id: analysisId, userId }, select: detailSelect });
  },

  /** Deletes an analysis and its share row in one transaction. Returns how many analyses were removed (0 = not yours / missing). */
  deleteByUser(analysisId: string, userId: string): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const result = await tx.analysis.deleteMany({ where: { id: analysisId, userId } });
      if (result.count > 0) await tx.share.deleteMany({ where: { type: "analysis", targetId: analysisId } });
      return result.count;
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
