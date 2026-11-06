import type { QueryScope } from "../ai/query-processor";

export const EXPLANATION_PROMPT_VERSION = "explain-v1";

export function buildExplanationPrompt(
  contextText: string,
  scope: QueryScope,
): string {
  return `You are a senior backend engineer. Answer the user's query about this codebase precisely and concisely.

USER QUERY: "${scope.rawQuery}"
DETECTED INTENT: ${scope.intent}
KEYWORDS: ${scope.keywords.join(", ")}

CODEBASE CONTEXT:
${contextText}

RULES:
- Be direct. No padding.
- explain_failure: state the most likely root cause from the code.
- explain_flow: trace the request lifecycle step by step.
- explain_algorithm: cover logic, complexity, and edge cases.
- explain_api: describe request → middleware → service → DB → response.
- Use plain text only. No markdown headers or code fences.
- Maximum 250 words.

Answer:`;
}