import type { z } from "zod";
import { AdminRoleChangeRequestSchema, AdminRoleChangeResponseSchema, AdminUserListQuerySchema, AdminUserListResponseSchema } from "./admin";
import { AlgorithmDetailResponseSchema, AlgorithmExecutionResponseSchema, AlgorithmLangQuerySchema, AlgorithmListQuerySchema, AlgorithmListResponseSchema, CreateAlgorithmRequestSchema, UpdateAlgorithmRequestSchema } from "./algorithms";
import { AnalysisHistoryQuerySchema, AnalysisHistoryResponseSchema, AnalysisRecordResponseSchema, CreateAnalysisRequestSchema, SharedAnalysisResponseSchema, ShareUrlResponseSchema } from "./analysis";
import { MeResponseSchema, RefreshResponseSchema } from "./auth";
import { CategoryListResponseSchema, CategorySchema, CreateCategoryRequestSchema, UpdateCategoryRequestSchema } from "./categories";
import { IdParamsSchema, ShareIdParamsSchema, SlugParamsSchema } from "./common";
import { CreateExplainSessionRequestSchema, ExplainRequestSchema, ExplainResponseSchema, ExplainSessionDetailSchema, ExplainSessionListQuerySchema, ExplainSessionListResponseSchema, SendMessageRequestSchema, SendMessageResponseSchema, SharedExplainSessionResponseSchema } from "./explain";
import { HealthResponseSchema, ReadyResponseSchema } from "./health";

export type HttpMethod = "get" | "post" | "patch" | "delete";
export type AuthLevel = "none" | "optional" | "user" | "admin";
/** "empty" = no JSON body (204 or a redirect). */
export type RouteResponse = z.ZodType | "empty";

export interface RouteDef {
  readonly id: string;
  readonly method: HttpMethod;
  /** OpenAPI style: /api/analysis/{id} (Express: /api/analysis/:id). */
  readonly path: string;
  readonly summary: string;
  readonly tag: string;
  readonly auth: AuthLevel;
  readonly csrf: boolean;
  readonly rateLimit?: "general" | "ai";
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  readonly responses: Readonly<Record<number, RouteResponse>>;
  readonly notes?: string;
}

