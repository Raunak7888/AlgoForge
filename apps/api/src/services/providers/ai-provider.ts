export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIGenerateRequest = {
  messages: AIMessage[];
  responseFormat?: "json" | "text";
  /** Upper bound for the length of the answer. */
  maxOutputTokens?: number;
  /** Per-attempt budget in ms. Gemini makes one attempt, so the overall timeout applies. */
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
