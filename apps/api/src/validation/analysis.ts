/**
 * Validation for analysis endpoints.
 *
 * Cursor strategy: the client receives an opaque base64url string.
 * Internally it encodes { createdAt, id } so the repository can do
 * a stable keyset paginate across (createdAt DESC, id DESC).
 */
import { CreateAnalysisRequestSchema, LIMITS, type CreateAnalysisRequest } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod } from "./common";

export type AnalysisInput = CreateAnalysisRequest;

/** Decoded, ready-to-use query that the service and repository accept. */
export type AnalysisHistoryQuery = {
  cursorCreatedAt?: Date;
  cursorId?: string;
  limit: number;
};

export type AnalysisCursor = {
  createdAt: string; // ISO 8601
  id: string;
};

const { defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE } = LIMITS.pagination.analysisHistory;

export function parseAnalysisInput(value: unknown): AnalysisInput {
  const result = CreateAnalysisRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid analysis request.");
  return result.data;
}

export function parseAnalysisHistoryQuery(value: unknown): AnalysisHistoryQuery {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { limit: DEFAULT_PAGE_SIZE };
  }

  const query = value as Record<string, unknown>;

  const rawLimit = typeof query.limit === "undefined" ? DEFAULT_PAGE_SIZE : Number(query.limit);
  if (!Number.isInteger(rawLimit)) throw AppError.badRequest("Limit must be an integer.");
  if (rawLimit < 1) throw AppError.badRequest("Limit must be at least 1.");
  if (rawLimit > MAX_PAGE_SIZE) throw AppError.badRequest(`Limit cannot exceed ${MAX_PAGE_SIZE}.`);

  const rawCursor = query.cursor;
  if (Array.isArray(rawCursor)) throw AppError.badRequest("Invalid cursor.");

  if (typeof rawCursor === "undefined" || rawCursor === "") {
    return { limit: rawLimit };
  }

  if (typeof rawCursor !== "string" || !rawCursor.trim()) {
    throw AppError.badRequest("Cursor must be a non-empty string.");
  }

  const decoded = decodeAnalysisCursor(rawCursor.trim());
  return {
    cursorCreatedAt: new Date(decoded.createdAt),
    cursorId: decoded.id,
    limit: rawLimit,
  };
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
      !value.id.trim()
    ) {
      throw new Error("Malformed cursor.");
    }

    return { createdAt: value.createdAt, id: value.id.trim() };
  } catch {
    throw AppError.badRequest("Invalid cursor.");
  }
}
