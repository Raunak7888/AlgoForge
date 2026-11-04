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
   * Idempotent. Returns null when the owner does not own the target (the ownership check and the write
   * happen in one transaction). An active share is returned unchanged; a revoked one is re-opened
   * with the new shareId so an old, revoked link never comes back to life.
   */
  createForOwnedTarget(ownerId: string, type: ShareType, targetId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      if (!(await ownsTarget(tx, ownerId, type, targetId))) return null;
      const existing = await tx.share.findUnique({ where: { type_targetId: { type, targetId } } });
      if (existing && existing.ownerId === ownerId && existing.revokedAt === null) return existing;
      if (existing) {
        return tx.share.update({
          where: { id: existing.id },
          data: { shareId, ownerId, revokedAt: null, expiresAt: null },
        });
      }
      return tx.share.create({ data: { shareId, type, targetId, ownerId } });
    });
  },

  /** Only the owner can revoke. Returns the number of shares revoked (0 = not found, not yours, or already revoked). */
  revokeByOwner(shareId: string, ownerId: string) {
    return prisma.share.updateMany({ where: { shareId, ownerId, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  /** A share that is neither revoked nor expired. */
  findActiveByShareId(shareId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { shareId, ...activeWhere(now) } });
  },

  findActiveByTarget(type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { type, targetId, ...activeWhere(now) } });
  },

  findByOwnerAndTarget(ownerId: string, type: ShareType, targetId: string) {
    return prisma.share.findFirst({ where: { ownerId, type, targetId } });
  },

  incrementViewCount(shareId: string, now: Date = new Date()) {
    return prisma.share.updateMany({ where: { shareId, ...activeWhere(now) }, data: { viewCount: { increment: 1 } } });
  },
};
