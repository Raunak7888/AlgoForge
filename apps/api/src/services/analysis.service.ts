/**
 * Analysis service.
 *
 * Cache strategy (two-layer LRU + Redis):
 *   - AI result is cached by SHA-256 of (language + code) so identical
 *     submissions never hit the AI provider twice.
 *   - The DB record is always written; cache only shields the AI call.
 *
 * Stored results are versioned ({ schemaVersion, data }); reading them is tolerant (see contracts).
 */
import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@algoforge/db";
import { wrapStoredAnalysisResult, type AnalysisResult, type SharedAnalysisResponse } from "@algoforge/contracts";
import { env } from "../config/env";
import { analysisRepository } from "../repositories/analysis.repository";
import { serializeSharedAnalysis } from "../serializers/analysis";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";
import { encodeAnalysisCursor, type AnalysisHistoryQuery, type AnalysisInput } from "../validation/analysis";
import { aiService } from "./ai.service";
import { layeredCache } from "./lib/layered-cache";

function aiCacheKey(language: string, code: string): string {
  const hash = createHash("sha256").update(`${language}:${code}`).digest("hex").slice(0, 32);
  return `ai:analysis:${hash}`;
}

function generateShareId(): string {
  return randomBytes(9).toString("base64url");
}

class AnalysisService {
  async createAnalysis(userId: string, input: AnalysisInput) {
    const key = aiCacheKey(input.language, input.code);

    let aiResult = await layeredCache.get<AnalysisResult>(key);

    if (!aiResult) {
      aiResult = await aiService.analyzeCode({ code: input.code, language: input.language });
      await layeredCache.set(key, aiResult);
    }

    return analysisRepository.create({
      userId,
      code: input.code,
      language: input.language,
      complexity: aiResult.complexity?.time?.average ?? null,
      suggestion: aiResult.improvements?.[0]?.suggestion ?? null,
      result: wrapStoredAnalysisResult(aiResult) as unknown as Prisma.InputJsonValue,
    });
  }

  async listUserAnalyses(userId: string, query: AnalysisHistoryQuery) {
    // One extra row proves whether another page exists.
    const rows = await analysisRepository.findManyByUser(userId, {
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId,
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => encodeAnalysisCursor({ createdAt: row.createdAt.toISOString(), id: row.id }));
  }

  async getUserAnalysisById(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findOneByUser(userId, analysisId);
    if (!analysis) throw AppError.notFound("Analysis not found.");
    return analysis;
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
