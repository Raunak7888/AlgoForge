import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AIProvider } from "./ai-provider";
import { GeminiProvider } from "./gemini.provider";

let _instance: AIProvider | null = null;

/** Gemini is the only AI provider. Without a key and a model the AI features answer 503 instead of crashing the server. */
export function getAIProvider(): AIProvider {
  if (!env.geminiApiKey || !env.ai.model) {
    throw AppError.aiUnavailable("The AI provider is not configured on this server.");
  }
  _instance ??= new GeminiProvider({
    apiKey: env.geminiApiKey,
    model: env.ai.model,
  });
  return _instance;
}
