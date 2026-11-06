import type { z } from "zod";
import { AdminRoleChangeRequestSchema, AdminRoleChangeResponseSchema, AdminUserListResponseSchema, AdminUserSchema } from "./admin";
import { AlgorithmDetailResponseSchema, AlgorithmExecutionResponseSchema, AlgorithmListResponseSchema, AlgorithmSummarySchema, CreateAlgorithmRequestSchema, UpdateAlgorithmRequestSchema } from "./algorithms";
import { AnalysisQuotaResponseSchema, AnalysisHistoryItemSchema, AnalysisHistoryResponseSchema, AnalysisRecordResponseSchema, AnalysisResultSchema, CreateAnalysisRequestSchema, SharedAnalysisResponseSchema, ShareUrlResponseSchema } from "./analysis";
import { AuthUserSchema, MeResponseSchema } from "./auth";
import { CapabilitiesResponseSchema } from "./capabilities";
import { CategoryListResponseSchema, CategorySchema, CreateCategoryRequestSchema, UpdateCategoryRequestSchema } from "./categories";
import { PageMetaSchema } from "./common";
import { ErrorResponseSchema } from "./errors";
import { CreateExplainSessionRequestSchema, ExplainRequestSchema, ExplainResponseSchema, ExplainSessionDetailSchema, ExplainSessionListResponseSchema, ExplainSessionSummarySchema, SendMessageRequestSchema, SendMessageResponseSchema, SessionMessageSchema, SharedExplainSessionResponseSchema } from "./explain";
import { HealthResponseSchema, ReadyResponseSchema } from "./health";
import { CreateShareRequestSchema, PublicShareResponseSchema, ShareSchema } from "./shares";
import { DeviceSessionListResponseSchema, DeviceSessionSchema, SafeUserSchema, UpdateProfileRequestSchema } from "./users";
import { CreateVisualizationRequestSchema, UpdateVisualizationRequestSchema, ValidateScriptRequestSchema, ValidateScriptResponseSchema, VisualizationSchema } from "./visualizations";

/** Named schemas published under components.schemas. A name ending in "Request" is documented by its input shape. */
export const SCHEMA_REGISTRY = {
  ErrorResponse: ErrorResponseSchema,
  PageMeta: PageMetaSchema,
  AuthUser: AuthUserSchema,
  MeResponse: MeResponseSchema,
  SafeUser: SafeUserSchema,
  UpdateProfileRequest: UpdateProfileRequestSchema,
  DeviceSession: DeviceSessionSchema,
  DeviceSessionListResponse: DeviceSessionListResponseSchema,
  AlgorithmSummary: AlgorithmSummarySchema,
  AlgorithmDetailResponse: AlgorithmDetailResponseSchema,
  AlgorithmListResponse: AlgorithmListResponseSchema,
  AlgorithmExecutionResponse: AlgorithmExecutionResponseSchema,
  CreateAlgorithmRequest: CreateAlgorithmRequestSchema,
  UpdateAlgorithmRequest: UpdateAlgorithmRequestSchema,
  Category: CategorySchema,
  CategoryListResponse: CategoryListResponseSchema,
  CreateCategoryRequest: CreateCategoryRequestSchema,
  UpdateCategoryRequest: UpdateCategoryRequestSchema,
  AnalysisResult: AnalysisResultSchema,
  CreateAnalysisRequest: CreateAnalysisRequestSchema,
  AnalysisRecordResponse: AnalysisRecordResponseSchema,
  AnalysisHistoryItem: AnalysisHistoryItemSchema,
  AnalysisHistoryResponse: AnalysisHistoryResponseSchema,
  SharedAnalysisResponse: SharedAnalysisResponseSchema,
  ShareUrlResponse: ShareUrlResponseSchema,
  AnalysisQuotaResponse: AnalysisQuotaResponseSchema,
  SessionMessage: SessionMessageSchema,
  ExplainSessionSummary: ExplainSessionSummarySchema,
  ExplainSessionDetail: ExplainSessionDetailSchema,
  ExplainSessionListResponse: ExplainSessionListResponseSchema,
  CreateExplainSessionRequest: CreateExplainSessionRequestSchema,
  SendMessageRequest: SendMessageRequestSchema,
  SendMessageResponse: SendMessageResponseSchema,
  SharedExplainSessionResponse: SharedExplainSessionResponseSchema,
  ExplainRequest: ExplainRequestSchema,
  ExplainResponse: ExplainResponseSchema,
  Visualization: VisualizationSchema,
  CreateVisualizationRequest: CreateVisualizationRequestSchema,
  UpdateVisualizationRequest: UpdateVisualizationRequestSchema,
  ValidateScriptRequest: ValidateScriptRequestSchema,
  ValidateScriptResponse: ValidateScriptResponseSchema,
  Share: ShareSchema,
  CreateShareRequest: CreateShareRequestSchema,
  PublicShareResponse: PublicShareResponseSchema,
  CapabilitiesResponse: CapabilitiesResponseSchema,
  AdminUser: AdminUserSchema,
  AdminUserListResponse: AdminUserListResponseSchema,
  AdminRoleChangeRequest: AdminRoleChangeRequestSchema,
  AdminRoleChangeResponse: AdminRoleChangeResponseSchema,
  HealthResponse: HealthResponseSchema,
  ReadyResponse: ReadyResponseSchema,
} as const satisfies Record<string, z.ZodType>;
