import {
  AlgorithmDetailResponseSchema,
  AlgorithmListResponseSchema,
  AnalysisHistoryResponseSchema,
  AnalysisQuotaResponseSchema,
  AnalysisRecordResponseSchema,
  CapabilitiesResponseSchema,
  CategoryListResponseSchema,
  DeviceSessionListResponseSchema,
  ExplainSessionDetailSchema,
  ExplainSessionListResponseSchema,
  ExplainSessionSummarySchema,
  SendMessageResponseSchema,
  MeResponseSchema,
  SearchResponseSchema,
  ValidateScriptResponseSchema,
  VisualizationListResponseSchema,
  VisualizationSchema,
  type AlgorithmDetailResponse,
  type AlgorithmListQuery,
  type AlgorithmListResponse,
  type AnalysisHistoryQuery,
  type AnalysisHistoryResponse,
  type AnalysisQuotaResponse,
  type AnalysisRecordResponse,
  type CapabilitiesResponse,
  type CategoryListResponse,
  type CreateAnalysisRequest,
  type CreateVisualizationRequest,
  type CreateExplainSessionRequest,
  type ExplainSessionDetail,
  type ExplainSessionListResponse,
  type ExplainSessionSummary,
  type SendMessageRequest,
  type SendMessageResponse,
  type UpdateExplainSessionRequest,
  type MeResponse,
  type SearchResponse,
  type UpdateProfileRequest,
  type UpdateVisualizationRequest,
  type ValidateScriptResponse,
  type Visualization,
  type VisualizationListResponse,
} from "@algoforge/contracts";
import { z } from "zod";
import { apiClient, type ApiClient } from "./client";

export interface PageParams {
  limit?: number;
  cursor?: string;
}

export type DeviceSessionListResponse = z.infer<typeof DeviceSessionListResponseSchema>;

const opt = (signal?: AbortSignal) => (signal ? { signal } : {});
const seg = encodeURIComponent;

/** Typed endpoint functions. Every response is validated against the shared schema. */
export function createEndpoints(client: ApiClient) {
  return {
    me: (signal?: AbortSignal): Promise<MeResponse> => client.get("/api/auth/me", MeResponseSchema, opt(signal)),
    capabilities: (signal?: AbortSignal): Promise<CapabilitiesResponse> => client.get("/api/meta/capabilities", CapabilitiesResponseSchema, opt(signal)),
    sessions: (signal?: AbortSignal): Promise<DeviceSessionListResponse> => client.get("/api/auth/sessions", DeviceSessionListResponseSchema, opt(signal)),
    revokeSession: (id: string): Promise<void> => client.delete(`/api/auth/sessions/${seg(id)}`),
    updateProfile: (body: UpdateProfileRequest): Promise<MeResponse> => client.patch("/api/users/me", MeResponseSchema, body),
    deleteAccount: (): Promise<void> => client.delete("/api/users/me"),
    logout: (): Promise<void> => client.postEmpty("/api/auth/logout"),
    logoutAll: (): Promise<void> => client.postEmpty("/api/auth/logout-all"),

    analysisHistory: (params: AnalysisHistoryQuery = {}, signal?: AbortSignal): Promise<AnalysisHistoryResponse> =>
      client.get("/api/analysis", AnalysisHistoryResponseSchema, { query: { ...params }, ...opt(signal) }),
    analysis: (id: string, signal?: AbortSignal): Promise<AnalysisRecordResponse> =>
      client.get(`/api/analysis/${seg(id)}`, AnalysisRecordResponseSchema, opt(signal)),
    createAnalysis: (body: CreateAnalysisRequest): Promise<AnalysisRecordResponse> => client.post("/api/analysis", AnalysisRecordResponseSchema, body),
    deleteAnalysis: (id: string): Promise<void> => client.delete(`/api/analysis/${seg(id)}`),
    analysisQuota: (signal?: AbortSignal): Promise<AnalysisQuotaResponse> => client.get("/api/analysis/quota", AnalysisQuotaResponseSchema, opt(signal)),

    categories: (signal?: AbortSignal): Promise<CategoryListResponse> => client.get("/api/categories", CategoryListResponseSchema, opt(signal)),
    explainSessions: (params: PageParams = {}, signal?: AbortSignal): Promise<ExplainSessionListResponse> =>
      client.get("/api/explain-sessions", ExplainSessionListResponseSchema, { query: { ...params }, ...opt(signal) }),
    explainSession: (id: string, signal?: AbortSignal): Promise<ExplainSessionDetail> =>
      client.get(`/api/explain-sessions/${seg(id)}`, ExplainSessionDetailSchema, opt(signal)),
    createExplainSession: (body: CreateExplainSessionRequest = {}): Promise<ExplainSessionDetail> => client.post("/api/explain-sessions", ExplainSessionDetailSchema, body),
    renameExplainSession: (id: string, body: UpdateExplainSessionRequest): Promise<ExplainSessionSummary> =>
      client.patch(`/api/explain-sessions/${seg(id)}`, ExplainSessionSummarySchema, body),
    deleteExplainSession: (id: string): Promise<void> => client.delete(`/api/explain-sessions/${seg(id)}`),
    sendExplainMessage: (id: string, body: SendMessageRequest): Promise<SendMessageResponse> =>
      client.post(`/api/explain-sessions/${seg(id)}/messages`, SendMessageResponseSchema, body),

    algorithms: (params: AlgorithmListQuery = {}, signal?: AbortSignal): Promise<AlgorithmListResponse> =>
      client.get("/api/algorithms", AlgorithmListResponseSchema, { query: { ...params }, ...opt(signal) }),
    algorithmBySlug: (slug: string, signal?: AbortSignal): Promise<AlgorithmDetailResponse> =>
      client.get(`/api/algorithms/slug/${seg(slug)}`, AlgorithmDetailResponseSchema, opt(signal)),

    search: (q: string, signal?: AbortSignal): Promise<SearchResponse> => client.get("/api/search", SearchResponseSchema, { query: { q }, ...opt(signal) }),

    visualizations: (params: PageParams = {}, signal?: AbortSignal): Promise<VisualizationListResponse> =>
      client.get("/api/visualizations", VisualizationListResponseSchema, { query: { ...params }, ...opt(signal) }),
    visualization: (id: string, signal?: AbortSignal): Promise<Visualization> => client.get(`/api/visualizations/${seg(id)}`, VisualizationSchema, opt(signal)),
    createVisualization: (body: CreateVisualizationRequest): Promise<Visualization> => client.post("/api/visualizations", VisualizationSchema, body),
    updateVisualization: (id: string, body: UpdateVisualizationRequest): Promise<Visualization> =>
      client.patch(`/api/visualizations/${seg(id)}`, VisualizationSchema, body),
    deleteVisualization: (id: string): Promise<void> => client.delete(`/api/visualizations/${seg(id)}`),
    validateScript: (script: string, signal?: AbortSignal): Promise<ValidateScriptResponse> =>
      client.post("/api/visualizations/validate", ValidateScriptResponseSchema, { script }, opt(signal)),
  };
}

export const endpoints = createEndpoints(apiClient);
