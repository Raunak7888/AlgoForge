import {
  AlgorithmListResponseSchema,
  AnalysisHistoryResponseSchema,
  CapabilitiesResponseSchema,
  CategoryListResponseSchema,
  DeviceSessionListResponseSchema,
  ExplainSessionListResponseSchema,
  MeResponseSchema,
  type AlgorithmListQuery,
  type AlgorithmListResponse,
  type AnalysisHistoryResponse,
  type CapabilitiesResponse,
  type CategoryListResponse,
  type ExplainSessionListResponse,
  type MeResponse,
  type UpdateProfileRequest,
} from "@algoforge/contracts";
import { z } from "zod";
import { apiClient, type ApiClient } from "./client";

export interface PageParams {
  limit?: number;
  cursor?: string;
}

export type DeviceSessionListResponse = z.infer<typeof DeviceSessionListResponseSchema>;

/** Typed endpoint functions. Every response is validated against the shared schema. */
export function createEndpoints(client: ApiClient) {
  return {
    me: (signal?: AbortSignal): Promise<MeResponse> =>
      client.get("/api/auth/me", MeResponseSchema, signal ? { signal } : {}),
    capabilities: (signal?: AbortSignal): Promise<CapabilitiesResponse> =>
      client.get("/api/meta/capabilities", CapabilitiesResponseSchema, signal ? { signal } : {}),
    sessions: (signal?: AbortSignal): Promise<DeviceSessionListResponse> =>
      client.get("/api/auth/sessions", DeviceSessionListResponseSchema, signal ? { signal } : {}),
    revokeSession: (id: string): Promise<void> => client.delete(`/api/auth/sessions/${encodeURIComponent(id)}`),
    updateProfile: (body: UpdateProfileRequest): Promise<MeResponse> => client.patch("/api/users/me", MeResponseSchema, body),
    deleteAccount: (): Promise<void> => client.delete("/api/users/me"),
    logout: (): Promise<void> => client.postEmpty("/api/auth/logout"),
    logoutAll: (): Promise<void> => client.postEmpty("/api/auth/logout-all"),

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
