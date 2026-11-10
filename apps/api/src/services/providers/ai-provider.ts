export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
  reasoning_details?: unknown;
};

export type AIGenerateRequest = {
  messages: AIMessage[];
  responseFormat?: "json" | "text";
  /** Upper bound for the length of the answer. */
  maxOutputTokens?: number;
  /** Budget in ms for one attempt (one key on one model). Providers that rotate use it per attempt. */
  attemptTimeoutMs?: number;
  /** Aborts the underlying HTTP request when it fires. */
  signal?: AbortSignal;
};

export type AIGenerateResponse = {
  model: string;
  message: AIMessage;
  history: AIMessage[];
};

export interface AIProvider {
  readonly name: string;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
}
