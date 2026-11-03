/**
 * Fetches a single algorithm by id or slug.
 * Each (id/slug + language) combination gets its own cache entry
 * so switching display language doesn't cause a cache miss cascade.
 */
import { AlgorithmDetailSchema, type AlgorithmDetail } from "@algoforge/forge";
import { algorithmRepository, type AlgorithmDetailRow } from "../../repositories/algorithm.repository";
import { layeredCache } from "../lib/layered-cache";
import { algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";

export async function getAlgorithmById(id: string, lang?: string): Promise<AlgorithmDetail> {
  const key    = algorithmCacheKeys.byId(id, lang);
  const cached = await layeredCache.get<AlgorithmDetail>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!row) throw AppError.notFound("Algorithm not found.");

  const result = toAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}

export async function getAlgorithmBySlug(slug: string, lang?: string): Promise<AlgorithmDetail> {
  const key    = algorithmCacheKeys.bySlug(slug, lang);
  const cached = await layeredCache.get<AlgorithmDetail>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findBySlug(slug);
  if (!row) throw AppError.notFound("Algorithm not found.");

  const result = toAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}

// ─── Private ──────────────────────────────────────────────────────────────────

/**
 * Choose the best display code for the requested language.
 * Priority: requested lang → javascript → first available.
 */
function pickDisplayCode(
  codes: { language: string; code: string }[],
  lang?: string,
): { language: string; code: string } | null {
  if (!codes.length) return null;
  const preferred = lang ?? "javascript";
  return (
    codes.find((c) => c.language === preferred) ??
    codes.find((c) => c.language === "javascript") ??
    codes[0]
  );
}

function toAlgorithmDetail(
  row: NonNullable<AlgorithmDetailRow>,
  lang?: string,
): AlgorithmDetail {
  return AlgorithmDetailSchema.parse({
    id:          row.id,
    slug:        row.slug,
    name:        row.name,
    description: row.description,
    difficulty:  row.difficulty,
    complexity:
      row.timeBest || row.timeAverage || row.timeWorst || row.spaceComplexity
        ? {
            timeBest:    row.timeBest,
            timeAverage: row.timeAverage,
            timeWorst:   row.timeWorst,
            space:       row.spaceComplexity,
          }
        : null,
    displayCode: pickDisplayCode(row.displayCodes, lang),
    tags:        row.tags.map((t: { tag: { id: string; label: string } }) => t.tag),
    forge:       row.forge
      ? {
          forgeCode:   row.forge.forgeCode,
          inputSchema: row.forge.inputSchema,
          guardRanges: row.forge.guardRanges,
          version:     row.forge.version,
        }
      : null,
  });
}