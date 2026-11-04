"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LIMITS, type AlgorithmListQuery } from "@algoforge/contracts";
import { endpoints } from "../api/endpoints";
import { queryKeys } from "./keys";

/** History pages follow meta.nextCursor until meta.hasMore is false. */
export function useAnalysisHistory(options: { enabled?: boolean; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? LIMITS.pagination.analysisHistory.defaultSize;
  return useInfiniteQuery({
    queryKey: [...queryKeys.analysisHistory(), pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.analysisHistory({ limit: pageSize, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    enabled: options.enabled ?? true,
  });
}

export function useAlgorithms(params: AlgorithmListQuery = {}) {
  return useQuery({ queryKey: queryKeys.algorithms(params), queryFn: ({ signal }) => endpoints.algorithms(params, signal) });
}

/** The public catalog: search, filters and "load more" by cursor. */
export function useAlgorithmCatalog(params: Omit<AlgorithmListQuery, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.algorithmCatalog(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.algorithms({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
  });
}

export function useAlgorithm(slug: string) {
  return useQuery({ queryKey: queryKeys.algorithm(slug), queryFn: ({ signal }) => endpoints.algorithmBySlug(slug, signal), retry: false });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories(), queryFn: ({ signal }) => endpoints.categories(signal) });
}

export function useVisualizations(options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.visualizations(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.visualizations({ limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    enabled: options.enabled ?? true,
  });
}

export function useExplainSessions(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.explainSessions(), queryFn: ({ signal }) => endpoints.explainSessions({}, signal), enabled: options.enabled ?? true });
}

/** What the server can do right now. This, not an environment flag, decides "available" versus "not available". */
export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: ({ signal }) => endpoints.capabilities(signal),
    staleTime: 5 * 60_000,
  });
}
