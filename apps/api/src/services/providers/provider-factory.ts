import { env } from "../../config/env";
import type { AIProvider } from "./ai-provider";
import { GeminiProvider } from "./gemini.provider";

let _instance: AIProvider | null = null;

/** Gemini is the only AI provider. */
export function getAIProvider(): AIProvider {
  _instance ??= new GeminiProvider({
    apiKey: env.geminiApiKey,
    model: env.ai.model,
  });
  return _instance;
}
