import type { QuotaInfo } from "@algoforge/contracts";
import { env } from "../config/env";
import { getRedisClient } from "../config/redis";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";
import { aiUsageService } from "./ai-usage.service";

/**
 * Per-user quotas for billable AI calls.
 *  - Redis holds the live counters (atomic, no overshoot).
 *  - AiUsage (Postgres) is the durable daily record: it seeds the daily counter and is the
 *    fallback when Redis is down. Minute counters fall back to process memory.
 *  - A reservation is released when the AI call fails, so provider problems never cost quota.
 */
export type QuotaFeature = "analysis";

export interface QuotaWindow {
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}
export interface QuotaSnapshot {
  minute: QuotaWindow;
  day: QuotaWindow;
}
export interface Reservation {
  snapshot: QuotaSnapshot;
  release: () => Promise<void>;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

const RESERVE_SCRIPT = `
local exists = redis.call('EXISTS', KEYS[1])
local cur
if exists == 1 then cur = tonumber(redis.call('GET', KEYS[1])) else cur = tonumber(ARGV[3]) end
if cur >= tonumber(ARGV[1]) then
  if exists == 0 then redis.call('SET', KEYS[1], cur, 'EX', ARGV[2]) end
  return {0, cur}
end
if exists == 1 then redis.call('INCR', KEYS[1]) else redis.call('SET', KEYS[1], cur + 1, 'EX', ARGV[2]) end
return {1, cur + 1}
`;

const RELEASE_SCRIPT = `
local v = tonumber(redis.call('GET', KEYS[1]) or '0')
if v > 0 then redis.call('DECR', KEYS[1]) end
return v
`;

export function minuteWindow(now: Date): { id: string; resetAtMs: number } {
  const slot = Math.floor(now.getTime() / MINUTE_MS);
  return { id: String(slot), resetAtMs: (slot + 1) * MINUTE_MS };
}

export function dayWindow(now: Date): { id: string; resetAtMs: number } {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return { id: new Date(start).toISOString().slice(0, 10), resetAtMs: start + DAY_MS };
}

/* in-memory minute counters, used only while Redis is unavailable */
const memory = new Map<string, { count: number; resetAtMs: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryTake(key: string, limit: number, resetAtMs: number, nowMs: number): { granted: boolean; used: number } {
  if (memory.size >= MEMORY_MAX_KEYS) {
    for (const [k, v] of memory) if (v.resetAtMs <= nowMs) memory.delete(k);
  }
  const entry = memory.get(key);
  const count = entry && entry.resetAtMs > nowMs ? entry.count : 0;
  if (count >= limit) return { granted: false, used: count };
  memory.set(key, { count: count + 1, resetAtMs });
  return { granted: true, used: count + 1 };
}

function memoryRelease(key: string): void {
  const entry = memory.get(key);
  if (entry && entry.count > 0) entry.count -= 1;
}

interface Taken {
  granted: boolean;
  used: number;
  release: () => Promise<void>;
}

interface TakeArgs {
  scope: "minute" | "day";
  key: string;
  limit: number;
  ttlSeconds: number;
  resetAtMs: number;
  now: Date;
  seed: () => Promise<number>;
}

class QuotaService {
  private limits(feature: QuotaFeature): { minute: number; day: number } {
    void feature;
    return { minute: env.quotas.analysisPerMinute, day: env.quotas.analysisPerDay };
  }

  private keys(feature: QuotaFeature, userId: string, now: Date) {
    const mw = minuteWindow(now);
    const dw = dayWindow(now);
    return {
      mw,
      dw,
      minuteKey: `quota:${feature}:min:${userId}:${mw.id}`,
      dayKey: `quota:${feature}:day:${userId}:${dw.id}`,
    };
  }

  private window(limit: number, used: number, resetAtMs: number): QuotaWindow {
    return { limit, used, remaining: Math.max(0, limit - used), resetAt: new Date(resetAtMs).toISOString() };
  }

  private exceeded(scope: "minute" | "day", limit: number, resetAtMs: number, now: Date): AppError {
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAtMs - now.getTime()) / 1000));
    const quota: QuotaInfo = { scope, limit, remaining: 0, resetAt: new Date(resetAtMs).toISOString() };
    const message =
      scope === "day"
        ? `Daily analysis limit reached (${limit} per day). You can analyze again at ${quota.resetAt}.`
        : `Analysis limit reached (${limit} per minute). Try again in ${retryAfterSeconds}s.`;
    return AppError.quotaExceeded(message, quota, retryAfterSeconds);
  }

  private async take(a: TakeArgs): Promise<Taken> {
    try {
      const redis = getRedisClient();
      let seed = 0;
      if (a.scope === "day" && (await redis.exists(a.key)) === 0) seed = await a.seed();
      const reply = (await redis.eval(RESERVE_SCRIPT, 1, a.key, String(a.limit), String(a.ttlSeconds), String(seed))) as [number, number];
      const granted = Number(reply[0]) === 1;
      return {
        granted,
        used: Number(reply[1]),
        release: async () => {
          if (granted) await redis.eval(RELEASE_SCRIPT, 1, a.key);
        },
      };
    } catch (error) {
      logger.warn("quota: redis unavailable, using fallback", { scope: a.scope, ...serializeError(error) });
      if (a.scope === "minute") {
        const r = memoryTake(a.key, a.limit, a.resetAtMs, a.now.getTime());
        return { granted: r.granted, used: r.used, release: async () => (r.granted ? memoryRelease(a.key) : undefined) };
      }
      const used = await a.seed();
      const granted = used < a.limit;
      return { granted, used: granted ? used + 1 : used, release: async () => undefined };
    }
  }

  /** Takes one unit from the minute and day windows, or throws QUOTA_EXCEEDED (429). */
  async reserve(userId: string, feature: QuotaFeature = "analysis", now: Date = new Date()): Promise<Reservation> {
    const limit = this.limits(feature);
    const { mw, dw, minuteKey, dayKey } = this.keys(feature, userId, now);

    const minute = await this.take({ scope: "minute", key: minuteKey, limit: limit.minute, ttlSeconds: 120, resetAtMs: mw.resetAtMs, now, seed: async () => 0 });
    if (!minute.granted) throw this.exceeded("minute", limit.minute, mw.resetAtMs, now);

    let day: Taken;
    try {
      day = await this.take({
        scope: "day",
        key: dayKey,
        limit: limit.day,
        ttlSeconds: Math.ceil((dw.resetAtMs - now.getTime()) / 1000) + 3600,
        resetAtMs: dw.resetAtMs,
        now,
        seed: async () => (await aiUsageService.today(userId, feature, now))?.requests ?? 0,
      });
    } catch (error) {
      await minute.release();
      throw error;
    }
    if (!day.granted) {
      await minute.release();
      throw this.exceeded("day", limit.day, dw.resetAtMs, now);
    }

    return {
      snapshot: { minute: this.window(limit.minute, minute.used, mw.resetAtMs), day: this.window(limit.day, day.used, dw.resetAtMs) },
      release: async () => {
        await Promise.allSettled([minute.release(), day.release()]);
      },
    };
  }

  private async readUsed(scope: "minute" | "day", key: string, now: Date, seed: () => Promise<number>): Promise<number> {
    try {
      const raw = await getRedisClient().get(key);
      if (raw !== null) return Number(raw) || 0;
      return scope === "day" ? await seed() : 0;
    } catch {
      if (scope === "minute") {
        const entry = memory.get(key);
        return entry && entry.resetAtMs > now.getTime() ? entry.count : 0;
      }
      return seed();
    }
  }

  /** What is left right now, without using anything. */
  async peek(userId: string, feature: QuotaFeature = "analysis", now: Date = new Date()): Promise<QuotaSnapshot> {
    const limit = this.limits(feature);
    const { mw, dw, minuteKey, dayKey } = this.keys(feature, userId, now);
    const [minuteUsed, dayUsed] = await Promise.all([
      this.readUsed("minute", minuteKey, now, async () => 0),
      this.readUsed("day", dayKey, now, async () => (await aiUsageService.today(userId, feature, now))?.requests ?? 0),
    ]);
    return { minute: this.window(limit.minute, minuteUsed, mw.resetAtMs), day: this.window(limit.day, dayUsed, dw.resetAtMs) };
  }
}

export const quotaService = new QuotaService();
