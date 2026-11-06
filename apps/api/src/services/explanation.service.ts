import { aiService } from "./ai.service";
import { buildCodebaseContext, serializeContext } from "../ai/context-builder";
import { processQuery } from "../ai/query-processor";
import { buildExplanationPrompt, EXPLANATION_PROMPT_VERSION } from "../prompts/explanation.prompt";
import { formatExplanationResponse, type ExplanationResponse } from "../ai/response-formatter";
import { AppError } from "../utils/app-error";
import { explainCacheKey } from "../utils/ai-cache-keys";
import { ALGO_CACHE_NAMESPACE } from "./algorithm/cache-keys";
import { getCacheVersion } from "./lib/cache-version";
import { layeredCache } from "./lib/layered-cache";

const MAX_QUERY_LENGTH = 2000;

class ExplanationService {
  async explain(query: string): Promise<ExplanationResponse> {
    const trimmed = query.replace(/\s+/g, " ").trim();

    if (trimmed.length < 5) {
      throw AppError.badRequest("Query must be at least 5 characters.");
    }

    if (trimmed.length > MAX_QUERY_LENGTH) {
      throw AppError.badRequest(`Query cannot exceed ${MAX_QUERY_LENGTH} characters.`);
    }

    // The scope decides which context the model sees, so it is part of the cache key,
    // together with the prompt version and the catalog version (algorithms feed the context).
    const scope = await processQuery(trimmed);
    const cacheKey = explainCacheKey({
      promptVersion: EXPLANATION_PROMPT_VERSION,
      catalogVersion: await getCacheVersion(ALGO_CACHE_NAMESPACE),
      query: trimmed,
      intent: scope.intent,
      slugs: scope.targetSlugs,
      routes: scope.targetRoutes,
    });

    const cached = await layeredCache.get<ExplanationResponse>(cacheKey);
    if (cached) return cached; // cachedAt is the time it was generated, not now

    const context = await buildCodebaseContext(scope.targetSlugs);
    const prompt = buildExplanationPrompt(serializeContext(context), scope);
    const raw = await aiService.generateText([{ role: "user", content: prompt }]);

    const result = formatExplanationResponse(raw, scope, scope.targetRoutes);
    await layeredCache.set(cacheKey, { ...result, cachedAt: new Date().toISOString() });

    return result;
  }
}

export const explanationService = new ExplanationService();
