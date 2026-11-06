import OpenAI from "openai";
import { env } from "../../config/env";
import { AppError } from "../../utils/app-error";
import type {
  AIGenerateRequest,
  AIGenerateResponse,
  AIMessage,
  AIProvider,
} from "./ai-provider";

type OpenRouterMessage = {
  role: AIMessage["role"];
  content: string;
  reasoning_details?: unknown;
};

type OpenRouterChoiceMessage = {
  content?: unknown;
  reasoning_details?: unknown;
};

type OpenRouterCompletionResponse = {
  choices?: Array<{ message?: OpenRouterChoiceMessage }>;
};

// type OpenRouterChatRequest = {
//   model: string;
//   messages: OpenRouterMessage[];
//   reasoning: { enabled: boolean };
// };

export class OpenRouterProvider implements AIProvider {
  readonly name = "openrouter";

  private readonly clientsByKey = new Map<string, OpenAI>();
  private readonly keyIndexByModel = new Map<string, number>();
  private modelIndex = 0;

  constructor(
    private readonly config: {
      apiKeys: string[];
      freeModels: string[];
      baseUrl: string;
      appName?: string;
      siteUrl?: string;
    },
  ) {
    if (!config.apiKeys.length) {
      throw AppError.internal("Missing OpenRouter API keys.");
    }
    if (!config.freeModels.length) {
      throw AppError.internal("Missing OpenRouter free models.");
    }
  }

  async generate(request: AIGenerateRequest): Promise<AIGenerateResponse> {
    if (!request.messages.length) {
      throw AppError.badRequest("AI request must include at least one message.");
    }

    let lastRetriableError: unknown;

    for (let modelOffset = 0; modelOffset < this.config.freeModels.length; modelOffset++) {
      const modelState = this.getModelState(modelOffset);

      for (let keyOffset = 0; keyOffset < this.config.apiKeys.length; keyOffset++) {
        const keyState = this.getKeyState(modelState.model, keyOffset);

        try {
          const client = this.getClient(keyState.apiKey);
          const completion = await client.chat.completions.create(
            {
              model: modelState.model,
              messages: this.toOpenRouterMessages(request.messages),
              reasoning: { enabled: true },
              ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
            } as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
            request.signal ? { signal: request.signal } : undefined,
          );

          const assistantMessage = this.toAssistantMessage(
            completion as unknown as OpenRouterCompletionResponse,
          );

          this.modelIndex = modelState.actualIndex;
          this.keyIndexByModel.set(
            modelState.model,
            (keyState.actualIndex + 1) % this.config.apiKeys.length,
          );

          return {
            model: modelState.model,
            message: assistantMessage,
            history: [...request.messages, assistantMessage],
          };
        } catch (error) {
          // An abort is a timeout decided by the caller: never rotate keys or models because of it.
          if (request.signal?.aborted) throw this.normalizeFatalError(error);

          const statusCode = getStatusCode(error);

          if (statusCode === 429 || statusCode === 503) {
            lastRetriableError = error;
            this.keyIndexByModel.set(
              modelState.model,
              (keyState.actualIndex + 1) % this.config.apiKeys.length,
            );
            if (!env.isProduction) {
              console.warn(
                `[AI][openrouter] Key ${keyState.actualIndex} throttled for model "${modelState.model}". Rotating.`,
              );
            }
            continue;
          }

          throw this.normalizeFatalError(error);
        }
      }

      if (!env.isProduction) {
        console.warn(`[AI][openrouter] All keys exhausted for model "${modelState.model}". Rotating model.`);
      }
      this.modelIndex = (modelState.actualIndex + 1) % this.config.freeModels.length;
    }

    throw this.normalizeRetriableError(lastRetriableError);
  }

  private getModelState(offset: number): { actualIndex: number; model: string } {
    const actualIndex = (this.modelIndex + offset) % this.config.freeModels.length;
    return { actualIndex, model: this.config.freeModels[actualIndex] };
  }

  private getKeyState(model: string, offset: number): { actualIndex: number; apiKey: string } {
    const startIndex = this.keyIndexByModel.get(model) ?? 0;
    const actualIndex = (startIndex + offset) % this.config.apiKeys.length;
    return { actualIndex, apiKey: this.config.apiKeys[actualIndex] };
  }

  private getClient(apiKey: string): OpenAI {
    const cached = this.clientsByKey.get(apiKey);
    if (cached) return cached;

    const client = new OpenAI({
      apiKey,
      baseURL: this.config.baseUrl,
      defaultHeaders: {
        ...(this.config.siteUrl ? { "HTTP-Referer": this.config.siteUrl } : {}),
        ...(this.config.appName ? { "X-Title": this.config.appName } : {}),
      },
    });

    this.clientsByKey.set(apiKey, client);
    return client;
  }

  private toOpenRouterMessages(messages: AIMessage[]): OpenRouterMessage[] {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.reasoning_details !== undefined ? { reasoning_details: m.reasoning_details } : {}),
    }));
  }

  private toAssistantMessage(response: OpenRouterCompletionResponse): AIMessage {
    const message = response.choices?.[0]?.message;
    const content = this.extractContent(message?.content);
    if (!content) throw AppError.badGateway("Empty response from OpenRouter.");
    return {
      role: "assistant",
      content,
      ...(message?.reasoning_details !== undefined ? { reasoning_details: message.reasoning_details } : {}),
    };
  }

  private extractContent(content: unknown): string {
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) {
            return (part as { text: string }).text;
          }
          return "";
        })
        .join("")
        .trim();
    }
    return "";
  }

  private normalizeFatalError(error: unknown): AppError {
    const statusCode = getStatusCode(error);
    if (statusCode === 401 || statusCode === 403) {
      return AppError.badGateway("OpenRouter authentication failed.");
    }
    return AppError.badGateway("OpenRouter request failed.");
  }

  private normalizeRetriableError(_error: unknown): AppError {
    return AppError.badGateway("All OpenRouter keys and models are currently exhausted.");
  }
}

function getStatusCode(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const err = error as Record<string, unknown>;
    const status = err["status"] ?? err["statusCode"];
    return typeof status === "number" ? status : undefined;
  }
  return undefined;
}