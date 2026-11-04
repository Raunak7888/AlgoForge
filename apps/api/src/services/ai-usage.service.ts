import { Prisma, type AiFeature } from "@algoforge/db";
import { aiUsageRepository } from "../repositories/ai-usage.repository";

const MAX_ATTEMPTS = 4;
const INT32_MAX = 2_000_000_000;

/** The calendar day (UTC midnight) used as the usage bucket. */
export function utcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const clampCount = (n: number | undefined): number =>
  n === undefined || !Number.isFinite(n) ? 0 : Math.max(0, Math.min(INT32_MAX, Math.floor(n)));

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Accounting only. Quotas and limits that read this data arrive in Phase 7. */
class AiUsageService {
  /** Records one AI request. Two requests racing to create the day's row both end up counted. */
  async record(userId: string, feature: AiFeature, tokens: { tokensIn?: number; tokensOut?: number } = {}, now: Date = new Date()) {
    const day = utcDay(now);
    const delta = { requests: 1, tokensIn: clampCount(tokens.tokensIn), tokensOut: clampCount(tokens.tokensOut) };
    for (let attempt = 1; ; attempt++) {
      try {
        return await aiUsageRepository.increment(userId, feature, day, delta);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  today(userId: string, feature: AiFeature, now: Date = new Date()) {
    return aiUsageRepository.findForDay(userId, feature, utcDay(now));
  }
}

export const aiUsageService = new AiUsageService();
