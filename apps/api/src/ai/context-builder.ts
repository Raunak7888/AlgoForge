import { LIMITS, type AnalysisLanguage, type ExplainContext } from "@algoforge/contracts";
import { algorithmRepository } from "../repositories/algorithm.repository";
import { logger, serializeError } from "../utils/logger";

/**
 * What the assistant knows. Built only from what the client sent plus one published catalog entry.
 * It never contains internal schema, routes or other users' data. Everything here is DATA, never instructions.
 */
export interface AlgorithmContext {
  slug: string;
  name: string;
  description: string;
  difficulty: string;
  category: string;
  complexity: { best: string | null; average: string | null; worst: string | null; space: string | null } | null;
  code: { language: string; code: string } | null;
}

export interface AssistantContext {
  language: AnalysisLanguage | null;
  code: string | null;
  codeTruncated: boolean;
  script: string | null;
  scriptTruncated: boolean;
  step: { position: number; total: number; call: string | null; narration: string | null } | null;
  algorithm: AlgorithmContext | null;
}

const CATALOG_CODE_CHARS = 4_000;
const NARRATION_CHARS = 1_000;

function clip(value: string | undefined, max: number): { text: string | null; truncated: boolean } {
  if (value === undefined || value.trim() === "") return { text: null, truncated: false };
  return value.length > max ? { text: value.slice(0, max), truncated: true } : { text: value, truncated: false };
}

async function resolveAlgorithm(slug: string, language: AnalysisLanguage | null): Promise<AlgorithmContext | null> {
  try {
    const row = await algorithmRepository.findBySlug(slug);
    if (!row || !row.isPublished) return null; // drafts are never visible to the assistant
    const codes = row.displayCodes;
    const pick = codes.find((c) => c.language === language) ?? codes.find((c) => c.language === "javascript") ?? codes[0] ?? null;
    const hasComplexity = row.timeBest || row.timeAverage || row.timeWorst || row.spaceComplexity;
    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      difficulty: row.difficulty,
      category: row.category.label,
      complexity: hasComplexity ? { best: row.timeBest, average: row.timeAverage, worst: row.timeWorst, space: row.spaceComplexity } : null,
      code: pick ? { language: pick.language, code: pick.code.slice(0, CATALOG_CODE_CHARS) } : null,
    };
  } catch (error) {
    logger.warn("assistant: could not resolve algorithm context", { slug, ...serializeError(error) });
    return null;
  }
}

export async function buildAssistantContext(input: ExplainContext | undefined): Promise<AssistantContext> {
  const language = input?.language ?? null;
  const code = clip(input?.code, LIMITS.code.maxChars);
  const script = clip(input?.script, LIMITS.assistant.scriptContextChars);
  const narration = clip(input?.step?.narration, NARRATION_CHARS);
  return {
    language,
    code: code.text,
    codeTruncated: code.truncated,
    script: script.text,
    scriptTruncated: script.truncated,
    step: input?.step ? { position: input.step.position, total: input.step.total, call: input.step.call?.trim() || null, narration: narration.text } : null,
    algorithm: input?.algorithmSlug ? await resolveAlgorithm(input.algorithmSlug, language) : null,
  };
}

/** A cheap, label-only classification stored with each answer. */
export function detectIntent(query: string): string {
  const q = query.toLowerCase();
  if (/\b(optimi[sz]\w*|faster|speed up|improve|refactor)\b/.test(q)) return "optimize";
  if (/\b(generate|write|implement|code for)\b|give me (the )?code/.test(q)) return "generate_code";
  if (/\b(explain|why|how|what|walk me|complexity)\b/.test(q)) return "explain";
  return "general";
}
