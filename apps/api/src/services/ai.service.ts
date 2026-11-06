import type { AnalysisLanguage, AnalysisResult } from "@algoforge/analysis";
import { env } from "../config/env";
import { ANALYSIS_PROMPT_VERSION, buildAnalysisPrompt } from "../prompts/analysis.prompt";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { parseAnalysisOutput } from "./lib/ai-output";
import { getAIProvider } from "./providers/provider-factory";
import type { AIMessage } from "./providers/ai-provider";

type AnalyzeCodeInput = {
  code: string;
  language: AnalysisLanguage;
};

export interface AnalysisOutput {
  result: AnalysisResult;
  model: string;
  promptVersion: string;
}

interface GenerateOptions {
  timeoutMs: number;
  maxOutputTokens: number;
}

class AIService {
  /**
   * One billable analysis. Invalid output is retried (env.ai.maxRetries times); timeouts and
   * provider outages are not, because retrying them only makes the person wait longer.
   */
  async analyzeCode(input: AnalyzeCodeInput): Promise<AnalysisOutput> {
    const attempts = 1 + Math.max(0, env.ai.maxRetries);
    let lastError: AppError | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      const { content, model } = await this.generate(
        [{ role: "user", content: buildAnalysisPrompt(input) }],
        "json",
        { timeoutMs: env.ai.analysisTimeoutMs, maxOutputTokens: env.ai.analysisMaxOutputTokens },
      );
      try {
        return { result: parseAnalysisOutput(content), model, promptVersion: ANALYSIS_PROMPT_VERSION };
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        lastError = error;
        logger.warn("ai: invalid analysis output", { attempt, attempts, model, message: error.message });
      }
    }
    throw lastError ?? AppError.aiInvalidOutput();
  }

  async generateText(messages: AIMessage[]): Promise<string> {
    const { content } = await this.generate(messages, "text", {
      timeoutMs: env.ai.timeoutMs,
      maxOutputTokens: env.ai.textMaxOutputTokens,
    });
    return content;
  }

  private async generate(
    messages: AIMessage[],
    responseFormat: "json" | "text",
    options: GenerateOptions,
  ): Promise<{ content: string; model: string }> {
    const provider = getAIProvider();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await provider.generate({
        messages,
        responseFormat,
        maxOutputTokens: options.maxOutputTokens,
        signal: controller.signal,
      });
      return { content: response.message.content, model: response.model };
    } catch (error) {
      if (controller.signal.aborted) {
        throw AppError.aiTimeout(`The AI provider did not answer within ${Math.round(options.timeoutMs / 1000)} seconds.`);
      }
      if (error instanceof AppError) {
        if (error.code === "BAD_GATEWAY") throw AppError.aiUnavailable(error.message);
        throw error;
      }
      throw AppError.aiUnavailable("The AI request failed.");
    } finally {
      clearTimeout(timer);
    }
  }
}

export const aiService = new AIService();
