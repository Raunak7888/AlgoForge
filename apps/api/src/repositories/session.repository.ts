import { prisma } from "@algoforge/db";

const userSelect = {
  id:       true,
  email:    true,
  username: true,
  name:     true,
  image:    true,
  role:     true,
} as const;

export const sessionRepository = {
  create(data: {
    id:            string;
    userId:        string;
    tokenHash:     string;
    expiresAt:     Date;
    lastUsedAt:    Date;
    ipAddress:     string | null;
    userAgent:     string | null;
    rotatedFromId?: string;
  }) {
    return prisma.session.create({ data });
  },

  findActiveById(sessionId: string, userId: string) {
    return prisma.session.findFirst({
      where: {
        id:        sessionId,
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id:         true,
        expiresAt:  true,
        lastUsedAt: true,
        user:       { select: userSelect },
      },
    });
  },

  findByIdWithUser(sessionId: string) {
    return prisma.session.findUnique({
      where:   { id: sessionId },
      include: { user: { select: userSelect } },
    });
  },

  /** Find a session that was created by rotating the given session id. */
  findRotatedFrom(originalId: string) {
    return prisma.session.findFirst({
      where: { rotatedFromId: originalId },
    });
  },

  async rotate(
    currentId:      string,
    currentUserId:  string,
    currentTokenHash: string,
    next: {
      id:          string;
      tokenHash:   string;
      expiresAt:   Date;
      lastUsedAt:  Date;
      ipAddress:   string | null;
      userAgent:   string | null;
    },
  ) {
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const revoked = await tx.session.updateMany({
        where: {
          id:        currentId,
          userId:    currentUserId,
          tokenHash: currentTokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now, lastUsedAt: now },
      });

      if (revoked.count !== 1) return null;

      return tx.session.create({
        data: {
          ...next,
          userId:        currentUserId,
          rotatedFromId: currentId,
        },
      });
    });
  },

  revokeById(sessionId: string, userId?: string) {
    return prisma.session.updateMany({
      where: { id: sessionId, ...(userId ? { userId } : {}), revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  },

  revokeAllForUser(userId: string) {
    return prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
  },

  /**
   * Writes lastUsedAt only if it is still older than the throttle window.
   * The condition lives in the query, so concurrent requests cannot both write.
   */
  touchLastUsed(sessionId: string, now: Date, minIntervalMs: number) {
    return prisma.session.updateMany({
      where: {
        id:         sessionId,
        revokedAt:  null,
        lastUsedAt: { lt: new Date(now.getTime() - minIntervalMs) },
      },
      data: { lastUsedAt: now },
    });
  },

  /** Devices that can still sign in: not revoked, not expired. One row per device (rotation replaces the row). */
  listActiveForUser(userId: string, now: Date) {
    return prisma.session.findMany({
      where:   { userId, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { lastUsedAt: "desc" },
      take:    50,
      select: {
        id:         true,
        createdAt:  true,
        lastUsedAt: true,
        ipAddress:  true,
        userAgent:  true,
      },
    });
  },

  /** Removes expired sessions, and revoked sessions older than the retention window. */
  deleteStale(now: Date, revokedRetentionMs: number) {
    return prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { revokedAt: { lt: new Date(now.getTime() - revokedRetentionMs) } },
        ],
      },
    });
  },
};
