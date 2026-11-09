"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LIMITS, type AlgorithmListQuery, type AnalysisLanguage } from "@algoforge/contracts";
import { endpoints } from "../api/endpoints";
import { queryKeys } from "./keys";
import type { ShareTarget } from "../share/target";

export interface AnalysisHistoryOptions {
  enabled?: boolean;
  pageSize?: number;
  /** Server-side search over title, suggestion and complexity. */
  q?: string;
  language?: AnalysisLanguage;
  sort?: "newest" | "oldest";
}

/** History pages follow meta.nextCursor until meta.hasMore is false. Filters are applied by the server. */
export function useAnalysisHistory(options: AnalysisHistoryOptions = {}) {
  const pageSize = options.pageSize ?? LIMITS.pagination.analysisHistory.defaultSize;
  const filters = {
    ...(options.q ? { q: options.q } : {}),
    ...(options.language ? { language: options.language } : {}),
    ...(options.sort && options.sort !== "newest" ? { sort: options.sort } : {}),
  };
  return useInfiniteQuery({
    queryKey: queryKeys.analysisHistory({ pageSize, ...filters }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.analysisHistory({ limit: pageSize, ...filters, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One saved analysis, including its code (used to reopen it). */
export function useAnalysis(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysisDetail(id),
    queryFn: ({ signal }) => endpoints.analysis(id, signal),
    enabled: enabled && id !== "",
    retry: false,
  });
}

/** What is left of the per-minute and per-day analysis quota. Polls while the minute window is used up. */
export function useAnalysisQuota(enabled = true) {
  return useQuery({
    queryKey: queryKeys.analysisQuota(),
    queryFn: ({ signal }) => endpoints.analysisQuota(signal),
    enabled,
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data && query.state.data.minute.remaining <= 0 ? 15_000 : false),
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
/** The active share of one of my items. Disabled until there is a target. */
export function useTargetShares(target: ShareTarget | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.shares(target?.type ?? "", target?.id ?? ""),
    queryFn: ({ signal }) => endpoints.shares({ type: target!.type, targetId: target!.id }, signal),
    enabled: enabled && target !== null,
    retry: false,
  });
}

/** Anonymous. A 404 (revoked, unknown) is final, so no retry. */
export function usePublicShare(shareId: string) {
  return useQuery({
    queryKey: queryKeys.publicShare(shareId),
    queryFn: ({ signal }) => endpoints.publicShare(shareId, signal),
    enabled: shareId !== "",
    retry: false,
    staleTime: 0,
  });
}
