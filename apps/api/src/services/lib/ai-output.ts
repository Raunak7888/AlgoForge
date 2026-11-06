import { AnalysisResultSchema, type AnalysisResult } from "@algoforge/analysis";
import { AppError } from "../../utils/app-error";

/** Models sometimes wrap JSON in fences or add chatter. Pull out the JSON object. */
export function sanitizeJson(value: string): string {
  const trimmed = value.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1).trim();

  return trimmed;
}

/** Throws AI_INVALID_OUTPUT when the text is not JSON or does not match the analysis schema. */
export function parseAnalysisOutput(raw: string): AnalysisResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitizeJson(raw));
  } catch {
    throw AppError.aiInvalidOutput("The AI provider returned text that is not valid JSON.");
  }
  const result = AnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    throw AppError.aiInvalidOutput("The AI provider returned an analysis that does not match the expected format.");
  }
  return result.data;
}
