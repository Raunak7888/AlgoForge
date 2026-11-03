/**
 * All cache key builders for algorithms in one place.
 *
 * Every key embeds:
 *   - the namespace version (see services/lib/cache-version.ts), so a write invalidates all keys, and
 *   - the visibility scope, so a draft cached for an admin can never be served to the public.
 */
export type CacheScope = "public" | "admin";

export const ALGO_CACHE_NAMESPACE = "algo";

export const algorithmCacheKeys = {
  list:   (v: number, scope: CacheScope, query: object)                => `algo:v${v}:${scope}:list:${JSON.stringify(query)}`,
  byId:   (v: number, scope: CacheScope, id: string,   lang = "default") => `algo:v${v}:${scope}:id:${id}:${lang}`,
  bySlug: (v: number, scope: CacheScope, slug: string, lang = "default") => `algo:v${v}:${scope}:slug:${slug}:${lang}`,
  viz:    (v: number, scope: CacheScope, id: string)                   => `viz:v${v}:${scope}:${id}`,
};
