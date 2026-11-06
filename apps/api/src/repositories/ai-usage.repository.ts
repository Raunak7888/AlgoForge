import { prisma, type AiFeature } from "@algoforge/db";

export interface UsageDelta {
  requests: number;
  tokensIn: number;
  tokensOut: number;
}

export const aiUsageRepository = {
  /** Atomic upsert-and-increment on the (user, feature, day) row. `day` must be a UTC midnight date. */
  increment(userId: string, feature: AiFeature, day: Date, delta: UsageDelta) {
    return prisma.aiUsage.upsert({
      where: { userId_feature_day: { userId, feature, day } },
      create: { userId, feature, day, requests: delta.requests, tokensIn: delta.tokensIn, tokensOut: delta.tokensOut },
      update: {
        requests: { increment: delta.requests },
        tokensIn: { increment: delta.tokensIn },
        tokensOut: { increment: delta.tokensOut },
      },
    });
  },

  findForDay(userId: string, feature: AiFeature, day: Date) {
    return prisma.aiUsage.findUnique({ where: { userId_feature_day: { userId, feature, day } } });
  },

  async sumSince(userId: string, feature: AiFeature, sinceDay: Date) {
    const agg = await prisma.aiUsage.aggregate({
      where: { userId, feature, day: { gte: sinceDay } },
      _sum: { requests: true, tokensIn: true, tokensOut: true },
    });
    return {
      requests: agg._sum.requests ?? 0,
      tokensIn: agg._sum.tokensIn ?? 0,
      tokensOut: agg._sum.tokensOut ?? 0,
    };
  },
};
