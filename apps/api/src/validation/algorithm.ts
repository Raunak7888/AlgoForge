import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  CreateAlgorithmRequestSchema,
  DifficultySchema,
  LIMITS,
  UpdateAlgorithmRequestSchema,
  type CreateAlgorithmRequest,
  type UpdateAlgorithmRequest,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import type { AlgorithmQuery } from "../types/algorithm.types";
import { badRequestFromZod } from "./common";

export function parseCreateAlgorithm(value: unknown): CreateAlgorithmRequest {
  const result = CreateAlgorithmRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid algorithm data.");
  return result.data;
}

export function parseUpdateAlgorithm(value: unknown): UpdateAlgorithmRequest {
  const result = UpdateAlgorithmRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid algorithm data.");
  return result.data;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CUID_REGEX = /^c[a-z0-9]{24}$/;
const SLUG_REGEX = /^[a-z0-9-]+$/;

const { defaultSize, maxSize } = LIMITS.pagination.algorithms;

const QuerySchema = z.object({
  q: z.string().max(LIMITS.search.maxQueryChars).optional(),
  search: z.string().max(LIMITS.search.maxQueryChars).optional(),
  categoryId: z.string().min(1).max(50).optional(),
  difficulty: DifficultySchema.optional(),
  tag: z.string().min(1).max(50).optional(),
  isPublished: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().regex(UUID_REGEX, "Invalid cursor.").optional(),
});

/** Blank values are ignored; a bad value is a 400 (it used to reach the database as a 500). */
export function parseAlgorithmQuery(value: unknown): AlgorithmQuery {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== ""))
      : {};
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) throw badRequestFromZod(parsed.error, "Invalid query.");
  const d = parsed.data;
  const search = (d.q ?? d.search)?.trim();
  return {
    limit: d.limit,
    ...(d.categoryId ? { categoryId: d.categoryId } : {}),
    ...(d.difficulty ? { difficulty: d.difficulty } : {}),
    ...(d.tag ? { tag: d.tag } : {}),
    ...(d.isPublished ? { isPublished: d.isPublished === "true" } : {}),
    ...(search ? { search } : {}),
    ...(d.cursor ? { cursor: d.cursor } : {}),
  };
}

export function validateIdParam(req: Request, _res: Response, next: NextFunction): void {
  const id = req.params.id;
  if (!id || (!UUID_REGEX.test(id) && !CUID_REGEX.test(id))) {
    return next(AppError.badRequest("Invalid algorithm ID format. Expected UUID or cuid."));
  }
  next();
}

export function validateSlugParam(req: Request, _res: Response, next: NextFunction): void {
  const slug = req.params.slug;
  if (!slug || !SLUG_REGEX.test(slug)) {
    return next(AppError.badRequest("Invalid slug format. Expected kebab-case string."));
  }
  next();
}
