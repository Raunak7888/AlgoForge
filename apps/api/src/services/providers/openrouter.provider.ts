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

/**
 * What a failed attempt means for the rotation:
 *  - "key":   this key is the problem (throttled, unpaid, rejected). Try the next key on the same model.
 *  - "model": this model is the problem (timeout, 5xx, removed, rejects the request, empty answer). Skip to the next model.
 *  - "fatal": trying elsewhere cannot help. Surface the error.
 */
export type FailureScope = "key" | "model" | "fatal";

export function classifyFailure(error: unknown, attemptTimedOut: boolean): FailureScope {
  if (attemptTimedOut) return "model";
  const status = getStatusCode(error);
  if (status === undefined) return error instanceof OpenAI.APIConnectionError ? "model" : "fatal";
  if (status === 401 || status === 402 || status === 403 || status === 429) return "key";
  if (status === 400 || status === 404 || status === 408 || status === 422 || status >= 500) return "model";
  return "fatal";
}

/**
 * One signal per provider attempt. It fires when the caller aborts (total deadline, client gone)
 * or when this attempt alone has used up its slice of the budget.
 */
function createAttemptSignal(parent: AbortSignal | undefined, timeoutMs: number | undefined) {
  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs !== undefined
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
  const onParentAbort = () => controller.abort();
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener("abort", onParentAbort, { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      if (timer !== undefined) clearTimeout(timer);
      parent?.removeEventListener("abort", onParentAbort);
    },
  };
}

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
        const attempt = createAttemptSignal(request.signal, request.attemptTimeoutMs);

        try {
          const completion = await this.complete(keyState.apiKey, modelState.model, request, attempt.signal);
          const assistantMessage = this.toAssistantMessage(completion);

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
          // The caller aborted (total deadline or the client went away): never rotate because of that.
          if (request.signal?.aborted) throw this.normalizeFatalError(error);

          const scope = classifyFailure(error, attempt.timedOut());
          if (scope === "fatal") throw this.normalizeFatalError(error);

          lastRetriableError = error;
          if (!env.isProduction) {
            console.warn(
              `[AI][openrouter] ${scope}-level failure (status ${String(getStatusCode(error) ?? "none")}) on model "${modelState.model}", key ${keyState.actualIndex}. Rotating.`,
            );
          }

          if (scope === "key") {
            this.keyIndexByModel.set(
              modelState.model,
              (keyState.actualIndex + 1) % this.config.apiKeys.length,
            );
            continue;
          }
          break; // "model": other keys will not help, move to the next model
        } finally {
          attempt.dispose();
        }
      }

      this.modelIndex = (modelState.actualIndex + 1) % this.config.freeModels.length;
    }

    throw this.normalizeRetriableError(lastRetriableError);
  }

  /**
   * One provider call. JSON calls ask for JSON mode and skip reasoning (reasoning tokens count against
   * max_tokens and can truncate the JSON). Chat calls keep reasoning on. A 400 usually means the model
   * rejects one of those optional parameters, so it is retried once without them.
   */
  private async complete(
    apiKey: string,
    model: string,
    request: AIGenerateRequest,
    signal: AbortSignal,
  ): Promise<OpenRouterCompletionResponse> {
    const client = this.getClient(apiKey);
    const isJson = request.responseFormat === "json";

    const base = {
      model,
      messages: this.toOpenRouterMessages(request.messages),
      temperature: isJson ? 0.1 : 0.4,
      ...(request.maxOutputTokens ? { max_tokens: request.maxOutputTokens } : {}),
    };
    const preferred = {
      ...base,
      ...(isJson ? { response_format: { type: "json_object" } } : { reasoning: { enabled: true } }),
    };

    try {
      const completion = await client.chat.completions.create(
        preferred as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
        { signal },
      );
      return completion as unknown as OpenRouterCompletionResponse;
    } catch (error) {
      if (getStatusCode(error) === 400 && !signal.aborted) {
        const completion = await client.chat.completions.create(
          base as unknown as OpenAI.Chat.ChatCompletionCreateParamsNonStreaming,
          { signal },
        );
        return completion as unknown as OpenRouterCompletionResponse;
      }
      throw error;
    }
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
      // The rotation loop above is the retry policy. The SDK's own retries would stack on top of it.
      maxRetries: 0,
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
