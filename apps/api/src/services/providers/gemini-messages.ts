import type { AIMessage } from "./ai-provider";

export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

/**
 * Maps role-separated messages onto Gemini's request shape: all system messages become
 * systemInstruction, assistant becomes "model", neighbours with the same role are merged
 * (Gemini wants alternating turns) and the conversation always starts with a user turn.
 */
export function toGeminiRequest(messages: readonly AIMessage[]): { systemInstruction?: string; contents: GeminiContent[] } {
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const contents: GeminiContent[] = [];
  for (const m of messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last && last.role === role) last.parts[0].text += `\n\n${m.content}`;
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  while (contents.length > 0 && contents[0].role === "model") contents.shift();
  return { ...(system ? { systemInstruction: system } : {}), contents };
}
