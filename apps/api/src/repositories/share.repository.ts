import { prisma, Prisma, type ShareType } from "@algoforge/db";

const activeWhere = (now: Date): Prisma.ShareWhereInput => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

async function ownsTarget(tx: Prisma.TransactionClient, ownerId: string, type: ShareType, targetId: string): Promise<boolean> {
  switch (type) {
    case "analysis":
      return (await tx.analysis.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "explain":
      return (await tx.explanationSession.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "visualization":
      return (await tx.visualization.count({ where: { id: targetId, userId: ownerId } })) > 0;
  }
}

export const shareRepository = {
  /**
   * Idempotent. Null when the owner does not own the target. An active share is returned unchanged;
   * a revoked or expired one is re-opened with the NEW shareId, so an old link never comes back to life.
   */
  createForOwnedTarget(ownerId: string, type: ShareType, targetId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      if (!(await ownsTarget(tx, ownerId, type, targetId))) return null;
      const existing = await tx.share.findUnique({ where: { type_targetId: { type, targetId } } });
      const live =
        existing !== null &&
        existing.ownerId === ownerId &&
        existing.revokedAt === null &&
        (existing.expiresAt === null || existing.expiresAt > new Date());
      if (existing && live) return existing;
      if (existing) {
        return tx.share.update({ where: { id: existing.id }, data: { shareId, ownerId, revokedAt: null, expiresAt: null } });
      }
      return tx.share.create({ data: { shareId, type, targetId, ownerId } });
    });
  },

  revokeByOwner(shareId: string, ownerId: string) {
    return prisma.share.updateMany({ where: { shareId, ownerId, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  async existsForOwner(shareId: string, ownerId: string): Promise<boolean> {
    return (await prisma.share.count({ where: { shareId, ownerId } })) > 0;
  },

  findActiveByShareId(shareId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { shareId, ...activeWhere(now) } });
  },

  findActiveByTarget(type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { type, targetId, ...activeWhere(now) } });
  },

  findByOwnerAndTarget(ownerId: string, type: ShareType, targetId: string) {
    return prisma.share.findFirst({ where: { ownerId, type, targetId } });
  },

  listActiveForTarget(ownerId: string, type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findMany({ where: { ownerId, type, targetId, ...activeWhere(now) }, orderBy: { createdAt: "desc" } });
  },

  findActiveShareIds(ownerId: string, type: ShareType, targetIds: string[], now: Date = new Date()) {
    return prisma.share.findMany({
      where: { ownerId, type, targetId: { in: targetIds }, ...activeWhere(now) },
      select: { targetId: true, shareId: true },
    });
  },

  listShareIdsByOwner(ownerId: string) {
    return prisma.share.findMany({ where: { ownerId }, select: { shareId: true } });
  },

  incrementViewCount(shareId: string, now: Date = new Date()) {
    return prisma.share.updateMany({ where: { shareId, ...activeWhere(now) }, data: { viewCount: { increment: 1 } } });
  },
};
