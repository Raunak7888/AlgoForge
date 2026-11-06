/**
 * Layered cache — L1 (LRU) + L2 (Redis).
 *
 * Read path:
 *   1. Check LRU — return immediately on hit (no network).
 *   2. Check Redis — warm LRU on hit using the remaining Redis TTL, then return.
 *      (Using remaining TTL prevents L1 from serving data after L2 has expired it.)
 *   3. Return null (caller fetches from source of truth).
 *
 * Write path: write to both layers atomically (LRU first, then Redis).
 * Delete path: evict from both layers.
 */
import { lruCache } from "./lru.cache";
import { redisCache } from "./redis.cache";
import { env } from "../../config/env";

const DEFAULT_TTL_SECONDS = env.redis.ttlSeconds;

export const layeredCache = {
  async get<T>(key: string): Promise<T | null> {
    // L1 hit
    const l1 = lruCache.get(key);
    if (l1 !== null) return JSON.parse(l1) as T;

    // L2 hit — warm L1 for the next request on this instance.
    // Use the remaining Redis TTL so L1 never outlives L2.
    const l2 = await redisCache.get(key);
    if (l2 !== null) {
      const remainingTtlSeconds = await redisCache.getTtl(key);
      const ttlMs =
        remainingTtlSeconds > 0
          ? remainingTtlSeconds * 1000
          : DEFAULT_TTL_SECONDS * 1000;
      lruCache.set(key, l2, ttlMs);
      return JSON.parse(l2) as T;
    }

    return null;
  },

  async set(key: string, value: unknown, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<void> {
    const serialised = JSON.stringify(value);
    lruCache.set(key, serialised, ttlSeconds * 1000);
    await redisCache.set(key, serialised, ttlSeconds);
  },

  async del(key: string): Promise<void> {
    lruCache.del(key);
    await redisCache.del(key);
  },
};