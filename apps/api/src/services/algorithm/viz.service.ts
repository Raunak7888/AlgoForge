/**
 * Returns the forge / visualisation config for an algorithm.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 */
import { AlgorithmExecutionSchema, type AlgorithmExecution } from "@algoforge/forge";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmVisibility } from "../../types/algorithm.types";

export async function getAlgorithmVisualization(
  id: string,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmExecution> {
  const scope   = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key     = algorithmCacheKeys.viz(version, scope, id);
  const cached  = await layeredCache.get<AlgorithmExecution>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!row || (!visibility.isAdmin && !row.isPublished)) {
    throw AppError.notFound("Algorithm not found.");
  }
  if (!row.forge) throw AppError.notFound("No forge configuration found for this algorithm.");

  const result = AlgorithmExecutionSchema.parse({
    algorithmId: row.id,
    name:        row.name,
    forge: {
      forgeCode:   row.forge.forgeCode,
      inputSchema: row.forge.inputSchema,
      guardRanges: row.forge.guardRanges,
      version:     row.forge.version,
    },
  });

  await layeredCache.set(key, result);
  return result;
}
