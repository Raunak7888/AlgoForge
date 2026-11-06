import { Prisma, Difficulty } from "@algoforge/db";
import type { AlgorithmDetailResponse, CreateAlgorithmRequest, UpdateAlgorithmRequest } from "@algoforge/contracts";
import { SCRIPT_SCHEMA_VERSION } from "@algoforge/visualizer-core";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { categoryRepository } from "../../repositories/category.repository";
import { serializeAlgorithmDetail } from "../../serializers/algorithm";
import { ALGO_CACHE_NAMESPACE } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { bumpCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import { assertValidScript } from "../script.service";

const NEEDS_SCRIPT = "A published algorithm needs a visualizer script.";

export async function createAlgorithm(input: CreateAlgorithmRequest, actorId?: string): Promise<AlgorithmDetailResponse> {
  const script = input.script ?? null;
  if (script !== null) assertValidScript(script);
  const isPublished = input.isPublished ?? false;
  if (isPublished && script === null) throw AppError.badRequest(NEEDS_SCRIPT);

  const category = await resolveCategory(input.categoryId);
  const created = await algorithmRepository.create({
    ...toCreateData(input, category.id, script),
    publishedAt: isPublished ? new Date() : null,
    createdById: actorId ?? null,
  });
  await bustCache();
  return serializeAlgorithmDetail(created);
}

export async function updateAlgorithm(id: string, input: UpdateAlgorithmRequest): Promise<AlgorithmDetailResponse> {
  const existing = await algorithmRepository.findById(id);
  if (!existing) throw AppError.notFound("Algorithm not found.");

  if (typeof input.script === "string") assertValidScript(input.script);
  const script = input.script !== undefined ? input.script : existing.script;
  const willBePublished = input.isPublished ?? existing.isPublished;
  if (willBePublished && !script) throw AppError.badRequest(NEEDS_SCRIPT);

  const categoryId = input.categoryId ? (await resolveCategory(input.categoryId)).id : undefined;

  const updated = await algorithmRepository.update(id, {
    ...toUpdateData(input, null, categoryId),
    // First publication time: set when a draft becomes published, never rewritten afterwards.
    ...(input.isPublished === true && !existing.isPublished ? { publishedAt: new Date() } : {}),
  });
  await bustCache();
  return serializeAlgorithmDetail(updated);
}

export async function deleteAlgorithm(id: string): Promise<void> {
  const existing = await algorithmRepository.findById(id);
  if (!existing) throw AppError.notFound("Algorithm not found.");

  await algorithmRepository.delete(id);
  await bustCache();
}

/**
 * Invalidates every cached algorithm view on every instance by bumping the namespace version.
 * `meta:slugs` (used by the AI query processor) is a plain key and is deleted explicitly.
 */
async function bustCache(): Promise<void> {
  await bumpCacheVersion(ALGO_CACHE_NAMESPACE);
  await layeredCache.del("meta:slugs");
}

function toCreateData(input: CreateAlgorithmRequest, categoryId: string, script: string | null) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    categoryId,
    difficulty: (input.difficulty ?? "beginner") as Difficulty,
    isPublished: input.isPublished ?? false,
    timeBest: input.complexity.time.best,
    timeAverage: input.complexity.time.average,
    timeWorst: input.complexity.time.worst,
    spaceComplexity: input.complexity.space,
    displayCodes: input.displayCodes,
    script,
    scriptVersion: SCRIPT_SCHEMA_VERSION,
    tags: input.tags ?? [],
  };
}

/**
 * Only fields the caller actually sent are written. A partial `complexity` update
 * (e.g. only time.best) must never null out the other complexity columns.
 */
function complexityPatch(c: NonNullable<UpdateAlgorithmRequest["complexity"]>) {
  return {
    ...(c.time?.best !== undefined ? { timeBest: c.time.best } : {}),
    ...(c.time?.average !== undefined ? { timeAverage: c.time.average } : {}),
    ...(c.time?.worst !== undefined ? { timeWorst: c.time.worst } : {}),
    ...(c.space !== undefined ? { spaceComplexity: c.space } : {}),
  };
}

/** The second argument is kept only so older call sites keep compiling; it is ignored. */
export function toUpdateData(
  input: UpdateAlgorithmRequest,
  _legacy?: unknown,
  categoryId?: string,
): Prisma.AlgorithmUpdateInput & {
  displayCodes?: { language: string; code: string }[];
  tags?: string[];
} {
  return {
    ...(input.slug && { slug: input.slug }),
    ...(input.name && { name: input.name }),
    ...(input.description && { description: input.description }),
    // Relation connect, not the unchecked scalar: Prisma rejects mixing checked
    // (nested relation writes) and unchecked (scalar foreign key) update input.
    ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    ...(input.difficulty && { difficulty: input.difficulty as Difficulty }),
    ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
    ...(input.complexity ? complexityPatch(input.complexity) : {}),
    ...(input.displayCodes && { displayCodes: input.displayCodes }),
    ...(input.tags && { tags: input.tags }),
    ...(input.script !== undefined ? { script: input.script, scriptVersion: SCRIPT_SCHEMA_VERSION } : {}),
  };
}

async function resolveCategory(categoryIdOrLabel: string) {
  const category = await categoryRepository.findByIdentifier(categoryIdOrLabel);
  if (!category) {
    throw AppError.badRequest(`Category "${categoryIdOrLabel}" does not exist.`);
  }
  return category;
}
