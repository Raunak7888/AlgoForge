import type { AlgorithmListQuery } from "@algoforge/contracts";

/** One place for every cache key, so invalidation stays predictable. */
export const queryKeys = {
  me: () => ["auth", "me"] as const,
  deviceSessions: () => ["auth", "sessions"] as const,
  capabilities: () => ["meta", "capabilities"] as const,
  analysisHistory: () => ["analysis", "history"] as const,
  algorithms: (params: AlgorithmListQuery = {}) => ["algorithms", "list", params] as const,
  categories: () => ["categories", "list"] as const,
  explainSessions: () => ["explain", "sessions"] as const,
};
