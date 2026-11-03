/**
 * Returns the forge / visualisation config for an algorithm.
 * The forge config is the most frequently read object for the visualiser UI
 * so it gets its own dedicated cache key.
 */
import { AlgorithmExecutionSchema, type AlgorithmExecution } from "@algoforge/forge";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { layeredCache } from "../lib/layered-cache";

export async function getAlgorithmVisualization(id: string): Promise<AlgorithmExecution> {
  const key    = algorithmCacheKeys.viz(id);
  const cached = await layeredCache.get<AlgorithmExecution>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!row)       throw AppError.notFound("Algorithm not found.");
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