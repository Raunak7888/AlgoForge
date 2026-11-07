import { createHash } from "crypto";

/** SHA-256 (hex) of the submitted code. Same formula as the Phase 5 backfill. */
export const hashCode = (code: string): string => createHash("sha256").update(code, "utf8").digest("hex");

/**
 * Analysis results depend on exactly three inputs: the language, the code and the prompt.
 * All three are in the key, so a prompt change can never serve a stale result.
 */
export function analysisCacheKey(language: string, codeHash: string, promptVersion: string): string {
  return `ai:analysis:${promptVersion}:${language}:${codeHash.slice(0, 32)}`;
}

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** A short title: the first sentence of the AI summary, else the first line of code. */
export function deriveTitle(summary: string | null | undefined, code: string): string {
  const sentence = (summary ?? "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0] ?? "";
  if (sentence) return clip(sentence.replace(/[.!?]+$/, ""), 80);
  const line = code.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  return line ? clip(line, 60) : "Untitled analysis";
}
