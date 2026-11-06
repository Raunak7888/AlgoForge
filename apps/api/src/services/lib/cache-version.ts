/**
 * Namespace version counters for cache invalidation.
 *
 * Cache keys embed the current version of their namespace. Bumping the version makes every
 * older key unreachable on EVERY instance (the version lives in Redis and is read per lookup),
 * including entries already sitting in a per-instance L1 cache. Stale entries then age out of
 * the LRU. This replaces per-key deletion, which could never reach other instances' L1.
 *
 * If Redis is unavailable, a per-process counter is used (single-instance behavior).
 */
import { getRedisClient } from "../../config/redis";

const local = new Map<string, number>();
const redisKey = (namespace: string) => `cachever:${namespace}`;

export async function getCacheVersion(namespace: string): Promise<number> {
  try {
    const raw = await getRedisClient().get(redisKey(namespace));
    if (raw === null) return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return local.get(namespace) ?? 0;
  }
}

export async function bumpCacheVersion(namespace: string): Promise<void> {
  local.set(namespace, (local.get(namespace) ?? 0) + 1);
  try {
    await getRedisClient().incr(redisKey(namespace));
  } catch {
    // local counter only
  }
}
