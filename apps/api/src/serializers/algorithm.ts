import {
  AlgorithmDetailResponseSchema,
  AlgorithmSummarySchema,
  type AlgorithmDetailResponse,
  type AlgorithmSummary,
} from "@algoforge/contracts";
import type { AlgorithmDetailRow, AlgorithmListRow } from "../repositories/algorithm.repository";

interface ComplexityFields {
  timeBest: string | null;
  timeAverage: string | null;
  timeWorst: string | null;
  spaceComplexity: string | null;
}

function complexityOf(row: ComplexityFields) {
  return row.timeBest || row.timeAverage || row.timeWorst || row.spaceComplexity
    ? { timeBest: row.timeBest, timeAverage: row.timeAverage, timeWorst: row.timeWorst, space: row.spaceComplexity }
    : null;
}

export function serializeAlgorithmSummary(row: AlgorithmListRow): AlgorithmSummary {
  return AlgorithmSummarySchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryLabel: row.category.label,
    difficulty: row.difficulty,
    complexity: complexityOf(row),
    tags: row.tags.map((t) => t.tag),
  });
}

/**
 * Display code priority: requested language, then javascript, then the first one.
 * `displayCodes` always lists every language so the page can offer a switch.
 */
function pickDisplayCode(codes: { language: string; code: string }[], lang?: string) {
  if (!codes.length) return null;
  const preferred = lang ?? "javascript";
  return codes.find((c) => c.language === preferred) ?? codes.find((c) => c.language === "javascript") ?? codes[0];
}

export function serializeAlgorithmDetail(row: NonNullable<AlgorithmDetailRow>, lang?: string): AlgorithmDetailResponse {
  return AlgorithmDetailResponseSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    difficulty: row.difficulty,
    categoryId: row.categoryId,
    categoryLabel: row.category.label,
    isPublished: row.isPublished,
    complexity: complexityOf(row),
    displayCode: pickDisplayCode(row.displayCodes, lang),
    displayCodes: row.displayCodes,
    tags: row.tags.map((t) => t.tag),
    script: row.script,
    scriptVersion: row.scriptVersion,
  });
}