/** Every endpoint the API serves today. A test fails when this table and the Express routers disagree. */
export const routes: readonly RouteDef[] = [
  { id: "health", method: "get", path: "/health", summary: "Liveness", tag: "Health", auth: "none", csrf: false, responses: { 200: HealthResponseSchema } },
  { id: "ready", method: "get", path: "/ready", summary: "Readiness (database and Redis)", tag: "Health", auth: "none", csrf: false, responses: { 200: ReadyResponseSchema, 503: ReadyResponseSchema } },

  { id: "authGoogleStart", method: "get", path: "/api/auth/google/start", summary: "Start Google sign-in (redirect)", tag: "Auth", auth: "none", csrf: false, responses: { 302: "empty" } },
  { id: "authGoogleCallback", method: "get", path: "/api/auth/google/callback", summary: "Google OAuth callback (redirect to the web app)", tag: "Auth", auth: "none", csrf: false, responses: { 302: "empty" } },
  { id: "authMe", method: "get", path: "/api/auth/me", summary: "Current user", tag: "Auth", auth: "user", csrf: false, responses: { 200: MeResponseSchema }, notes: "Known gap until Phase 4 (A-03): the implementation still returns the public user shape without email and role." },
  { id: "authRefresh", method: "post", path: "/api/auth/refresh", summary: "Rotate the session cookies", tag: "Auth", auth: "none", csrf: false, responses: { 200: RefreshResponseSchema } },
  { id: "authLogout", method: "post", path: "/api/auth/logout", summary: "Sign out this device", tag: "Auth", auth: "none", csrf: true, responses: { 204: "empty" } },
  { id: "authLogoutAll", method: "post", path: "/api/auth/logout-all", summary: "Sign out every device", tag: "Auth", auth: "user", csrf: true, responses: { 204: "empty" } },

  { id: "algorithmsList", method: "get", path: "/api/algorithms", summary: "List algorithms", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", query: AlgorithmListQuerySchema, responses: { 200: AlgorithmListResponseSchema } },
  { id: "algorithmsBySlug", method: "get", path: "/api/algorithms/slug/{slug}", summary: "Algorithm by slug", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: SlugParamsSchema, query: AlgorithmLangQuerySchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsVisualize", method: "get", path: "/api/algorithms/id/{id}/visualize", summary: "Visualization config (legacy forge, replaced by a script in Phase 6)", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: IdParamsSchema, responses: { 200: AlgorithmExecutionResponseSchema } },
  { id: "algorithmsById", method: "get", path: "/api/algorithms/id/{id}", summary: "Algorithm by id", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: IdParamsSchema, query: AlgorithmLangQuerySchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsCreate", method: "post", path: "/api/algorithms", summary: "Create an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", body: CreateAlgorithmRequestSchema, responses: { 201: AlgorithmDetailResponseSchema } },
  { id: "algorithmsUpdate", method: "patch", path: "/api/algorithms/id/{id}", summary: "Update an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", params: IdParamsSchema, body: UpdateAlgorithmRequestSchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsDelete", method: "delete", path: "/api/algorithms/id/{id}", summary: "Delete an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", params: IdParamsSchema, responses: { 204: "empty" } },

  { id: "categoriesList", method: "get", path: "/api/categories", summary: "List categories", tag: "Categories", auth: "none", csrf: false, responses: { 200: CategoryListResponseSchema } },
  { id: "categoriesGet", method: "get", path: "/api/categories/{id}", summary: "Category by id", tag: "Categories", auth: "none", csrf: false, params: IdParamsSchema, responses: { 200: CategorySchema } },
  { id: "categoriesCreate", method: "post", path: "/api/categories", summary: "Create a category", tag: "Categories", auth: "admin", csrf: true, body: CreateCategoryRequestSchema, responses: { 201: CategorySchema } },
  { id: "categoriesUpdate", method: "patch", path: "/api/categories/{id}", summary: "Update a category", tag: "Categories", auth: "admin", csrf: true, params: IdParamsSchema, body: UpdateCategoryRequestSchema, responses: { 200: CategorySchema } },
  { id: "categoriesDelete", method: "delete", path: "/api/categories/{id}", summary: "Delete a category", tag: "Categories", auth: "admin", csrf: true, params: IdParamsSchema, responses: { 204: "empty" } },

  { id: "analysisList", method: "get", path: "/api/analysis", summary: "Analysis history (cursor pagination)", tag: "Analysis", auth: "user", csrf: false, rateLimit: "general", query: AnalysisHistoryQuerySchema, responses: { 200: AnalysisHistoryResponseSchema } },
  { id: "analysisGet", method: "get", path: "/api/analysis/{id}", summary: "One analysis", tag: "Analysis", auth: "user", csrf: false, rateLimit: "general", params: IdParamsSchema, responses: { 200: AnalysisRecordResponseSchema } },
  { id: "analysisCreate", method: "post", path: "/api/analysis", summary: "Analyze code", tag: "Analysis", auth: "user", csrf: true, rateLimit: "ai", body: CreateAnalysisRequestSchema, responses: { 201: AnalysisRecordResponseSchema } },
  { id: "analysisShare", method: "post", path: "/api/analysis/{id}/share", summary: "Make an analysis public", tag: "Analysis", auth: "user", csrf: true, rateLimit: "general", params: IdParamsSchema, responses: { 200: ShareUrlResponseSchema } },

  { id: "explain", method: "post", path: "/api/explain", summary: "One-shot explanation", tag: "Explain", auth: "user", csrf: true, rateLimit: "ai", body: ExplainRequestSchema, responses: { 200: ExplainResponseSchema } },
  { id: "explainSessionsList", method: "get", path: "/api/explain-sessions", summary: "List chat sessions (cursor pagination)", tag: "Explain", auth: "user", csrf: false, query: ExplainSessionListQuerySchema, responses: { 200: ExplainSessionListResponseSchema } },
  { id: "explainSessionsCreate", method: "post", path: "/api/explain-sessions", summary: "Create a chat session", tag: "Explain", auth: "user", csrf: true, body: CreateExplainSessionRequestSchema, responses: { 201: ExplainSessionDetailSchema } },
  { id: "explainSessionsGet", method: "get", path: "/api/explain-sessions/{id}", summary: "One chat session", tag: "Explain", auth: "user", csrf: false, params: IdParamsSchema, responses: { 200: ExplainSessionDetailSchema } },
  { id: "explainSessionsDelete", method: "delete", path: "/api/explain-sessions/{id}", summary: "Delete a chat session", tag: "Explain", auth: "user", csrf: true, params: IdParamsSchema, responses: { 204: "empty" } },
  { id: "explainSessionsMessage", method: "post", path: "/api/explain-sessions/{id}/messages", summary: "Send a message", tag: "Explain", auth: "user", csrf: true, rateLimit: "ai", params: IdParamsSchema, body: SendMessageRequestSchema, responses: { 201: SendMessageResponseSchema } },
  { id: "explainSessionsShare", method: "post", path: "/api/explain-sessions/{id}/share", summary: "Make a chat session public", tag: "Explain", auth: "user", csrf: true, params: IdParamsSchema, responses: { 200: ShareUrlResponseSchema } },

  { id: "shareAnalysis", method: "get", path: "/api/share/analysis/{shareId}", summary: "Public analysis", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedAnalysisResponseSchema } },
  { id: "shareExplain", method: "get", path: "/api/share/explain/{shareId}", summary: "Public chat session", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedExplainSessionResponseSchema } },
  { id: "shareLegacy", method: "get", path: "/api/share/{shareId}", summary: "Public analysis (legacy alias)", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedAnalysisResponseSchema }, notes: "Legacy alias of /api/share/analysis/{shareId}; removed in Phase 9." },

  { id: "adminUsers", method: "get", path: "/api/admin/users", summary: "List users (cursor pagination)", tag: "Admin", auth: "admin", csrf: false, query: AdminUserListQuerySchema, responses: { 200: AdminUserListResponseSchema } },
  { id: "adminUpgrade", method: "post", path: "/api/admin/upgrade-user", summary: "Promote a user to ADMIN", tag: "Admin", auth: "admin", csrf: true, body: AdminRoleChangeRequestSchema, responses: { 200: AdminRoleChangeResponseSchema } },
  { id: "adminDowngrade", method: "post", path: "/api/admin/downgrade-user", summary: "Demote a user to USER", tag: "Admin", auth: "admin", csrf: true, body: AdminRoleChangeRequestSchema, responses: { 200: AdminRoleChangeResponseSchema } },
];

export const toExpressPath = (path: string): string => path.replace(/\{(\w+)\}/g, ":$1");
