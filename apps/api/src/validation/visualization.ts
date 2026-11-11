import { z } from "zod";
import {
  CreateVisualizationRequestSchema,
  GenerateVisualizationRequestSchema,
  LIMITS,
  UpdateVisualizationRequestSchema,
  ValidateScriptRequestSchema,
  type CreateVisualizationRequest,
  type GenerateVisualizationRequest,
  type UpdateVisualizationRequest,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod, ensureString } from "./common";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseVisualizationId(value: unknown): string {
  const id = ensureString(value, "Visualization id is required.");
  if (!ID_RE.test(id)) throw AppError.badRequest("Invalid visualization id.");
  return id;
}

export function parseCreateVisualization(value: unknown): CreateVisualizationRequest {
  const r = CreateVisualizationRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid visualization.");
  return r.data;
}

export function parseUpdateVisualization(value: unknown): UpdateVisualizationRequest {
  const r = UpdateVisualizationRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid visualization.");
  if (Object.values(r.data).every((v) => v === undefined)) {
    throw AppError.badRequest("Provide at least one field to update.");
  }
  return r.data;
}

export function parseValidateScript(value: unknown): string {
  const r = ValidateScriptRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid script.");
  return r.data.script;
}

const { defaultSize, maxSize } = LIMITS.pagination.visualizations;
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().regex(ID_RE, "Invalid cursor.").optional(),
});

export interface VisualizationListQuery {
  limit: number;
  cursor?: string;
}

export function parseListVisualizationsQuery(value: unknown): VisualizationListQuery {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== ""))
      : {};
  const r = ListQuerySchema.safeParse(raw);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query.");
  return { limit: r.data.limit, ...(r.data.cursor ? { cursor: r.data.cursor } : {}) };
}

export function parseGenerateVisualization(value: unknown): GenerateVisualizationRequest {
  const r = GenerateVisualizationRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid code.");
  return r.data;
}
