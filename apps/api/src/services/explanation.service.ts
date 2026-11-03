import { createHash } from "crypto";
import { aiService } from "./ai.service";
import { buildCodebaseContext, serializeContext } from "../ai/context-builder";
import { processQuery, type QueryScope } from "../ai/query-processor";
import { buildExplanationPrompt } from "../prompts/explanation.prompt";
import { formatExplanationResponse, type ExplanationResponse } from "../ai/response-formatter";
import { AppError } from "../utils/app-error";
import { layeredCache } from "./lib/layered-cache";

const EXPLAIN_CACHE_PREFIX = "ai:explain:";
const MAX_QUERY_LENGTH = 2000;

class ExplanationService {
  async explain(query: string): Promise<ExplanationResponse> {
    const trimmed = query.trim();

    if (trimmed.length < 5) {
      throw AppError.badRequest("Query must be at least 5 characters.");
    }

    if (trimmed.length > MAX_QUERY_LENGTH) {
      throw AppError.badRequest(`Query cannot exceed ${MAX_QUERY_LENGTH} characters.`);
    }

    const cacheKey =
      EXPLAIN_CACHE_PREFIX +
      createHash("sha256").update(trimmed.toLowerCase()).digest("hex").slice(0, 32);

    const cached = await layeredCache.get<ExplanationResponse>(cacheKey);
    if (cached) {
      return { ...cached, cachedAt: new Date().toISOString() };
    }

    const scope       = await processQuery(trimmed);
    const context     = await buildCodebaseContext(scope.targetSlugs);
    const contextText = serializeContext(context);
    const prompt      = buildExplanationPrompt(contextText, scope);
    const raw         = await aiService.generateText([{ role: "user", content: prompt }]);

    const result = formatExplanationResponse(raw, scope, scope.targetRoutes);
    await layeredCache.set(cacheKey, result);

    return result;
  }
}

export const explanationService = new ExplanationService();