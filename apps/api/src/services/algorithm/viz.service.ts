/**
 * Returns the visualizer script of an algorithm.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 */
import { AlgorithmExecutionResponseSchema, type AlgorithmExecutionResponse } from "@algoforge/contracts";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmVisibility } from "../../types/algorithm.types";

export async function getAlgorithmVisualization(
  id: string,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmExecutionResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.viz(version, scope, id);
  const cached = await layeredCache.get<AlgorithmExecutionResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!row || (!visibility.isAdmin && !row.isPublished)) {
    throw AppError.notFound("Algorithm not found.");
  }
  if (!row.script) throw AppError.notFound("This algorithm has no visualizer script.");

  const result = AlgorithmExecutionResponseSchema.parse({
    algorithmId: row.id,
    name: row.name,
    script: row.script,
    scriptVersion: row.scriptVersion,
  });

  await layeredCache.set(key, result);
  return result;
}
