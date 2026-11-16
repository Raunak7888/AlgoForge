import { NextFunction, Request, Response } from "express";
import { getRedisClient } from "../config/redis";
import { env } from "../config/env";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";

/**
 * The client IP, as computed by Express from the configured `trust proxy` setting.
 * The forwarded-for request header is never read directly: its first entry is client-controlled.
 * (AI spend is limited per user by quota.service, not by this middleware.)
 */
function clientIp(req: Request): string {
  return req.ip ?? "unknown";
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

export function generalRateLimiter(options: { scope?: string; limitPerMinute?: number } = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = clientIp(req);
    const windowMs = 60_000;
    const limit = options.limitPerMinute ?? env.redis.defaultRateLimitPerMinute;
    const key = `rl:${options.scope ?? "general"}:${ip}`;
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
