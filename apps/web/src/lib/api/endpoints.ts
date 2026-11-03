import {
  AlgorithmListResponseSchema,
  AnalysisHistoryResponseSchema,
  CategoryListResponseSchema,
  ExplainSessionListResponseSchema,
  type AlgorithmListQuery,
  type AlgorithmListResponse,
  type AnalysisHistoryResponse,
  type CategoryListResponse,
  type ExplainSessionListResponse,
} from "@algoforge/contracts";
import { apiClient, type ApiClient } from "./client";

export interface PageParams {
  limit?: number;
  cursor?: string;
}

/** Typed endpoint functions. Every response is validated against the shared schema. */
export function createEndpoints(client: ApiClient) {
  return {
    analysisHistory: (params: PageParams = {}, signal?: AbortSignal): Promise<AnalysisHistoryResponse> =>
      client.get("/api/analysis", AnalysisHistoryResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
    algorithms: (params: AlgorithmListQuery = {}, signal?: AbortSignal): Promise<AlgorithmListResponse> =>
      client.get("/api/algorithms", AlgorithmListResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
    categories: (signal?: AbortSignal): Promise<CategoryListResponse> =>
      client.get("/api/categories", CategoryListResponseSchema, signal ? { signal } : {}),
    explainSessions: (params: PageParams = {}, signal?: AbortSignal): Promise<ExplainSessionListResponse> =>
      client.get("/api/explain-sessions", ExplainSessionListResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
  };
}

export const endpoints = createEndpoints(apiClient);
