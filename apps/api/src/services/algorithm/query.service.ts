/**
 * Lists and searches algorithms.
 * Results are cached; the cache is busted on any mutation via mutation.service.ts.
 */
import { Prisma, Difficulty } from "@algoforge/db";
import { AlgorithmListItemSchema, type AlgorithmListItem } from "@algoforge/forge";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { algorithmCacheKeys } from "./cache-keys";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmQuery } from "../../types/algorithm.types";

export async function listAlgorithms(query: AlgorithmQuery): Promise<AlgorithmListItem[]> {
  const key    = algorithmCacheKeys.list(query);
  const cached = await layeredCache.get<AlgorithmListItem[]>(key);
  if (cached) return cached;

  const rows   = await algorithmRepository.findMany(buildWhere(query));

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