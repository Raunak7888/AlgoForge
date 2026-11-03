/**
 * Lists and searches algorithms.
 * Non-admins only ever see published algorithms, whatever filters they send.
 * Results are cached per visibility scope; any mutation bumps the namespace version.
 */
import { Prisma, Difficulty } from "@algoforge/db";
import { AlgorithmListItemSchema, type AlgorithmListItem } from "@algoforge/forge";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmQuery, AlgorithmVisibility } from "../../types/algorithm.types";

export async function listAlgorithms(
  query: AlgorithmQuery,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmListItem[]> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const effective: AlgorithmQuery = visibility.isAdmin ? query : { ...query, isPublished: true };

  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key     = algorithmCacheKeys.list(version, scope, effective);
  const cached  = await layeredCache.get<AlgorithmListItem[]>(key);
  if (cached) return cached;

  const rows = await algorithmRepository.findMany(buildWhere(effective));

  // The DB returns flat complexity fields; the schema expects a nested object.
  const result = rows.map((row) =>
    AlgorithmListItemSchema.parse({
      id:         row.id,
      slug:       row.slug,
      name:       row.name,
      categoryId: row.categoryId,
      difficulty: row.difficulty,
      complexity:
        row.timeBest || row.timeAverage || row.timeWorst || row.spaceComplexity
          ? {
              timeBest:    row.timeBest,
              timeAverage: row.timeAverage,
              timeWorst:   row.timeWorst,
              space:       row.spaceComplexity,
            }
          : null,
    }),
  );

  await layeredCache.set(key, result);
  return result;
}

// ─── Private ──────────────────────────────────────────────────────────────────

function buildWhere(query: AlgorithmQuery): Prisma.AlgorithmWhereInput {
  return {
    ...(query.categoryId                ? { categoryId:  query.categoryId }                : {}),
    ...(query.difficulty                ? { difficulty:  query.difficulty as Difficulty }  : {}),
    ...(query.isPublished !== undefined ? { isPublished: query.isPublished }               : {}),
    ...(query.search ? {
      OR: [
        { name:        { contains: query.search, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
      ],
    } : {}),
  };
}
