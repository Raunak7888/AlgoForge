/**
 * Fetches a single algorithm by id or slug.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 * Each (scope + id/slug + language) combination gets its own cache entry.
 */
import { AlgorithmDetailSchema, type AlgorithmDetail } from "@algoforge/forge";
import { algorithmRepository, type AlgorithmDetailRow } from "../../repositories/algorithm.repository";
import { layeredCache } from "../lib/layered-cache";
import { getCacheVersion } from "../lib/cache-version";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import type { AlgorithmVisibility } from "../../types/algorithm.types";

function visibleTo(row: AlgorithmDetailRow, visibility: AlgorithmVisibility): row is NonNullable<AlgorithmDetailRow> {
  return row !== null && (visibility.isAdmin || row.isPublished);
}

export async function getAlgorithmById(
  id: string,
  lang: string | undefined,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmDetail> {
  const scope   = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key     = algorithmCacheKeys.byId(version, scope, id, lang);
  const cached  = await layeredCache.get<AlgorithmDetail>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

  const result = toAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}

export async function getAlgorithmBySlug(
  slug: string,
  lang: string | undefined,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmDetail> {
  const scope   = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key     = algorithmCacheKeys.bySlug(version, scope, slug, lang);
  const cached  = await layeredCache.get<AlgorithmDetail>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findBySlug(slug);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

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
