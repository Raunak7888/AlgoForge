import { prisma, Prisma } from "@algoforge/db";

export const auditLogRepository = {
  create(data: {
    actorId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    meta: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({ data, select: { id: true } });
  },

  /** Newest first. `take` should be limit + 1 to detect a next page. */
  findPage(opts: { take: number; cursor?: string; actorId?: string; targetType?: string; targetId?: string }) {
    return prisma.auditLog.findMany({
      where: {
        ...(opts.actorId ? { actorId: opts.actorId } : {}),
        ...(opts.targetType ? { targetType: opts.targetType } : {}),
        ...(opts.targetId ? { targetId: opts.targetId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  },
};
