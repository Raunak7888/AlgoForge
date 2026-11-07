import { GoogleGenAI } from "@google/genai";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type { AIGenerateRequest, AIGenerateResponse, AIProvider } from "./ai-provider";
import { toGeminiRequest } from "./gemini-messages";

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenAI;

  constructor(
    private readonly config: {
      apiKey: string;
      model: string;
    },
  ) {
    if (!config.apiKey) {
      throw AppError.internal("Missing Gemini API key.");
    }
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    try {
      const { systemInstruction, contents } = toGeminiRequest(request.messages);
      if (contents.length === 0) throw AppError.badRequest("AI request must include at least one user message.");
      const isJson = request.responseFormat === "json";

      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents,
        config: {
          ...(systemInstruction ? { systemInstruction } : {}),
          ...(isJson ? { responseMimeType: "application/json" } : {}),
          temperature: isJson ? 0.1 : 0.4,
          ...(request.maxOutputTokens ? { maxOutputTokens: request.maxOutputTokens } : {}),
          ...(request.signal ? { abortSignal: request.signal } : {}),
        },
      });

      const text = response.text?.trim();
      if (!text) {
        throw AppError.badGateway("Empty response from Gemini provider.");
      }

      const message = { role: "assistant" as const, content: text };

      return {
        model: this.config.model,
        message,
        history: [...request.messages, message],
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (!env.isProduction && !request.signal?.aborted) {
        console.error("[AI][gemini]", error);
      }
      throw AppError.badGateway("Gemini provider request failed.");
    }
  }
}
