import { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";

export type AiFeature = "explain" | "session" | "analysis";

/**
 * The client IP, as computed by Express from the configured `trust proxy` setting.
 * The forwarded-for request header is never read directly: its first entry is client-controlled.
 */
function clientIp(req: Request): string {
  return req.ip ?? "unknown";
}

/** AI limits are per user; unauthenticated callers fall back to their IP. */
function limiterIdentity(req: Request): string {
  const userId = req.auth?.user.id;
  return userId ? `u:${userId}` : `ip:${clientIp(req)}`;
}

/* ───────────── in-memory fallback (used when Redis is unavailable) ───────────── */

const memory = new Map<string, { count: number; resetAt: number }>();
const MEMORY_MAX_KEYS = 10_000;

function memoryHit(key: string, windowMs: number): { count: number; retryAfterSeconds: number } {
  const now = Date.now();

  if (memory.size >= MEMORY_MAX_KEYS) {
    for (const [k, v] of memory) {
      if (v.resetAt <= now) memory.delete(k);
    }
    if (memory.size >= MEMORY_MAX_KEYS) {
      const oldest = memory.keys().next();
      if (!oldest.done) memory.delete(oldest.value);
    }
  }

  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return { count: 1, retryAfterSeconds: Math.ceil(windowMs / 1000) };
  }
  entry.count += 1;
  return {
    count: entry.count,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

/* ───────────── AI limiter (fixed window, per user, fails closed) ───────────── */

const FIXED_WINDOW_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[1]))
end
return current
`;

export function aiRateLimiter(feature: AiFeature) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identity = limiterIdentity(req);
    const windowSeconds = 3600;
    const windowSlot = Math.floor(Date.now() / (windowSeconds * 1000));
    const key = `rl:ai:${feature}:${identity}:${windowSlot}`;
    const limit = env.redis.aiRateLimitPerHour;

    let count: number;
    let retryAfterSeconds: number;

    try {
      const redis = getRedisClient();
      count = (await redis.eval(FIXED_WINDOW_SCRIPT, 1, key, String(windowSeconds))) as number;
      retryAfterSeconds = count > limit ? Math.max(1, await redis.ttl(key)) : windowSeconds;
    } catch (err) {
      // Never fail open for AI spend: enforce the same limit in memory.
      logger.warn("rate limiter: redis unavailable, using in-memory fallback", {
        feature,
        ...serializeError(err),
      });
      const hit = memoryHit(key, windowSeconds * 1000);
      count = hit.count;
      retryAfterSeconds = hit.retryAfterSeconds;
    }

    if (count > limit) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(
        AppError.tooManyRequests(
          `AI rate limit exceeded. Limit: ${limit}/hour. Retry in ${retryAfterSeconds}s.`,
        ),
      );
      return;
    }

    next();
  };
}

/* ───────────── general limiter (sliding window, per IP) ───────────── */

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local cutoff = now - windowMs
redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs)
return redis.call('ZCARD', key)
`;

export function generalRateLimiter() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = clientIp(req);
    const windowMs = 60_000;
    const limit = env.redis.defaultRateLimitPerMinute;
    const key = `rl:general:${ip}`;
    const now = Date.now();
    const member = `${now}:${process.hrtime.bigint().toString()}`;

    let count: number;
    let retryAfterSeconds = Math.ceil(windowMs / 1000);

    try {
      const redis = getRedisClient();
      count = (await redis.eval(
        SLIDING_WINDOW_SCRIPT,
        1,
        key,
        String(now),
        String(windowMs),
        String(limit),
        member,
      )) as number;
    } catch (err) {
      logger.warn("rate limiter: redis unavailable, using in-memory fallback", serializeError(err));
      const hit = memoryHit(key, windowMs);
      count = hit.count;
      retryAfterSeconds = hit.retryAfterSeconds;
    }

    if (count > limit) {
      res.setHeader("Retry-After", String(retryAfterSeconds));
      next(AppError.tooManyRequests(`Rate limit exceeded. Limit: ${limit} requests/minute.`));
      return;
    }

    next();
  };
}
