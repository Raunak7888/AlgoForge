/**
 * Analysis service.
 *
 * Caching (two layers, LRU + Redis): the AI result is keyed by (prompt version, language, code hash),
 * so identical submissions never hit the provider twice and a prompt change never serves stale output.
 * Only uncached (billable) calls use quota; the quota is returned when the AI call fails.
 * The DB record is always written.
 */
import { randomBytes } from "crypto";
import type { Prisma } from "@algoforge/db";
import {
  ANALYSIS_RESULT_SCHEMA_VERSION,
  wrapStoredAnalysisResult,
  type AnalysisQuotaResponse,
  type AnalysisResult,
  type SharedAnalysisResponse,
} from "@algoforge/contracts";
import { env } from "../config/env";
import { ANALYSIS_PROMPT_VERSION } from "../prompts/analysis.prompt";
import { analysisRepository } from "../repositories/analysis.repository";
import { serializeSharedAnalysis } from "../serializers/analysis";
import { AppError } from "../utils/app-error";
import { analysisCacheKey, deriveTitle, hashCode } from "../utils/ai-cache-keys";
import { logger, serializeError } from "../utils/logger";
import { paginate } from "../utils/pagination";
import { encodeAnalysisCursor, type AnalysisHistoryQuery, type AnalysisInput } from "../validation/analysis";
import { aiService } from "./ai.service";
import { aiUsageService } from "./ai-usage.service";
import { layeredCache } from "./lib/layered-cache";
import { quotaService } from "./quota.service";

interface CachedAnalysis {
  result: AnalysisResult;
  model: string;
}

function generateShareId(): string {
  return randomBytes(9).toString("base64url");
}

class AnalysisService {
  async createAnalysis(userId: string, input: AnalysisInput) {
    const started = Date.now();
    const key = analysisCacheKey(input.language, hashCode(input.code), ANALYSIS_PROMPT_VERSION);

    let entry = await layeredCache.get<CachedAnalysis>(key);

    if (!entry) {
      const reservation = await quotaService.reserve(userId, "analysis");
      try {
        const out = await aiService.analyzeCode({ code: input.code, language: input.language });
        entry = { result: out.result, model: out.model };
      } catch (error) {
        await reservation.release();
        throw error;
      }
      await layeredCache.set(key, entry);
      try {
        await aiUsageService.record(userId, "analysis");
      } catch (error) {
        logger.warn("ai usage could not be recorded", { userId, ...serializeError(error) });
      }
    }

    const { result, model } = entry;
    return analysisRepository.create({
      userId,
      code: input.code,
      language: input.language,
      title: deriveTitle(result.summary, input.code),
      complexity: result.complexity?.time?.average ?? null,
      suggestion: result.improvements?.[0]?.suggestion ?? null,
      model,
      promptVersion: ANALYSIS_PROMPT_VERSION,
      schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION,
      latencyMs: Date.now() - started,
      result: wrapStoredAnalysisResult(result) as unknown as Prisma.InputJsonValue,
    });
  }

  async listUserAnalyses(userId: string, query: AnalysisHistoryQuery) {
    // One extra row proves whether another page exists.
    const rows = await analysisRepository.findManyByUser(userId, {
      take: query.limit + 1,
      sort: query.sort,
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId,
      q: query.q,
      language: query.language,
    });
    return paginate(rows, query.limit, (row) =>
      encodeAnalysisCursor({ createdAt: row.createdAt.toISOString(), id: row.id, sort: query.sort }),
    );
  }

  async getUserAnalysisById(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findOneByUser(userId, analysisId);
    if (!analysis) throw AppError.notFound("Analysis not found.");
    return analysis;
  }

  async deleteAnalysis(userId: string, analysisId: string): Promise<void> {
    const removed = await analysisRepository.deleteByUser(analysisId, userId);
    if (removed === 0) throw AppError.notFound("Analysis not found.");
  }

  async getQuota(userId: string): Promise<AnalysisQuotaResponse> {
    const snapshot = await quotaService.peek(userId, "analysis");
    return { minute: snapshot.minute, day: snapshot.day };
  }

  async shareAnalysis(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findForShare(analysisId, userId);
    if (!analysis) throw AppError.notFound("Analysis not found.");

    // Idempotent: return the existing share URL if already public.
    if (analysis.shareId && analysis.isPublic) {
      return { shareUrl: `${env.webAppUrl}/share/analysis/${analysis.shareId}` };
    }

    const shareId = generateShareId();
    await analysisRepository.setPublic(analysisId, userId, shareId);
    return { shareUrl: `${env.webAppUrl}/share/analysis/${shareId}` };
  }

  async getPublicAnalysis(shareId: string): Promise<SharedAnalysisResponse> {
    const analysis = await analysisRepository.findPublicByShareId(shareId);
    if (!analysis) throw AppError.notFound("Analysis not found or not public.");
    return serializeSharedAnalysis(analysis);
  }
}

export const analysisService = new AnalysisService();
