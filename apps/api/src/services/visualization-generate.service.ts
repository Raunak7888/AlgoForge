import type { AnalysisLanguage, GenerateVisualizationResponse } from "@algoforge/contracts";
import { MAX_SCRIPT_CHARS, type ScriptAnalysis } from "@algoforge/visualizer-core";
import { env } from "../config/env";
import { VISUALIZE_PROMPT_VERSION, buildVisualizeMessages } from "../prompts/visualize.prompt";
import { AppError } from "../utils/app-error";
import { hashNormalizedCode } from "../utils/ai-cache-keys";
import { logger, serializeError } from "../utils/logger";
import { aiService } from "./ai.service";
import { aiUsageService } from "./ai-usage.service";
import { sanitizeJson } from "./lib/ai-output";
import { layeredCache } from "./lib/layered-cache";
import { quotaService } from "./quota.service";
import { checkScript } from "./script.service";

const ATTEMPTS = 2;
const MAX_REPORTED_PROBLEMS = 8;

interface Evaluated {
  /** What goes back to the model if a retry is needed. */
  echo: string;
  problems: string[];
  /** No compiler errors (rejected operations are only warnings). */
  ok: boolean;
  script: string;
  analysis: ScriptAnalysis | null;
}

const cacheKey = (language: AnalysisLanguage, code: string) => `ai:viz:${VISUALIZE_PROMPT_VERSION}:${language}:${hashNormalizedCode(code).slice(0, 32)}`;

function evaluate(raw: string): Evaluated {
  const text = sanitizeJson(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { echo: raw.slice(0, 4000), problems: ["The output was not valid JSON. Return only a JSON array."], ok: false, script: "", analysis: null };
  }
  const script = JSON.stringify(parsed, null, 2);
  if (script.length > MAX_SCRIPT_CHARS) {
    return { echo: script.slice(0, 4000), problems: ["The script is too long. Use fewer steps."], ok: false, script, analysis: null };
  }
  const analysis = checkScript(script);
  const problems = analysis.diagnostics.filter((d) => d.severity !== "info").map((d) => `line ${d.line}: ${d.message}`);
  return { echo: script, problems: problems.slice(0, MAX_REPORTED_PROBLEMS), ok: analysis.ok, script, analysis };
}

const toResponse = (script: string, analysis: ScriptAnalysis, cached: boolean): GenerateVisualizationResponse => ({
  script,
  stepCount: analysis.stepCount,
  structures: analysis.structures,
  cached,
});

class VisualizationGenerateService {
  async generate(userId: string, input: { code: string; language: AnalysisLanguage }, signal?: AbortSignal): Promise<GenerateVisualizationResponse> {
    const key = cacheKey(input.language, input.code);

    const hit = await layeredCache.get<{ script: string }>(key);
    if (hit) {
      const analysis = checkScript(hit.script);
      if (analysis.ok) return toResponse(hit.script, analysis, true);
    }

    const reservation = await quotaService.reserve(userId, "analysis");
    try {
      let previous: { raw: string; problems: string[] } | undefined;
      let best: Evaluated | null = null;

      for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
        const raw = await aiService.generateText(buildVisualizeMessages({ code: input.code, language: input.language, previous }), {
          timeoutMs: env.ai.visualizeTimeoutMs,
          maxOutputTokens: env.ai.visualizeMaxOutputTokens,
          responseFormat: "json",
          ...(signal ? { signal } : {}),
        });
        const result = evaluate(raw);
        if (result.ok && result.problems.length === 0) {
          best = result;
          break;
        }
        if (result.ok && !best) best = result; // usable fallback if the retry gets worse
        logger.warn("visualize: script needs fixes", { attempt, problems: result.problems.length });
        previous = { raw: result.echo, problems: result.problems };
      }

      if (!best || !best.analysis) {
        throw AppError.aiInvalidOutput("The AI could not turn this code into a valid visualization. Try a shorter or simpler piece of code.");
      }

      await layeredCache.set(key, { script: best.script });
      try {
        await aiUsageService.record(userId, "analysis");
      } catch (error) {
        logger.warn("ai usage could not be recorded", { userId, ...serializeError(error) });
      }
      return toResponse(best.script, best.analysis, false);
    } catch (error) {
      await reservation.release();
      throw error;
    }
  }
}

export const visualizationGenerateService = new VisualizationGenerateService();
