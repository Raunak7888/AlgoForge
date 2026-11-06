/**
 * Validation for analysis endpoints.
 *
 * Cursor strategy: the client receives an opaque base64url string.
 * Internally it encodes { createdAt, id, sort } so the repository can do a stable keyset
 * paginate across (createdAt, id) in the requested direction.
 */
import { z } from "zod";
import { AnalysisLanguageSchema, CreateAnalysisRequestSchema, LIMITS, type AnalysisLanguage, type CreateAnalysisRequest } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

export type AnalysisInput = CreateAnalysisRequest;
export type AnalysisSort = "newest" | "oldest";

/** Decoded, ready-to-use query that the service and repository accept. */
export type AnalysisHistoryQuery = {
  cursorCreatedAt?: Date;
  cursorId?: string;
  limit: number;
  q?: string;
  language?: AnalysisLanguage;
  sort: AnalysisSort;
};

export type AnalysisCursor = {
  createdAt: string; // ISO 8601
  id: string;
  sort?: AnalysisSort;
};

const { defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE } = LIMITS.pagination.analysisHistory;

const FilterSchema = z.object({
  q: z.string().trim().max(LIMITS.search.maxQueryChars).optional(),
  language: AnalysisLanguageSchema.optional(),
  sort: z.enum(["newest", "oldest"]).default("newest"),
});

const blank = (v: unknown) => (v === "" ? undefined : v);

export function parseAnalysisInput(value: unknown): AnalysisInput {
  const result = CreateAnalysisRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid analysis request.");
  return result.data;
}

export function parseAnalysisHistoryQuery(value: unknown): AnalysisHistoryQuery {
  const query = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  const rawLimit = query.limit === undefined || query.limit === "" ? DEFAULT_PAGE_SIZE : Number(query.limit);
  if (!Number.isInteger(rawLimit)) throw AppError.badRequest("Limit must be an integer.");
  if (rawLimit < 1) throw AppError.badRequest("Limit must be at least 1.");
  if (rawLimit > MAX_PAGE_SIZE) throw AppError.badRequest(`Limit cannot exceed ${MAX_PAGE_SIZE}.`);

  const filters = FilterSchema.safeParse({ q: blank(query.q), language: blank(query.language), sort: blank(query.sort) });
  if (!filters.success) throw badRequestFromZod(filters.error, "Invalid query.");
  const { q, language, sort } = filters.data;
  const base = { limit: rawLimit, sort, ...(q ? { q } : {}), ...(language ? { language } : {}) };

  const rawCursor = query.cursor;
  if (Array.isArray(rawCursor)) throw AppError.badRequest("Invalid cursor.");
  if (rawCursor === undefined || rawCursor === "") return base;
  if (typeof rawCursor !== "string" || !rawCursor.trim()) throw AppError.badRequest("Cursor must be a non-empty string.");

  const decoded = decodeAnalysisCursor(rawCursor.trim());
  if (decoded.sort !== undefined && decoded.sort !== sort) throw AppError.badRequest("Cursor does not match the requested sort order.");
  return { ...base, cursorCreatedAt: new Date(decoded.createdAt), cursorId: decoded.id };
}

export function encodeAnalysisCursor(cursor: AnalysisCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAnalysisCursor(cursor: string): AnalysisCursor {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf8");
    const value = JSON.parse(decoded) as Partial<AnalysisCursor>;

    if (
      typeof value.createdAt !== "string" ||
      Number.isNaN(Date.parse(value.createdAt)) ||
      typeof value.id !== "string" ||
      !value.id.trim() ||
      (value.sort !== undefined && value.sort !== "newest" && value.sort !== "oldest")
    ) {
      throw new Error("Malformed cursor.");
    }

    return { createdAt: value.createdAt, id: value.id.trim(), ...(value.sort ? { sort: value.sort } : {}) };
  } catch {
    throw AppError.badRequest("Invalid cursor.");
  }
}
