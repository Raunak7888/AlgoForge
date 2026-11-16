import type { AnalysisLanguage, AnalysisResult } from "@algoforge/analysis";
import { env } from "../config/env";
import { ANALYSIS_PROMPT_VERSION, buildAnalysisMessages } from "../prompts/analysis.prompt";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { parseAnalysisOutput } from "./lib/ai-output";
import { getAIProvider } from "./providers/provider-factory";
import type { AIMessage, AIUsage } from "./providers/ai-provider";

type AnalyzeCodeInput = {
  code: string;
  language: AnalysisLanguage;
};

export interface AnalysisOutput {
  result: AnalysisResult;
  model: string;
  promptVersion: string;
  /** Tokens of every provider attempt this analysis needed (failed retries are billed too). */
  usage: AIUsage;
}

interface GenerateOptions {
  timeoutMs: number;
  maxOutputTokens: number;
  /** Budget for one provider attempt (one key on one model). Defaults to half of timeoutMs. */
  attemptTimeoutMs?: number;
  /** Aborts the provider request when the caller goes away (for example the HTTP client disconnected). */
  signal?: AbortSignal;
}

/** A retry is only worth starting when at least this much of the analysis budget is left. */
const MIN_RETRY_MS = 10_000;

const NO_USAGE: AIUsage = { tokensIn: 0, tokensOut: 0 };
const addUsage = (a: AIUsage, b: AIUsage): AIUsage => ({ tokensIn: a.tokensIn + b.tokensIn, tokensOut: a.tokensOut + b.tokensOut });

/** One provider attempt gets half of the call budget, so rotation can still reach a second model. */
function defaultAttemptTimeout(totalMs: number): number {
  return Math.max(15_000, Math.floor(totalMs / 2));
}

class AIService {
  /**
   * One billable analysis. Invalid output is retried (env.ai.maxRetries times); timeouts and
   * provider outages are not, because retrying them only makes the person wait longer.
   */
  async analyzeCode(input: AnalyzeCodeInput): Promise<AnalysisOutput> {
    const attempts = 1 + Math.max(0, env.ai.maxRetries);
    let lastError: AppError | null = null;
    let usage = NO_USAGE;
    // One analysis never takes longer than twice the per-call timeout, however many retries are configured.
    const deadline = Date.now() + env.ai.analysisTimeoutMs * 2;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const remainingMs = deadline - Date.now();
      if (attempt > 1 && remainingMs < MIN_RETRY_MS) break;
      const generated = await this.generate(
        buildAnalysisMessages(input),
        "json",
        { timeoutMs: Math.min(env.ai.analysisTimeoutMs, remainingMs), maxOutputTokens: env.ai.analysisMaxOutputTokens },
      );
      usage = addUsage(usage, generated.usage);
      try {
        return { result: parseAnalysisOutput(generated.content), model: generated.model, promptVersion: ANALYSIS_PROMPT_VERSION, usage };
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        lastError = error;
        logger.warn("ai: invalid analysis output", { attempt, attempts, model: generated.model, message: error.message });
      }
    }
    throw lastError ?? AppError.aiInvalidOutput();
  }

  async generateTextWithUsage(
    messages: AIMessage[],
    options: Partial<GenerateOptions> & { responseFormat?: "json" | "text" } = {},
  ): Promise<{ content: string; usage: AIUsage }> {
    const { content, usage } = await this.generate(messages, options.responseFormat ?? "text", {
      timeoutMs: options.timeoutMs ?? env.ai.timeoutMs,
      maxOutputTokens: options.maxOutputTokens ?? env.ai.textMaxOutputTokens,
      ...(options.signal ? { signal: options.signal } : {}),
    });
    return { content, usage };
  }

  async generateText(messages: AIMessage[], options: Partial<GenerateOptions> & { responseFormat?: "json" | "text" } = {}): Promise<string> {
    return (await this.generateTextWithUsage(messages, options)).content;
  }

  private async generate(
    messages: AIMessage[],
    responseFormat: "json" | "text",
    options: GenerateOptions,
  ): Promise<{ content: string; model: string; usage: AIUsage }> {
    const provider = getAIProvider();
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, options.timeoutMs);
    const onCallerAbort = () => controller.abort();
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      else options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }

    try {
      const response = await provider.generate({
        messages,
        responseFormat,
        maxOutputTokens: options.maxOutputTokens,
        signal: controller.signal,
        attemptTimeoutMs: options.attemptTimeoutMs ?? defaultAttemptTimeout(options.timeoutMs),
      });
      return { content: response.message.content, model: response.model, usage: response.usage ?? NO_USAGE };
    } catch (error) {
      if (timedOut) {
        throw AppError.aiTimeout(`The AI provider did not answer within ${Math.round(options.timeoutMs / 1000)} seconds.`);
      }
      if (options.signal?.aborted) throw AppError.badRequest("The request was cancelled.");
      if (error instanceof AppError) {
        if (error.code === "BAD_GATEWAY") throw AppError.aiUnavailable(error.message);
        throw error;
      }
      throw AppError.aiUnavailable("The AI request failed.");
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onCallerAbort);
    }
  }
}

export const aiService = new AIService();
