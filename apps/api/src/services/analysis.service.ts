/**
 * Analysis service.
 *
 * Cache strategy (two-layer LRU + Redis):
 *   - AI result is cached by SHA-256 of (language + code) so identical
 *     submissions never hit the AI provider twice.
 *   - The DB record is always written — cache only shields the AI call.
 */
import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@algoforge/db";
import { env } from "../config/env";
import { analysisRepository } from "../repositories/analysis.repository";
import { aiService } from "./ai.service";
import { AppError } from "../utils/app-error";
import { SharedAnalysisSchema, type AnalysisResult } from "@algoforge/analysis";
import type { AnalysisInput, AnalysisHistoryQuery } from "../validation/analysis";
import { layeredCache } from "./lib/layered-cache";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function aiCacheKey(language: string, code: string): string {
  const hash = createHash("sha256").update(`${language}:${code}`).digest("hex").slice(0, 32);
  return `ai:analysis:${hash}`;
}

function generateShareId(): string {
  return randomBytes(9).toString("base64url");
}

// ─── Service ─────────────────────────────────────────────────────────────────

class AnalysisService {
  async createAnalysis(userId: string, input: AnalysisInput) {
    const key = aiCacheKey(input.language, input.code);

    // Try cache first — avoids calling the AI provider for duplicate code
    let aiResult = await layeredCache.get<AnalysisResult>(key);

    if (!aiResult) {
      aiResult = await aiService.analyzeCode({
        code:     input.code,
        language: input.language,
      });
      await layeredCache.set(key, aiResult);
    }

    return analysisRepository.create({
      userId,
      code:       input.code,
      language:   input.language,
      complexity: aiResult.complexity?.time?.average ?? null,
      suggestion: aiResult.improvements?.[0]?.suggestion ?? null,
      result:     aiResult as unknown as Prisma.InputJsonValue,
    });
  }

  async listUserAnalyses(userId: string, query: AnalysisHistoryQuery) {
    const rows = await analysisRepository.findManyByUser(userId, {
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId:        query.cursorId,
      take:            query.limit,
    });
    return { analyses: rows };
  }

  async getUserAnalysisById(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findOneByUser(userId, analysisId);
    if (!analysis) throw AppError.notFound("Analysis not found.");
    return analysis;
  }

  async shareAnalysis(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findForShare(analysisId, userId);
    if (!analysis) throw AppError.notFound("Analysis not found.");

    // Idempotent — return existing share URL if already public
    if (analysis.shareId && analysis.isPublic) {
      return { shareUrl: `${env.webAppUrl}/share/analysis/${analysis.shareId}` };
    }

    const shareId = generateShareId();
    await analysisRepository.setPublic(analysisId, shareId);
    return { shareUrl: `${env.webAppUrl}/share/analysis/${shareId}` };
  }

  async getPublicAnalysis(shareId: string) {
    const analysis = await analysisRepository.findPublicByShareId(shareId);
    if (!analysis) throw AppError.notFound("Analysis not found or not public.");

    return SharedAnalysisSchema.parse({
      id:        analysis.id,
      code:      analysis.code,
      language:  analysis.language,
      result:    analysis.result,
      createdAt: analysis.createdAt.toISOString(),
      creator:   analysis.user
        ? {
            id:        analysis.user.id,
            name:      analysis.user.name,
            username:  analysis.user.username ?? analysis.user.name,
            avatarUrl: analysis.user.image,
          }
        : undefined,
    });
  }
}

export const analysisService = new AnalysisService();