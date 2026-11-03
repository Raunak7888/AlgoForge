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

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories(), queryFn: ({ signal }) => endpoints.categories(signal) });
}

export function useExplainSessions(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.explainSessions(), queryFn: ({ signal }) => endpoints.explainSessions({}, signal), enabled: options.enabled ?? true });
}
