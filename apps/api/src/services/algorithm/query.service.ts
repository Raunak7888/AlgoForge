/**
 * Lists and searches algorithms (cursor pagination).
 * Non-admins only ever see published algorithms, whatever filters they send.
 * Results are cached per visibility scope; any mutation bumps the namespace version.
 */
import { Prisma, Difficulty } from "@algoforge/db";
import type { AlgorithmSummary, PageMeta } from "@algoforge/contracts";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { serializeAlgorithmSummary } from "../../serializers/algorithm";
import { paginate } from "../../utils/pagination";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmQuery, AlgorithmVisibility } from "../../types/algorithm.types";

export interface AlgorithmPage {
  items: AlgorithmSummary[];
  meta: PageMeta;
}

export async function listAlgorithms(query: AlgorithmQuery, visibility: AlgorithmVisibility): Promise<AlgorithmPage> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const effective: AlgorithmQuery = visibility.isAdmin ? query : { ...query, isPublished: true };

  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.list(version, scope, effective);
  const cached = await layeredCache.get<AlgorithmPage>(key);
  if (cached) return cached;

  const rows = await algorithmRepository.findPage(buildWhere(effective), {
    take: effective.limit + 1,
    ...(effective.cursor ? { cursor: effective.cursor } : {}),
  });
  const { items, meta } = paginate(rows, effective.limit, (row) => row.id);
  const page: AlgorithmPage = { items: items.map(serializeAlgorithmSummary), meta };

  await layeredCache.set(key, page);
  return page;
}

function buildWhere(query: AlgorithmQuery): Prisma.AlgorithmWhereInput {
  const mode = Prisma.QueryMode.insensitive;
  const term = query.search?.trim();
  return {
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty as Difficulty } : {}),
    ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
    ...(query.tag ? { tags: { some: { tag: { label: { equals: query.tag, mode } } } } } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode } },
            { description: { contains: term, mode } },
            { tags: { some: { tag: { label: { contains: term, mode } } } } },
          ],
        }
      : {}),
  };
}
