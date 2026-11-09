import type { AlgorithmListQuery } from "@algoforge/contracts";

/** One place for every cache key, so invalidation stays predictable. */
export const queryKeys = {
  me: () => ["auth", "me"] as const,
  deviceSessions: () => ["auth", "sessions"] as const,
  capabilities: () => ["meta", "capabilities"] as const,
  analysisHistory: (params: Record<string, unknown> = {}) => ["analysis", "history", params] as const,
  analysisDetail: (id: string) => ["analysis", "detail", id] as const,
  analysisQuota: () => ["analysis", "quota"] as const,
  algorithms: (params: AlgorithmListQuery = {}) => ["algorithms", "list", params] as const,
  algorithmCatalog: (params: AlgorithmListQuery = {}) => ["algorithms", "catalog", params] as const,
  algorithm: (slug: string) => ["algorithms", "detail", slug] as const,
  categories: () => ["categories", "list"] as const,
  explainSessions: () => ["explain", "sessions"] as const,
  visualizations: () => ["visualizations", "list"] as const,
  shares: (type: string, targetId: string) => ["shares", type, targetId] as const,
  publicShare: (shareId: string) => ["share", "public", shareId] as const,
};
