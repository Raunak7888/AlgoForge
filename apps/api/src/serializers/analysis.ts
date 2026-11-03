import {
  AnalysisLanguageSchema,
  parseStoredAnalysisResult,
  type AnalysisHistoryItem,
  type AnalysisLanguage,
  type AnalysisRecordResponse,
  type AnalysisResult,
  type ResultStatus,
  type SharedAnalysisResponse,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { logger } from "../utils/logger";
import { toIso } from "./dates";

type DateLike = Date | string;

function languageOf(value: string): AnalysisLanguage | null {
  const parsed = AnalysisLanguageSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Never throws: a result that cannot be read degrades to result: null and is logged. */
function readResult(analysisId: string, raw: unknown): { result: AnalysisResult | null; resultStatus: ResultStatus } {
  const parsed = parseStoredAnalysisResult(raw);
  if (parsed.status === "ok") return { result: parsed.result, resultStatus: "ok" };
  logger.warn("stored analysis result is unreadable", { analysisId, reason: parsed.reason, schemaVersion: parsed.version });
  return { result: null, resultStatus: "unreadable" };
}

export interface AnalysisRow {
  id: string;
  language: string;
  result: unknown;
  createdAt: DateLike;
}

export function serializeAnalysisRecord(row: AnalysisRow): AnalysisRecordResponse {
  const language = languageOf(row.language);
  if (!language) throw AppError.internal("Stored analysis has an unsupported language.");
  const { result, resultStatus } = readResult(row.id, row.result);
  return { id: row.id, language, result, resultStatus, createdAt: toIso(row.createdAt) };
}

export interface HistoryRow {
  id: string;
  language: string;
  complexity: string | null;
  suggestion: string | null;
  createdAt: DateLike;
}

/** Returns null (and logs) for a row that cannot be represented, so one bad row never breaks a page. */
export function serializeHistoryItem(row: HistoryRow): AnalysisHistoryItem | null {
  const language = languageOf(row.language);
  if (!language) {
    logger.warn("skipping history row with unsupported language", { analysisId: row.id });
    return null;
  }
  return { id: row.id, language, complexity: row.complexity, suggestion: row.suggestion, createdAt: toIso(row.createdAt) };
}

export interface SharedAnalysisRow extends AnalysisRow {
  code: string;
  user: { id: string; name: string | null; username: string | null; image: string | null } | null;
}

export function serializeSharedAnalysis(row: SharedAnalysisRow): SharedAnalysisResponse {
  const language = languageOf(row.language);
  if (!language) throw AppError.internal("Stored analysis has an unsupported language.");
  const { result, resultStatus } = readResult(row.id, row.result);
  return {
    id: row.id,
    code: row.code,
    language,
    result,
    resultStatus,
    createdAt: toIso(row.createdAt),
    ...(row.user ? { creator: { id: row.user.id, name: row.user.name, username: row.user.username ?? row.user.name, avatarUrl: row.user.image } } : {}),
  };
}
