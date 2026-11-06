/**
 * Fetches a single algorithm by id or slug.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 * Each (scope + id/slug + language) combination gets its own cache entry.
 */
import type { AlgorithmDetailResponse } from "@algoforge/contracts";
import { algorithmRepository, type AlgorithmDetailRow } from "../../repositories/algorithm.repository";
import { serializeAlgorithmDetail } from "../../serializers/algorithm";
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
): Promise<AlgorithmDetailResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.byId(version, scope, id, lang);
  const cached = await layeredCache.get<AlgorithmDetailResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

  const result = serializeAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}

export async function getAlgorithmBySlug(
  slug: string,
  lang: string | undefined,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmDetailResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.bySlug(version, scope, slug, lang);
  const cached = await layeredCache.get<AlgorithmDetailResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findBySlug(slug);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

  const result = serializeAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}
