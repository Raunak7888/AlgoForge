import { Prisma, Difficulty } from "@algoforge/db";
import {
  ForgeCodeSchema,
  GuardRangesSchema,
  InputSchema,
  type CreateAlgorithm,
  type UpdateAlgorithm,
} from "@algoforge/forge";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { categoryRepository } from "../../repositories/category.repository";
import { ALGO_CACHE_NAMESPACE } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { bumpCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";

type ExistingForge = {
  forgeCode:   Prisma.JsonValue;
  inputSchema: Prisma.JsonValue;
  guardRanges: Prisma.JsonValue;
  version:     number;
} | null;

export async function createAlgorithm(input: CreateAlgorithm) {
  if (input.forge) validateForge(input.forge);
  const category = await resolveCategory(input.categoryId);
  const created = await algorithmRepository.create(toCreateData(input, category.id));
  await bustCache();
  return created;
}

export async function updateAlgorithm(id: string, input: UpdateAlgorithm) {
  const existing = await algorithmRepository.findById(id);
  if (!existing) throw AppError.notFound("Algorithm not found.");

  if (input.forge) {
    validateForge(input.forge);
    if (!existing.forge) {
      if (!input.forge.forgeCode || !input.forge.inputSchema || !input.forge.guardRanges) {
        throw AppError.badRequest(
          "forgeCode, inputSchema, and guardRanges are all required when adding forge configuration for the first time.",
        );
      }
    }
  }

  const categoryId = input.categoryId
    ? (await resolveCategory(input.categoryId)).id
    : undefined;

  const updated = await algorithmRepository.update(
    id,
    toUpdateData(input, existing.forge ?? null, categoryId),
  );
  await bustCache();
  return updated;
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

function validateForge(
  forge: { forgeCode?: unknown; guardRanges?: unknown; inputSchema?: unknown },
): void {
  try {
    if (forge.forgeCode   !== undefined) ForgeCodeSchema.parse(forge.forgeCode);
    if (forge.guardRanges !== undefined) GuardRangesSchema.parse(forge.guardRanges);
    if (forge.inputSchema !== undefined) InputSchema.parse(forge.inputSchema);
  } catch (err) {
    throw AppError.badRequest(
      "Invalid forge configuration: " + (err instanceof Error ? err.message : "unknown"),
    );
  }
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toCreateData(input: CreateAlgorithm, categoryId: string) {
  return {
    slug:            input.slug,
    name:            input.name,
    description:     input.description,
    categoryId,
    difficulty:      input.difficulty as Difficulty,
    isPublished:     input.isPublished ?? false,
    timeBest:        input.complexity?.time?.best    ?? null,
    timeAverage:     input.complexity?.time?.average ?? null,
    timeWorst:       input.complexity?.time?.worst   ?? null,
    spaceComplexity: input.complexity?.space         ?? null,
    displayCodes:    input.displayCodes,
    forge: {
      forgeCode:   toJsonValue(input.forge.forgeCode),
      inputSchema: toJsonValue(input.forge.inputSchema),
      guardRanges: toJsonValue(input.forge.guardRanges),
    },
    tags: input.tags,
  };
}

/**
 * Only fields the caller actually sent are written. A partial `complexity` update
 * (e.g. only time.best) must never null out the other complexity columns.
 */
function complexityPatch(c: NonNullable<UpdateAlgorithm["complexity"]>) {
  return {
    ...(c.time?.best    !== undefined ? { timeBest:        c.time.best }    : {}),
    ...(c.time?.average !== undefined ? { timeAverage:     c.time.average } : {}),
    ...(c.time?.worst   !== undefined ? { timeWorst:       c.time.worst }   : {}),
    ...(c.space         !== undefined ? { spaceComplexity: c.space }        : {}),
  };
}

export function toUpdateData(
  input: UpdateAlgorithm,
  existingForge: ExistingForge,
  categoryId?: string,
): Prisma.AlgorithmUpdateInput & {
  displayCodes?: { language: string; code: string }[];
  tags?:         string[];
} {
  return {
    ...(input.slug        && { slug:        input.slug }),
    ...(input.name        && { name:        input.name }),
    ...(input.description && { description: input.description }),
    // Relation connect, not the unchecked scalar: Prisma rejects mixing checked
    // (nested relation writes) and unchecked (scalar foreign key) update input.
    ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    ...(input.difficulty  && { difficulty:  input.difficulty as Difficulty }),
    ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
    ...(input.complexity ? complexityPatch(input.complexity) : {}),
    ...(input.displayCodes && { displayCodes: input.displayCodes }),
    ...(input.tags         && { tags:         input.tags }),
    ...(input.forge ? buildForgeWrite(input.forge, existingForge) : {}),
  };
}

function buildForgeWrite(
  forgeInput: NonNullable<UpdateAlgorithm["forge"]>,
  existingForge: ExistingForge,
): Pick<Prisma.AlgorithmUpdateInput, "forge"> {
  if (!existingForge) {
    return {
      forge: {
        create: {
          forgeCode:   toJsonValue(forgeInput.forgeCode),
          inputSchema: toJsonValue(forgeInput.inputSchema),
          guardRanges: toJsonValue(forgeInput.guardRanges),
          version:     1,
        },
      },
    };
  }

  return {
    forge: {
      update: {
        ...(forgeInput.forgeCode   !== undefined && { forgeCode:   toJsonValue(forgeInput.forgeCode) }),
        ...(forgeInput.inputSchema !== undefined && { inputSchema: toJsonValue(forgeInput.inputSchema) }),
        ...(forgeInput.guardRanges !== undefined && { guardRanges: toJsonValue(forgeInput.guardRanges) }),
      },
    },
  };
}

async function resolveCategory(categoryIdOrLabel: string) {
  const category = await categoryRepository.findByIdentifier(categoryIdOrLabel);
  if (!category) {
    throw AppError.badRequest(`Category "${categoryIdOrLabel}" does not exist.`);
  }
  return category;
}
