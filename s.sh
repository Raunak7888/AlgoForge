#!/usr/bin/env bash
# =============================================================================
# AlgoForge - Phase 3: API contract and shared types
# Run from the project root:  bash phase3.sh
# Never reads/modifies .env files, migrations or user data. Backups go to
# .phase3-backup/<timestamp>/ before any existing file is changed.
# =============================================================================
set -Eeuo pipefail

ROOT="$(pwd)"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$ROOT/.phase3-backup/$TS"
WORK="$(mktemp -d)"
STAMP="$WORK/stamp"
: >"$STAMP"
trap 'rm -rf "$WORK"' EXIT
trap 'echo "ERROR: phase3.sh failed near line $LINENO" >&2' ERR

CHANGED=()
UNCHANGED=()
WRITTEN_TS=()
VALIDATION=()
REQUIRED_FAILED=0

die() { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

[[ -f apps/api/package.json && -f packages/db/package.json && -d apps/web ]] || die "Run this from the AlgoForge project root."
for f in apps/api/src/middleware/request-id.ts apps/api/tsup.config.ts apps/api/src/utils/logger.ts apps/api/src/security/no-hardcoded-secrets.test.ts; do
  [[ -f "$f" ]] || die "Phase 2 marker missing: $f. Complete Phase 1 and 2 first."
done
command -v node >/dev/null 2>&1 || die "node is required."
if [[ -f pnpm-workspace.yaml ]] && ! grep -qE 'packages/\*' pnpm-workspace.yaml; then
  echo "WARN: pnpm-workspace.yaml does not list packages/*; @algoforge/contracts will not link until it does."
fi

guard_path() {
  case "$1" in /*) die "absolute path refused: $1";; esac
  case "$(basename "$1")" in .env|.env.*) die "refusing to touch environment file: $1";; esac
}

backup_file() {
  local rel="$1"
  if [[ -f "$rel" && ! -f "$BACKUP_DIR/$rel" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$rel")"
    cp -p "$rel" "$BACKUP_DIR/$rel"
  fi
}

# write_file <relpath>   (content on stdin). Skips when identical.
write_file() {
  local rel="$1" tmp
  guard_path "$rel"
  tmp="$(mktemp "$WORK/wf.XXXXXX")"
  cat >"$tmp"
  if [[ -f "$rel" ]] && cmp -s "$tmp" "$rel"; then
    rm -f "$tmp"; UNCHANGED+=("$rel"); return 0
  fi
  if [[ -f "$rel" ]]; then backup_file "$rel"; CHANGED+=("M $rel"); else CHANGED+=("A $rel"); fi
  mkdir -p "$(dirname "$rel")"
  cat "$tmp" >"$rel"
  rm -f "$tmp"
  case "$rel" in *.ts|*.tsx) WRITTEN_TS+=("$rel");; esac
}

# ---- node patch runner (used for surgical edits of existing files) ----------
cat >"$WORK/runner.mjs" <<'__P3_EOF__'
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const [file, transformPath, backupDir] = process.argv.slice(2);
const mod = await import(pathToFileURL(path.resolve(transformPath)).href);
const src = fs.readFileSync(file, "utf8");
const out = mod.default(src, file);
if (out === null || out === src) { process.stdout.write("UNCHANGED"); process.exit(0); }
const dest = path.join(backupDir, file);
fs.mkdirSync(path.dirname(dest), { recursive: true });
if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
fs.writeFileSync(file, out);
process.stdout.write("CHANGED");
__P3_EOF__

# patch_file <relpath>  (ESM transform on stdin: export default (src) => string|null)
patch_file() {
  local rel="$1" tname out
  guard_path "$rel"
  [[ -f "$rel" ]] || die "cannot patch missing file: $rel"
  tname="$WORK/transform-$(printf '%s' "$rel" | tr '/.' '__').mjs"
  cat >"$tname"
  out="$(node "$WORK/runner.mjs" "$rel" "$tname" "$BACKUP_DIR")" || die "patch failed for $rel"
  case "$out" in
    CHANGED) CHANGED+=("M $rel");;
    UNCHANGED) UNCHANGED+=("$rel");;
    *) die "unexpected patch result for $rel: $out";;
  esac
}

# =============================================================================
info "1/6 Contracts package: packages/contracts"
# =============================================================================

write_file packages/contracts/package.json <<'__P3_EOF__'
{
  "name": "@algoforge/contracts",
  "version": "1.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "sideEffects": false,
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@algoforge/analysis": "workspace:*",
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "typescript": "^5.9.3",
    "vitest": "^5.0.5"
  }
}
__P3_EOF__

write_file packages/contracts/tsconfig.json <<'__P3_EOF__'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src"]
}
__P3_EOF__

write_file packages/contracts/src/limits.ts <<'__P3_EOF__'
/**
 * The single source of truth for every size, length and pagination limit.
 * The API validators, the Express body parser and (from Phase 6) the frontend read these.
 */
export const LIMITS = {
  code: { maxChars: 20_000 },
  script: { maxChars: 200_000 },
  message: { minChars: 5, maxChars: 2_000 },
  title: { maxChars: 200 },
  pagination: {
    analysisHistory: { defaultSize: 10, maxSize: 50 },
    explainSessions: { defaultSize: 20, maxSize: 50 },
    adminUsers: { defaultSize: 50, maxSize: 100 },
  },
  /** Must stay >= 4x script.maxChars so an escaped script still fits in a JSON body. */
  body: { jsonMaxBytes: 1_048_576 },
} as const;

export interface PageSizeLimits {
  readonly defaultSize: number;
  readonly maxSize: number;
}

export const JSON_BODY_LIMIT_BYTES: number = LIMITS.body.jsonMaxBytes;

export const CAPABILITY_LIMITS = {
  codeMaxChars: LIMITS.code.maxChars,
  scriptMaxChars: LIMITS.script.maxChars,
  messageMaxChars: LIMITS.message.maxChars,
} as const;
__P3_EOF__

write_file packages/contracts/src/common.ts <<'__P3_EOF__'
import { z } from "zod";
import type { PageSizeLimits } from "./limits";

export const REQUEST_ID_HEADER = "X-Request-Id";
export const CSRF_HEADER_NAME = "X-CSRF-Token";
export const CSRF_COOKIE_NAME = "af_csrf";
export const ACCESS_COOKIE_NAME = "af_access";
export const RETRY_AFTER_HEADER = "Retry-After";

/** Every date on the wire is an ISO 8601 UTC string. */
export const IsoDateTimeSchema = z.iso.datetime();
export const CursorSchema = z.string().min(1).max(512);

/** Response conventions: a single resource is a plain object; every list is { data }, paginated lists add { meta }. */
export const PageMetaSchema = z.object({ nextCursor: z.string().nullable(), hasMore: z.boolean() });
export type PageMeta = z.infer<typeof PageMetaSchema>;

export const listResponse = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });
export const paginatedResponse = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item), meta: PageMetaSchema });

/** Documentation schema for ?limit&cursor (query values arrive as strings and are coerced by the API). */
export const pageQuerySchema = (limits: PageSizeLimits) =>
  z.object({
    limit: z.number().int().min(1).max(limits.maxSize).optional().describe(`Page size. Default ${limits.defaultSize}, max ${limits.maxSize}.`),
    cursor: CursorSchema.optional().describe("Opaque cursor: meta.nextCursor of the previous page."),
  });

export const IdParamsSchema = z.object({ id: z.string().min(1) });
export const SlugParamsSchema = z.object({ slug: z.string().min(1) });
export const ShareIdParamsSchema = z.object({ shareId: z.string().min(1) });
__P3_EOF__

write_file packages/contracts/src/errors.ts <<'__P3_EOF__'
import { z } from "zod";

export const ERROR_CODES = [
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "PAYLOAD_TOO_LARGE",
  "TOO_MANY_REQUESTS",
  "BAD_GATEWAY",
  "INTERNAL_ERROR",
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  BAD_GATEWAY: 502,
  INTERNAL_ERROR: 500,
};

export const ErrorDetailSchema = z.object({ path: z.string(), message: z.string() });
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/** The one error envelope. 429 responses also carry a Retry-After header. */
export const ErrorResponseSchema = z.object({
  error: z.object({ code: ErrorCodeSchema, message: z.string(), details: z.array(ErrorDetailSchema).optional() }),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/users.ts <<'__P3_EOF__'
import { z } from "zod";
import { SafeUserSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema } from "./common";

export { SafeUserSchema };
export type { SafeUser } from "@algoforge/analysis";

export const UsernameSchema = z.string().regex(/^[a-z0-9_]{3,30}$/, "Use 3-30 lowercase letters, digits or underscores.");
export const UpdateProfileRequestSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  username: UsernameSchema.optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const DeviceSessionSchema = z.object({
  id: z.string(),
  createdAt: IsoDateTimeSchema,
  lastUsedAt: IsoDateTimeSchema,
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  current: z.boolean(),
});
export const DeviceSessionListResponseSchema = z.object({ data: z.array(DeviceSessionSchema) });
export type DeviceSession = z.infer<typeof DeviceSessionSchema>;
__P3_EOF__

write_file packages/contracts/src/auth.ts <<'__P3_EOF__'
import { z } from "zod";

export const UserRoleSchema = z.enum(["USER", "ADMIN"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  role: UserRoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const MeResponseSchema = z.object({ user: AuthUserSchema });
export type MeResponse = z.infer<typeof MeResponseSchema>;
/** POST /auth/refresh returns the same shape as GET /auth/me. */
export const RefreshResponseSchema = MeResponseSchema;
export type RefreshResponse = MeResponse;
__P3_EOF__

write_file packages/contracts/src/categories.ts <<'__P3_EOF__'
import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";

export const CategorySchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().nullable(),
  iconName: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export type CategoryDto = z.infer<typeof CategorySchema>;

export const CategoryListResponseSchema = listResponse(CategorySchema);
export type CategoryListResponse = z.infer<typeof CategoryListResponseSchema>;

export const CreateCategoryRequestSchema = z.object({
  id: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  iconName: z.string().max(50).optional(),
  sortOrder: z.number().int().optional(),
});
export const UpdateCategoryRequestSchema = CreateCategoryRequestSchema.partial().omit({ id: true });
export type CreateCategoryRequest = z.infer<typeof CreateCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof UpdateCategoryRequestSchema>;
__P3_EOF__

write_file packages/contracts/src/algorithms.ts <<'__P3_EOF__'
import { z } from "zod";
import { listResponse } from "./common";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ComplexitySummarySchema = z.object({
  timeBest: z.string().nullable(),
  timeAverage: z.string().nullable(),
  timeWorst: z.string().nullable(),
  space: z.string().nullable(),
});

export const AlgorithmSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  categoryId: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
});

export const TagSchema = z.object({ id: z.string(), label: z.string() });
export const DisplayCodeSchema = z.object({ language: z.string(), code: z.string() });

/** `forge` is the legacy executable config. It is opaque here and is replaced by a script in Phase 6. */
export const AlgorithmDetailResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
  displayCode: DisplayCodeSchema.nullable(),
  tags: z.array(TagSchema),
  forge: z.unknown().nullable().optional(),
});

export const AlgorithmListResponseSchema = listResponse(AlgorithmSummarySchema);
export const AlgorithmExecutionResponseSchema = z.object({ algorithmId: z.string(), name: z.string(), forge: z.unknown() });

export const AlgorithmListQuerySchema = z.object({
  categoryId: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  isPublished: z.enum(["true", "false"]).optional().describe("Honoured for admins only; everyone else sees published algorithms."),
  search: z.string().optional(),
});
export const AlgorithmLangQuerySchema = z.object({ lang: z.string().optional() });

const ComplexityInputSchema = z.object({
  time: z.object({ best: z.string().min(1), average: z.string().min(1), worst: z.string().min(1) }),
  space: z.string().min(1),
});
const LegacyForgeSchema = z.record(z.string(), z.unknown());

export const CreateAlgorithmRequestSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: ComplexityInputSchema,
  displayCodes: z.array(DisplayCodeSchema).min(1),
  forge: LegacyForgeSchema,
  tags: z.array(z.string().min(1)),
});

export const UpdateAlgorithmRequestSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name: z.string().min(1).max(200).optional(),
  description: z.string().min(1).max(2000).optional(),
  categoryId: z.string().min(1).optional(),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: z
    .object({
      time: z.object({ best: z.string().min(1).optional(), average: z.string().min(1).optional(), worst: z.string().min(1).optional() }).optional(),
      space: z.string().min(1).optional(),
    })
    .optional(),
  displayCodes: z.array(DisplayCodeSchema).min(1).optional(),
  forge: LegacyForgeSchema.optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export type AlgorithmSummary = z.infer<typeof AlgorithmSummarySchema>;
export type AlgorithmDetailResponse = z.infer<typeof AlgorithmDetailResponseSchema>;
export type AlgorithmListResponse = z.infer<typeof AlgorithmListResponseSchema>;
export type AlgorithmListQuery = z.input<typeof AlgorithmListQuerySchema>;
__P3_EOF__

write_file packages/contracts/src/analysis.ts <<'__P3_EOF__'
import { z } from "zod";
import {
  AnalysisHistoryItemSchema,
  AnalysisHistoryMetaSchema,
  AnalysisHistoryResponseSchema,
  AnalysisLanguageSchema,
  AnalysisResultSchema,
  BottleneckSchema,
  BreakdownSchema,
  ComparisonSchema,
  ComplexitySchema,
  ImprovementSchema,
} from "@algoforge/analysis";
import { CursorSchema, IsoDateTimeSchema, pageQuerySchema } from "./common";
import { LIMITS } from "./limits";
import { SafeUserSchema } from "./users";

export {
  AnalysisHistoryItemSchema,
  AnalysisHistoryMetaSchema,
  AnalysisHistoryResponseSchema,
  AnalysisLanguageSchema,
  AnalysisResultSchema,
  BottleneckSchema,
  BreakdownSchema,
  ComparisonSchema,
  ComplexitySchema,
  ImprovementSchema,
};
export type { AnalysisHistoryItem, AnalysisHistoryResponse, AnalysisLanguage, AnalysisResult } from "@algoforge/analysis";

export type ComplexityResult = z.infer<typeof ComplexitySchema>;
export type Breakdown = z.infer<typeof BreakdownSchema>;
export type Bottleneck = z.infer<typeof BottleneckSchema>;
export type Improvement = z.infer<typeof ImprovementSchema>;
export type Comparison = z.infer<typeof ComparisonSchema>;

export const CreateAnalysisRequestSchema = z.object({
  code: z.string().trim().min(1, "Code must be a non-empty string.").max(LIMITS.code.maxChars, "Code payload is too large."),
  language: AnalysisLanguageSchema,
});
export type CreateAnalysisRequest = z.infer<typeof CreateAnalysisRequestSchema>;

/** "ok": result parsed with the current schema. "unreadable": stored result is invalid or from a newer schema. */
export const ResultStatusSchema = z.enum(["ok", "unreadable"]);
export type ResultStatus = z.infer<typeof ResultStatusSchema>;

export const AnalysisRecordResponseSchema = z.object({
  id: z.string().min(1),
  language: AnalysisLanguageSchema,
  result: AnalysisResultSchema.nullable(),
  resultStatus: ResultStatusSchema,
  createdAt: IsoDateTimeSchema,
});
export type AnalysisRecordResponse = z.infer<typeof AnalysisRecordResponseSchema>;

export const SharedAnalysisResponseSchema = z.object({
  id: z.string(),
  code: z.string(),
  language: AnalysisLanguageSchema,
  result: AnalysisResultSchema.nullable(),
  resultStatus: ResultStatusSchema,
  createdAt: IsoDateTimeSchema,
  creator: SafeUserSchema.optional(),
});
export type SharedAnalysisResponse = z.infer<typeof SharedAnalysisResponseSchema>;

export const AnalysisHistoryQuerySchema = pageQuerySchema(LIMITS.pagination.analysisHistory);
export const ShareUrlResponseSchema = z.object({ shareUrl: z.url() });
export type ShareUrlResponse = z.infer<typeof ShareUrlResponseSchema>;

/** A language plus a result: what the report screen renders. */
export const AnalysisReportSchema = z.object({ language: AnalysisLanguageSchema, result: AnalysisResultSchema });
export type AnalysisReport = z.infer<typeof AnalysisReportSchema>;
export { CursorSchema };
__P3_EOF__

write_file packages/contracts/src/stored-results.ts <<'__P3_EOF__'
import { z } from "zod";
import { AnalysisResultSchema, type AnalysisResult } from "@algoforge/analysis";

/**
 * AI results are stored as JSON. New rows are written as { schemaVersion, data };
 * older rows are a bare result (treated as version 0). Reading never throws:
 * a result that cannot be read is reported, and the API degrades to result: null.
 */
export const ANALYSIS_RESULT_SCHEMA_VERSION = 1;

export const StoredAnalysisResultSchema = z.object({ schemaVersion: z.number().int().min(1), data: z.unknown() });
export type StoredAnalysisResult = { schemaVersion: number; data: AnalysisResult };

export type ParsedStoredAnalysisResult =
  | { status: "ok"; version: number; result: AnalysisResult }
  | { status: "unreadable"; version: number | null; reason: "unsupported_version" | "invalid" };

export function wrapStoredAnalysisResult(result: AnalysisResult): StoredAnalysisResult {
  return { schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION, data: result };
}

export function parseStoredAnalysisResult(raw: unknown): ParsedStoredAnalysisResult {
  const wrapped = StoredAnalysisResultSchema.safeParse(raw);
  if (wrapped.success) {
    const { schemaVersion, data } = wrapped.data;
    if (schemaVersion > ANALYSIS_RESULT_SCHEMA_VERSION) return { status: "unreadable", version: schemaVersion, reason: "unsupported_version" };
    const parsed = AnalysisResultSchema.safeParse(data);
    return parsed.success ? { status: "ok", version: schemaVersion, result: parsed.data } : { status: "unreadable", version: schemaVersion, reason: "invalid" };
  }
  const legacy = AnalysisResultSchema.safeParse(raw);
  return legacy.success ? { status: "ok", version: 0, result: legacy.data } : { status: "unreadable", version: null, reason: "invalid" };
}
__P3_EOF__

write_file packages/contracts/src/explain.ts <<'__P3_EOF__'
import { z } from "zod";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";
import { SafeUserSchema } from "./users";

export const SessionMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  intent: z.string().optional(),
  createdAt: IsoDateTimeSchema,
});
export type SessionMessage = z.infer<typeof SessionMessageSchema>;

export const ExplainSessionSummarySchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  isPublic: z.boolean(),
  shareId: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export const ExplainSessionDetailSchema = ExplainSessionSummarySchema.extend({ messages: z.array(SessionMessageSchema) });
export const ExplainSessionListResponseSchema = paginatedResponse(ExplainSessionSummarySchema);
export const ExplainSessionListQuerySchema = pageQuerySchema(LIMITS.pagination.explainSessions);

export const CreateExplainSessionRequestSchema = z.object({ title: z.string().trim().min(1).max(LIMITS.title.maxChars).optional() });
export const SendMessageRequestSchema = z.object({
  query: z.string().trim().min(LIMITS.message.minChars, `Query must be at least ${LIMITS.message.minChars} characters.`).max(LIMITS.message.maxChars, "Query is too long."),
});
export const SendMessageResponseSchema = z.object({ userMessage: SessionMessageSchema, assistantMessage: SessionMessageSchema });

export const SharedExplainSessionResponseSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  messages: z.array(SessionMessageSchema),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  creator: SafeUserSchema.optional(),
});

/** One-shot explain endpoint (kept or removed in Phase 8). */
export const ExplainRequestSchema = SendMessageRequestSchema;
export const ExplainResponseSchema = z.object({
  query: z.string(),
  intent: z.string(),
  explanation: z.string(),
  relevantFiles: z.array(z.string()),
  relevantRoutes: z.array(z.string()),
  cachedAt: IsoDateTimeSchema.optional(),
});

export type ExplainSessionSummary = z.infer<typeof ExplainSessionSummarySchema>;
export type ExplainSessionDetail = z.infer<typeof ExplainSessionDetailSchema>;
export type ExplainSessionListResponse = z.infer<typeof ExplainSessionListResponseSchema>;
export type CreateExplainSessionRequest = z.infer<typeof CreateExplainSessionRequestSchema>;
export type SendMessageRequest = z.infer<typeof SendMessageRequestSchema>;
export type SendMessageResponse = z.infer<typeof SendMessageResponseSchema>;
export type SharedExplainSessionResponse = z.infer<typeof SharedExplainSessionResponseSchema>;
export type ExplainResponse = z.infer<typeof ExplainResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/visualizations.ts <<'__P3_EOF__'
import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

/** Contracts for Phase 6 (saved work). No endpoint serves these yet. */
export const DiagnosticSchema = z.object({
  severity: z.enum(["error", "warning", "info"]),
  message: z.string(),
  line: z.number().int().min(1),
  column: z.number().int().min(1),
  endLine: z.number().int().min(1),
  endColumn: z.number().int().min(1),
  fix: z.object({ label: z.string(), replacement: z.string() }).optional(),
});
export const VisualizationStructureSchema = z.object({ id: z.string(), ds: z.string(), label: z.string() });

export const VisualizationSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  code: z.string().nullable(),
  language: AnalysisLanguageSchema.nullable(),
  structures: z.array(VisualizationStructureSchema),
  stepCount: z.number().int().min(0),
  schemaVersion: z.number().int().min(1),
  forkedFromId: z.string().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});
export const VisualizationSummarySchema = VisualizationSchema.omit({ script: true, code: true });
export const VisualizationListResponseSchema = paginatedResponse(VisualizationSummarySchema);
export const VisualizationListQuerySchema = pageQuerySchema({ defaultSize: 20, maxSize: 50 });

export const CreateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars),
  description: z.string().max(2000).optional(),
  script: z.string().min(1).max(LIMITS.script.maxChars),
  code: z.string().max(LIMITS.code.maxChars).optional(),
  language: AnalysisLanguageSchema.optional(),
});
export const UpdateVisualizationRequestSchema = CreateVisualizationRequestSchema.partial();
export const ValidateScriptRequestSchema = z.object({ script: z.string().min(1).max(LIMITS.script.maxChars) });
export const ValidateScriptResponseSchema = z.object({
  ok: z.boolean(),
  stepCount: z.number().int().min(0),
  structures: z.array(VisualizationStructureSchema),
  diagnostics: z.array(DiagnosticSchema),
});

export type Visualization = z.infer<typeof VisualizationSchema>;
export type CreateVisualizationRequest = z.infer<typeof CreateVisualizationRequestSchema>;
export type ValidateScriptResponse = z.infer<typeof ValidateScriptResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/shares.ts <<'__P3_EOF__'
import { z } from "zod";
import { IsoDateTimeSchema, listResponse } from "./common";
import { SharedAnalysisResponseSchema } from "./analysis";
import { SharedExplainSessionResponseSchema } from "./explain";
import { VisualizationStructureSchema } from "./visualizations";

/** Contracts for Phase 9 (unified shares). No endpoint serves these yet. */
export const ShareTypeSchema = z.enum(["analysis", "explain", "visualization"]);
export const ShareIdSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);

export const CreateShareRequestSchema = z.object({ type: ShareTypeSchema, targetId: z.string().min(1) });
export const ShareSchema = z.object({
  shareId: ShareIdSchema,
  url: z.url(),
  type: ShareTypeSchema,
  targetId: z.string(),
  createdAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable(),
  viewCount: z.number().int().min(0),
});
export const ShareListResponseSchema = listResponse(ShareSchema);

export const SharedVisualizationResponseSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  script: z.string(),
  structures: z.array(VisualizationStructureSchema),
});

export const PublicShareResponseSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("analysis"), createdAt: IsoDateTimeSchema, data: SharedAnalysisResponseSchema }),
  z.object({ type: z.literal("explain"), createdAt: IsoDateTimeSchema, data: SharedExplainSessionResponseSchema }),
  z.object({ type: z.literal("visualization"), createdAt: IsoDateTimeSchema, data: SharedVisualizationResponseSchema }),
]);

export type Share = z.infer<typeof ShareSchema>;
export type PublicShareResponse = z.infer<typeof PublicShareResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/capabilities.ts <<'__P3_EOF__'
import { z } from "zod";

/** Contract for Phase 4 (GET /api/meta/capabilities). */
export const CapabilitiesResponseSchema = z.object({
  analysis: z.boolean(),
  assistant: z.boolean(),
  sharing: z.boolean(),
  savedWork: z.boolean(),
  limits: z.object({ codeMaxChars: z.number().int(), scriptMaxChars: z.number().int(), messageMaxChars: z.number().int() }),
});
export type CapabilitiesResponse = z.infer<typeof CapabilitiesResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/admin.ts <<'__P3_EOF__'
import { z } from "zod";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { UserRoleSchema } from "./auth";
import { LIMITS } from "./limits";

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  name: z.string().nullable(),
  role: UserRoleSchema,
  createdAt: IsoDateTimeSchema,
});
export const AdminUserListResponseSchema = paginatedResponse(AdminUserSchema);
export const AdminUserListQuerySchema = pageQuerySchema(LIMITS.pagination.adminUsers);

export const AdminRoleChangeRequestSchema = z.object({ userId: z.string().min(1) });
export const AdminRoleChangeResponseSchema = z.object({
  changed: z.boolean(),
  user: z.object({ id: z.string(), email: z.string().nullable(), role: UserRoleSchema }),
});

export type AdminUser = z.infer<typeof AdminUserSchema>;
export type AdminUserListResponse = z.infer<typeof AdminUserListResponseSchema>;
__P3_EOF__

write_file packages/contracts/src/health.ts <<'__P3_EOF__'
import { z } from "zod";
import { IsoDateTimeSchema } from "./common";

export const HealthResponseSchema = z.object({ status: z.literal("ok"), timestamp: IsoDateTimeSchema });
export const ReadyResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z.object({ database: z.enum(["ok", "fail"]), redis: z.enum(["ok", "fail"]) }),
  timestamp: IsoDateTimeSchema,
});
__P3_EOF__

write_file packages/contracts/src/registry.ts <<'__P3_EOF__'
import type { z } from "zod";
import { AdminRoleChangeRequestSchema, AdminRoleChangeResponseSchema, AdminUserListResponseSchema, AdminUserSchema } from "./admin";
import { AlgorithmDetailResponseSchema, AlgorithmExecutionResponseSchema, AlgorithmListResponseSchema, AlgorithmSummarySchema, CreateAlgorithmRequestSchema, UpdateAlgorithmRequestSchema } from "./algorithms";
import { AnalysisHistoryItemSchema, AnalysisHistoryResponseSchema, AnalysisRecordResponseSchema, AnalysisResultSchema, CreateAnalysisRequestSchema, SharedAnalysisResponseSchema, ShareUrlResponseSchema } from "./analysis";
import { AuthUserSchema, MeResponseSchema } from "./auth";
import { CapabilitiesResponseSchema } from "./capabilities";
import { CategoryListResponseSchema, CategorySchema, CreateCategoryRequestSchema, UpdateCategoryRequestSchema } from "./categories";
import { PageMetaSchema } from "./common";
import { ErrorResponseSchema } from "./errors";
import { CreateExplainSessionRequestSchema, ExplainRequestSchema, ExplainResponseSchema, ExplainSessionDetailSchema, ExplainSessionListResponseSchema, ExplainSessionSummarySchema, SendMessageRequestSchema, SendMessageResponseSchema, SessionMessageSchema, SharedExplainSessionResponseSchema } from "./explain";
import { HealthResponseSchema, ReadyResponseSchema } from "./health";
import { CreateShareRequestSchema, PublicShareResponseSchema, ShareSchema } from "./shares";
import { DeviceSessionSchema, SafeUserSchema, UpdateProfileRequestSchema } from "./users";
import { CreateVisualizationRequestSchema, UpdateVisualizationRequestSchema, ValidateScriptRequestSchema, ValidateScriptResponseSchema, VisualizationSchema } from "./visualizations";

/** Named schemas published under components.schemas. A name ending in "Request" is documented by its input shape. */
export const SCHEMA_REGISTRY = {
  ErrorResponse: ErrorResponseSchema,
  PageMeta: PageMetaSchema,
  AuthUser: AuthUserSchema,
  MeResponse: MeResponseSchema,
  SafeUser: SafeUserSchema,
  UpdateProfileRequest: UpdateProfileRequestSchema,
  DeviceSession: DeviceSessionSchema,
  AlgorithmSummary: AlgorithmSummarySchema,
  AlgorithmDetailResponse: AlgorithmDetailResponseSchema,
  AlgorithmListResponse: AlgorithmListResponseSchema,
  AlgorithmExecutionResponse: AlgorithmExecutionResponseSchema,
  CreateAlgorithmRequest: CreateAlgorithmRequestSchema,
  UpdateAlgorithmRequest: UpdateAlgorithmRequestSchema,
  Category: CategorySchema,
  CategoryListResponse: CategoryListResponseSchema,
  CreateCategoryRequest: CreateCategoryRequestSchema,
  UpdateCategoryRequest: UpdateCategoryRequestSchema,
  AnalysisResult: AnalysisResultSchema,
  CreateAnalysisRequest: CreateAnalysisRequestSchema,
  AnalysisRecordResponse: AnalysisRecordResponseSchema,
  AnalysisHistoryItem: AnalysisHistoryItemSchema,
  AnalysisHistoryResponse: AnalysisHistoryResponseSchema,
  SharedAnalysisResponse: SharedAnalysisResponseSchema,
  ShareUrlResponse: ShareUrlResponseSchema,
  SessionMessage: SessionMessageSchema,
  ExplainSessionSummary: ExplainSessionSummarySchema,
  ExplainSessionDetail: ExplainSessionDetailSchema,
  ExplainSessionListResponse: ExplainSessionListResponseSchema,
  CreateExplainSessionRequest: CreateExplainSessionRequestSchema,
  SendMessageRequest: SendMessageRequestSchema,
  SendMessageResponse: SendMessageResponseSchema,
  SharedExplainSessionResponse: SharedExplainSessionResponseSchema,
  ExplainRequest: ExplainRequestSchema,
  ExplainResponse: ExplainResponseSchema,
  Visualization: VisualizationSchema,
  CreateVisualizationRequest: CreateVisualizationRequestSchema,
  UpdateVisualizationRequest: UpdateVisualizationRequestSchema,
  ValidateScriptRequest: ValidateScriptRequestSchema,
  ValidateScriptResponse: ValidateScriptResponseSchema,
  Share: ShareSchema,
  CreateShareRequest: CreateShareRequestSchema,
  PublicShareResponse: PublicShareResponseSchema,
  CapabilitiesResponse: CapabilitiesResponseSchema,
  AdminUser: AdminUserSchema,
  AdminUserListResponse: AdminUserListResponseSchema,
  AdminRoleChangeRequest: AdminRoleChangeRequestSchema,
  AdminRoleChangeResponse: AdminRoleChangeResponseSchema,
  HealthResponse: HealthResponseSchema,
  ReadyResponse: ReadyResponseSchema,
} as const satisfies Record<string, z.ZodType>;
__P3_EOF__

write_file packages/contracts/src/routes.ts <<'__P3_EOF__'
import type { z } from "zod";
import { AdminRoleChangeRequestSchema, AdminRoleChangeResponseSchema, AdminUserListQuerySchema, AdminUserListResponseSchema } from "./admin";
import { AlgorithmDetailResponseSchema, AlgorithmExecutionResponseSchema, AlgorithmLangQuerySchema, AlgorithmListQuerySchema, AlgorithmListResponseSchema, CreateAlgorithmRequestSchema, UpdateAlgorithmRequestSchema } from "./algorithms";
import { AnalysisHistoryQuerySchema, AnalysisHistoryResponseSchema, AnalysisRecordResponseSchema, CreateAnalysisRequestSchema, SharedAnalysisResponseSchema, ShareUrlResponseSchema } from "./analysis";
import { MeResponseSchema, RefreshResponseSchema } from "./auth";
import { CategoryListResponseSchema, CategorySchema, CreateCategoryRequestSchema, UpdateCategoryRequestSchema } from "./categories";
import { IdParamsSchema, ShareIdParamsSchema, SlugParamsSchema } from "./common";
import { CreateExplainSessionRequestSchema, ExplainRequestSchema, ExplainResponseSchema, ExplainSessionDetailSchema, ExplainSessionListQuerySchema, ExplainSessionListResponseSchema, SendMessageRequestSchema, SendMessageResponseSchema, SharedExplainSessionResponseSchema } from "./explain";
import { HealthResponseSchema, ReadyResponseSchema } from "./health";

export type HttpMethod = "get" | "post" | "patch" | "delete";
export type AuthLevel = "none" | "optional" | "user" | "admin";
/** "empty" = no JSON body (204 or a redirect). */
export type RouteResponse = z.ZodType | "empty";

export interface RouteDef {
  readonly id: string;
  readonly method: HttpMethod;
  /** OpenAPI style: /api/analysis/{id} (Express: /api/analysis/:id). */
  readonly path: string;
  readonly summary: string;
  readonly tag: string;
  readonly auth: AuthLevel;
  readonly csrf: boolean;
  readonly rateLimit?: "general" | "ai";
  readonly params?: z.ZodType;
  readonly query?: z.ZodType;
  readonly body?: z.ZodType;
  readonly responses: Readonly<Record<number, RouteResponse>>;
  readonly notes?: string;
}

/** Every endpoint the API serves today. A test fails when this table and the Express routers disagree. */
export const routes: readonly RouteDef[] = [
  { id: "health", method: "get", path: "/health", summary: "Liveness", tag: "Health", auth: "none", csrf: false, responses: { 200: HealthResponseSchema } },
  { id: "ready", method: "get", path: "/ready", summary: "Readiness (database and Redis)", tag: "Health", auth: "none", csrf: false, responses: { 200: ReadyResponseSchema, 503: ReadyResponseSchema } },

  { id: "authGoogleStart", method: "get", path: "/api/auth/google/start", summary: "Start Google sign-in (redirect)", tag: "Auth", auth: "none", csrf: false, responses: { 302: "empty" } },
  { id: "authGoogleCallback", method: "get", path: "/api/auth/google/callback", summary: "Google OAuth callback (redirect to the web app)", tag: "Auth", auth: "none", csrf: false, responses: { 302: "empty" } },
  { id: "authMe", method: "get", path: "/api/auth/me", summary: "Current user", tag: "Auth", auth: "user", csrf: false, responses: { 200: MeResponseSchema }, notes: "Known gap until Phase 4 (A-03): the implementation still returns the public user shape without email and role." },
  { id: "authRefresh", method: "post", path: "/api/auth/refresh", summary: "Rotate the session cookies", tag: "Auth", auth: "none", csrf: false, responses: { 200: RefreshResponseSchema } },
  { id: "authLogout", method: "post", path: "/api/auth/logout", summary: "Sign out this device", tag: "Auth", auth: "none", csrf: true, responses: { 204: "empty" } },
  { id: "authLogoutAll", method: "post", path: "/api/auth/logout-all", summary: "Sign out every device", tag: "Auth", auth: "user", csrf: true, responses: { 204: "empty" } },

  { id: "algorithmsList", method: "get", path: "/api/algorithms", summary: "List algorithms", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", query: AlgorithmListQuerySchema, responses: { 200: AlgorithmListResponseSchema } },
  { id: "algorithmsBySlug", method: "get", path: "/api/algorithms/slug/{slug}", summary: "Algorithm by slug", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: SlugParamsSchema, query: AlgorithmLangQuerySchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsVisualize", method: "get", path: "/api/algorithms/id/{id}/visualize", summary: "Visualization config (legacy forge, replaced by a script in Phase 6)", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: IdParamsSchema, responses: { 200: AlgorithmExecutionResponseSchema } },
  { id: "algorithmsById", method: "get", path: "/api/algorithms/id/{id}", summary: "Algorithm by id", tag: "Algorithms", auth: "optional", csrf: false, rateLimit: "general", params: IdParamsSchema, query: AlgorithmLangQuerySchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsCreate", method: "post", path: "/api/algorithms", summary: "Create an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", body: CreateAlgorithmRequestSchema, responses: { 201: AlgorithmDetailResponseSchema } },
  { id: "algorithmsUpdate", method: "patch", path: "/api/algorithms/id/{id}", summary: "Update an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", params: IdParamsSchema, body: UpdateAlgorithmRequestSchema, responses: { 200: AlgorithmDetailResponseSchema } },
  { id: "algorithmsDelete", method: "delete", path: "/api/algorithms/id/{id}", summary: "Delete an algorithm", tag: "Algorithms", auth: "admin", csrf: true, rateLimit: "general", params: IdParamsSchema, responses: { 204: "empty" } },

  { id: "categoriesList", method: "get", path: "/api/categories", summary: "List categories", tag: "Categories", auth: "none", csrf: false, responses: { 200: CategoryListResponseSchema } },
  { id: "categoriesGet", method: "get", path: "/api/categories/{id}", summary: "Category by id", tag: "Categories", auth: "none", csrf: false, params: IdParamsSchema, responses: { 200: CategorySchema } },
  { id: "categoriesCreate", method: "post", path: "/api/categories", summary: "Create a category", tag: "Categories", auth: "admin", csrf: true, body: CreateCategoryRequestSchema, responses: { 201: CategorySchema } },
  { id: "categoriesUpdate", method: "patch", path: "/api/categories/{id}", summary: "Update a category", tag: "Categories", auth: "admin", csrf: true, params: IdParamsSchema, body: UpdateCategoryRequestSchema, responses: { 200: CategorySchema } },
  { id: "categoriesDelete", method: "delete", path: "/api/categories/{id}", summary: "Delete a category", tag: "Categories", auth: "admin", csrf: true, params: IdParamsSchema, responses: { 204: "empty" } },

  { id: "analysisList", method: "get", path: "/api/analysis", summary: "Analysis history (cursor pagination)", tag: "Analysis", auth: "user", csrf: false, rateLimit: "general", query: AnalysisHistoryQuerySchema, responses: { 200: AnalysisHistoryResponseSchema } },
  { id: "analysisGet", method: "get", path: "/api/analysis/{id}", summary: "One analysis", tag: "Analysis", auth: "user", csrf: false, rateLimit: "general", params: IdParamsSchema, responses: { 200: AnalysisRecordResponseSchema } },
  { id: "analysisCreate", method: "post", path: "/api/analysis", summary: "Analyze code", tag: "Analysis", auth: "user", csrf: true, rateLimit: "ai", body: CreateAnalysisRequestSchema, responses: { 201: AnalysisRecordResponseSchema } },
  { id: "analysisShare", method: "post", path: "/api/analysis/{id}/share", summary: "Make an analysis public", tag: "Analysis", auth: "user", csrf: true, rateLimit: "general", params: IdParamsSchema, responses: { 200: ShareUrlResponseSchema } },

  { id: "explain", method: "post", path: "/api/explain", summary: "One-shot explanation", tag: "Explain", auth: "user", csrf: true, rateLimit: "ai", body: ExplainRequestSchema, responses: { 200: ExplainResponseSchema } },
  { id: "explainSessionsList", method: "get", path: "/api/explain-sessions", summary: "List chat sessions (cursor pagination)", tag: "Explain", auth: "user", csrf: false, query: ExplainSessionListQuerySchema, responses: { 200: ExplainSessionListResponseSchema } },
  { id: "explainSessionsCreate", method: "post", path: "/api/explain-sessions", summary: "Create a chat session", tag: "Explain", auth: "user", csrf: true, body: CreateExplainSessionRequestSchema, responses: { 201: ExplainSessionDetailSchema } },
  { id: "explainSessionsGet", method: "get", path: "/api/explain-sessions/{id}", summary: "One chat session", tag: "Explain", auth: "user", csrf: false, params: IdParamsSchema, responses: { 200: ExplainSessionDetailSchema } },
  { id: "explainSessionsDelete", method: "delete", path: "/api/explain-sessions/{id}", summary: "Delete a chat session", tag: "Explain", auth: "user", csrf: true, params: IdParamsSchema, responses: { 204: "empty" } },
  { id: "explainSessionsMessage", method: "post", path: "/api/explain-sessions/{id}/messages", summary: "Send a message", tag: "Explain", auth: "user", csrf: true, rateLimit: "ai", params: IdParamsSchema, body: SendMessageRequestSchema, responses: { 201: SendMessageResponseSchema } },
  { id: "explainSessionsShare", method: "post", path: "/api/explain-sessions/{id}/share", summary: "Make a chat session public", tag: "Explain", auth: "user", csrf: true, params: IdParamsSchema, responses: { 200: ShareUrlResponseSchema } },

  { id: "shareAnalysis", method: "get", path: "/api/share/analysis/{shareId}", summary: "Public analysis", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedAnalysisResponseSchema } },
  { id: "shareExplain", method: "get", path: "/api/share/explain/{shareId}", summary: "Public chat session", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedExplainSessionResponseSchema } },
  { id: "shareLegacy", method: "get", path: "/api/share/{shareId}", summary: "Public analysis (legacy alias)", tag: "Share", auth: "none", csrf: false, params: ShareIdParamsSchema, responses: { 200: SharedAnalysisResponseSchema }, notes: "Legacy alias of /api/share/analysis/{shareId}; removed in Phase 9." },

  { id: "adminUsers", method: "get", path: "/api/admin/users", summary: "List users (cursor pagination)", tag: "Admin", auth: "admin", csrf: false, query: AdminUserListQuerySchema, responses: { 200: AdminUserListResponseSchema } },
  { id: "adminUpgrade", method: "post", path: "/api/admin/upgrade-user", summary: "Promote a user to ADMIN", tag: "Admin", auth: "admin", csrf: true, body: AdminRoleChangeRequestSchema, responses: { 200: AdminRoleChangeResponseSchema } },
  { id: "adminDowngrade", method: "post", path: "/api/admin/downgrade-user", summary: "Demote a user to USER", tag: "Admin", auth: "admin", csrf: true, body: AdminRoleChangeRequestSchema, responses: { 200: AdminRoleChangeResponseSchema } },
];

export const toExpressPath = (path: string): string => path.replace(/\{(\w+)\}/g, ":$1");
__P3_EOF__

write_file packages/contracts/src/openapi.ts <<'__P3_EOF__'
import { z } from "zod";
import { ACCESS_COOKIE_NAME, CSRF_HEADER_NAME, REQUEST_ID_HEADER, RETRY_AFTER_HEADER } from "./common";
import { SCHEMA_REGISTRY } from "./registry";
import { routes, type RouteDef } from "./routes";

type JsonObject = Record<string, unknown>;
export type OpenApiDocument = JsonObject & { openapi: "3.1.0"; paths: Record<string, JsonObject>; components: JsonObject };

export interface OpenApiOptions {
  title?: string;
  version?: string;
  serverUrl?: string;
}

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: "OK", 201: "Created", 204: "No Content", 302: "Found", 400: "Bad request", 401: "Not signed in", 403: "Forbidden",
  404: "Not found", 413: "Payload too large", 429: "Too many requests", 500: "Unexpected error", 503: "Not ready",
};

const refNames = new Map<z.ZodType, string>(Object.entries(SCHEMA_REGISTRY).map(([name, schema]) => [schema, name]));

function jsonSchemaOf(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const raw: JsonObject = { ...z.toJSONSchema(schema, { io, unrepresentable: "any" }) };
  delete raw.$schema;
  return raw;
}

function schemaOrRef(schema: z.ZodType, io: "input" | "output"): JsonObject {
  const name = refNames.get(schema);
  return name ? { $ref: `#/components/schemas/${name}` } : jsonSchemaOf(schema, io);
}

function parametersOf(location: "path" | "query", schema: z.ZodType): JsonObject[] {
  const json = jsonSchemaOf(schema, "output");
  const props = (json.properties ?? {}) as Record<string, JsonObject>;
  const required = new Set<string>(Array.isArray(json.required) ? (json.required as string[]) : []);
  return Object.entries(props).map(([name, s]) => ({ name, in: location, required: location === "path" || required.has(name), schema: s }));
}

const requestIdHeader = { [REQUEST_ID_HEADER]: { description: "Correlation id for this request.", schema: { type: "string" } } };

function describeResponse(status: number, body: JsonObject | null): JsonObject {
  const headers: JsonObject = { ...requestIdHeader };
  if (status === 429) headers[RETRY_AFTER_HEADER] = { description: "Seconds to wait before retrying.", schema: { type: "integer" } };
  return { description: STATUS_TEXT[status] ?? String(status), headers, ...(body ? { content: { "application/json": { schema: body } } } : {}) };
}

function errorStatuses(route: RouteDef): number[] {
  const s = new Set<number>([500]);
  if (route.params || route.query || route.body) s.add(400);
  if (route.body) s.add(413);
  if (route.auth === "user" || route.auth === "admin") s.add(401);
  if (route.auth === "admin" || route.csrf) s.add(403);
  if (route.path.includes("{")) s.add(404);
  if (route.rateLimit) s.add(429);
  for (const code of Object.keys(route.responses)) s.delete(Number(code));
  return [...s].sort((a, b) => a - b);
}

function securityOf(route: RouteDef): JsonObject[] | undefined {
  if (route.auth === "optional") return [{}, { cookieAuth: [] }];
  if (route.auth === "user" || route.auth === "admin") return [route.csrf ? { cookieAuth: [], csrfHeader: [] } : { cookieAuth: [] }];
  if (route.csrf) return [{ csrfHeader: [] }];
  return undefined;
}

function operationOf(route: RouteDef): JsonObject {
  const responses: Record<string, JsonObject> = {};
  for (const [status, res] of Object.entries(route.responses)) {
    responses[status] = describeResponse(Number(status), res === "empty" ? null : schemaOrRef(res, "output"));
  }
  for (const status of errorStatuses(route)) responses[String(status)] = describeResponse(status, { $ref: "#/components/schemas/ErrorResponse" });
  const parameters = [...(route.params ? parametersOf("path", route.params) : []), ...(route.query ? parametersOf("query", route.query) : [])];
  const security = securityOf(route);
  return {
    operationId: route.id,
    summary: route.summary,
    tags: [route.tag],
    ...(route.notes ? { description: route.notes } : {}),
    ...(route.rateLimit ? { "x-rate-limit": route.rateLimit } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(route.body ? { requestBody: { required: true, content: { "application/json": { schema: schemaOrRef(route.body, "input") } } } } : {}),
    responses,
    ...(security ? { security } : {}),
  };
}

export function buildOpenApiDocument(options: OpenApiOptions = {}): OpenApiDocument {
  const paths: Record<string, JsonObject> = {};
  for (const route of routes) {
    const item = paths[route.path] ?? {};
    item[route.method] = operationOf(route);
    paths[route.path] = item;
  }
  const schemas: Record<string, JsonObject> = {};
  for (const [name, schema] of Object.entries(SCHEMA_REGISTRY)) schemas[name] = jsonSchemaOf(schema, name.endsWith("Request") ? "input" : "output");

  return {
    openapi: "3.1.0",
    info: {
      title: options.title ?? "AlgoForge API",
      version: options.version ?? "1.0.0",
      description:
        "Generated from @algoforge/contracts. Single resources are plain objects; lists are { data } and paginated lists are { data, meta: { nextCursor, hasMore } }. Dates are ISO 8601 UTC. Errors use { error: { code, message, details? } }. Every response carries X-Request-Id.",
    },
    servers: [{ url: options.serverUrl ?? "/" }],
    tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
    paths,
    components: {
      schemas,
      securitySchemes: {
        cookieAuth: { type: "apiKey", in: "cookie", name: ACCESS_COOKIE_NAME },
        csrfHeader: { type: "apiKey", in: "header", name: CSRF_HEADER_NAME },
      },
    },
  };
}
__P3_EOF__

write_file packages/contracts/src/index.ts <<'__P3_EOF__'
export * from "./limits";
export * from "./common";
export * from "./errors";
export * from "./users";
export * from "./auth";
export * from "./categories";
export * from "./algorithms";
export * from "./analysis";
export * from "./stored-results";
export * from "./explain";
export * from "./visualizations";
export * from "./shares";
export * from "./capabilities";
export * from "./admin";
export * from "./health";
export * from "./registry";
export * from "./routes";
export * from "./openapi";
__P3_EOF__

# ---- contracts tests ---------------------------------------------------------
write_file packages/contracts/src/contracts.test.ts <<'__P3_EOF__'
import { describe, expect, it } from "vitest";
import { CreateAnalysisInputSchema } from "@algoforge/analysis";
import {
  ANALYSIS_RESULT_SCHEMA_VERSION,
  CreateAnalysisRequestSchema,
  ERROR_CODES,
  ERROR_HTTP_STATUS,
  ErrorResponseSchema,
  IsoDateTimeSchema,
  JSON_BODY_LIMIT_BYTES,
  LIMITS,
  PublicShareResponseSchema,
  SendMessageRequestSchema,
  paginatedResponse,
  parseStoredAnalysisResult,
  wrapStoredAnalysisResult,
  AnalysisResultSchema,
} from "./index";
import { z } from "zod";

const RESULT = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "code",
  edgeCases: [],
};

describe("limits", () => {
  it("keeps the body limit large enough for an escaped script", () => {
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThanOrEqual(LIMITS.script.maxChars * 4);
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThan(LIMITS.code.maxChars * 4);
  });
  it("has sane pagination and message bounds", () => {
    for (const p of Object.values(LIMITS.pagination)) expect(p.defaultSize).toBeLessThanOrEqual(p.maxSize);
    expect(LIMITS.message.minChars).toBeLessThan(LIMITS.message.maxChars);
  });
});

describe("errors", () => {
  it("maps every code to a status and validates the envelope", () => {
    for (const code of ERROR_CODES) expect(ERROR_HTTP_STATUS[code]).toBeGreaterThanOrEqual(400);
    expect(ErrorResponseSchema.safeParse({ error: { code: "NOT_FOUND", message: "x" } }).success).toBe(true);
    expect(ErrorResponseSchema.safeParse({ error: { code: "NOPE", message: "x" } }).success).toBe(false);
    expect(ErrorResponseSchema.safeParse({ error: "Route not found." }).success).toBe(false);
  });
});

describe("shared schemas", () => {
  it("accepts only ISO 8601 UTC dates", () => {
    expect(IsoDateTimeSchema.safeParse("2026-05-04T10:15:30.000Z").success).toBe(true);
    expect(IsoDateTimeSchema.safeParse("2026-05-04").success).toBe(false);
    expect(IsoDateTimeSchema.safeParse("yesterday").success).toBe(false);
  });
  it("validates paginated envelopes", () => {
    const schema = paginatedResponse(z.object({ id: z.string() }));
    expect(schema.safeParse({ data: [{ id: "a" }], meta: { nextCursor: null, hasMore: false } }).success).toBe(true);
    expect(schema.safeParse({ data: [{ id: "a" }] }).success).toBe(false);
    expect(schema.safeParse({ data: [], meta: { nextCursor: "c", hasMore: "yes" } }).success).toBe(false);
  });
  it("uses the shared code limit and agrees with the analysis package", () => {
    const max = "a".repeat(LIMITS.code.maxChars);
    const over = "a".repeat(LIMITS.code.maxChars + 1);
    for (const schema of [CreateAnalysisRequestSchema, CreateAnalysisInputSchema]) {
      expect(schema.safeParse({ code: max, language: "python" }).success).toBe(true);
      expect(schema.safeParse({ code: over, language: "python" }).success).toBe(false);
    }
  });
  it("enforces message bounds", () => {
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.minChars - 1) }).success).toBe(false);
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.maxChars) }).success).toBe(true);
    expect(SendMessageRequestSchema.safeParse({ query: "a".repeat(LIMITS.message.maxChars + 1) }).success).toBe(false);
  });
  it("discriminates public shares by type", () => {
    const base = { createdAt: "2026-05-04T10:15:30.000Z" };
    const ok = PublicShareResponseSchema.safeParse({ ...base, type: "analysis", data: { id: "a", code: "x", language: "python", result: null, resultStatus: "unreadable", createdAt: base.createdAt } });
    expect(ok.success).toBe(true);
    expect(PublicShareResponseSchema.safeParse({ ...base, type: "other", data: {} }).success).toBe(false);
  });
});

describe("stored analysis results (schema versioning)", () => {
  it("reads current, legacy, newer and invalid results without throwing", () => {
    expect(AnalysisResultSchema.safeParse(RESULT).success).toBe(true);
    const current = parseStoredAnalysisResult(wrapStoredAnalysisResult(RESULT));
    expect(current).toMatchObject({ status: "ok", version: ANALYSIS_RESULT_SCHEMA_VERSION });
    expect(parseStoredAnalysisResult(RESULT)).toMatchObject({ status: "ok", version: 0 });
    expect(parseStoredAnalysisResult({ schemaVersion: ANALYSIS_RESULT_SCHEMA_VERSION + 1, data: RESULT })).toMatchObject({ status: "unreadable", reason: "unsupported_version" });
    expect(parseStoredAnalysisResult({ schemaVersion: 1, data: { nope: true } })).toMatchObject({ status: "unreadable", reason: "invalid" });
    for (const junk of [null, undefined, 42, "x", [], {}]) expect(parseStoredAnalysisResult(junk).status).toBe("unreadable");
  });
});
__P3_EOF__

write_file packages/contracts/src/openapi.test.ts <<'__P3_EOF__'
import { describe, expect, it } from "vitest";
import { SCHEMA_REGISTRY, buildOpenApiDocument, routes } from "./index";

function collectRefs(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectRefs(n, out));
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "$ref" && typeof v === "string") out.add(v);
      else collectRefs(v, out);
    }
  }
}

describe("OpenAPI document", () => {
  const doc = buildOpenApiDocument({ serverUrl: "http://localhost:4000" });

  it("describes every route exactly once", () => {
    const keys = routes.map((r) => `${r.method} ${r.path}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(routes.map((r) => r.id)).size).toBe(routes.length);
    for (const r of routes) expect(doc.paths[r.path]?.[r.method]).toBeDefined();
  });

  it("is version 3.1 and JSON serializable", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(() => JSON.stringify(doc)).not.toThrow();
  });

  it("resolves every $ref against components.schemas", () => {
    const refs = new Set<string>();
    collectRefs(doc.paths, refs);
    const schemas = (doc.components.schemas ?? {}) as Record<string, unknown>;
    expect(Object.keys(schemas).sort()).toEqual(Object.keys(SCHEMA_REGISTRY).sort());
    for (const ref of refs) {
      expect(ref.startsWith("#/components/schemas/")).toBe(true);
      expect(schemas[ref.replace("#/components/schemas/", "")]).toBeDefined();
    }
  });

  it("documents the standard error responses and request id header", () => {
    const op = doc.paths["/api/analysis"]?.post as { responses: Record<string, { headers?: Record<string, unknown> }> };
    for (const status of ["201", "400", "401", "403", "413", "429", "500"]) expect(op.responses[status]).toBeDefined();
    expect(op.responses["201"]?.headers?.["X-Request-Id"]).toBeDefined();
    expect(op.responses["429"]?.headers?.["Retry-After"]).toBeDefined();
  });
});
__P3_EOF__

# =============================================================================
info "2/6 API: shared helpers, serializers, validation, services, controllers"
# =============================================================================

write_file apps/api/src/utils/app-error.ts <<'__P3_EOF__'
import type { ErrorCode, ErrorDetail } from "@algoforge/contracts";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: readonly ErrorDetail[],
  ) {
    super(message);
    this.name = "AppError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(message: string, details?: readonly ErrorDetail[]): AppError {
    return new AppError(400, message, "BAD_REQUEST", details);
  }

  static unauthorized(message: string): AppError {
    return new AppError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message: string): AppError {
    return new AppError(403, message, "FORBIDDEN");
  }

  static notFound(message: string): AppError {
    return new AppError(404, message, "NOT_FOUND");
  }

  static conflict(message: string): AppError {
    return new AppError(409, message, "CONFLICT");
  }

  static payloadTooLarge(message: string): AppError {
    return new AppError(413, message, "PAYLOAD_TOO_LARGE");
  }

  static tooManyRequests(message: string): AppError {
    return new AppError(429, message, "TOO_MANY_REQUESTS");
  }

  static badGateway(message: string): AppError {
    return new AppError(502, message, "BAD_GATEWAY");
  }

  static internal(message: string): AppError {
    return new AppError(500, message, "INTERNAL_ERROR");
  }
}
__P3_EOF__

write_file apps/api/src/middleware/error-handler.ts <<'__P3_EOF__'
import { NextFunction, Request, Response } from "express";
import type { ErrorCode, ErrorDetail, ErrorResponse } from "@algoforge/contracts";
import { Prisma } from "@algoforge/db";
import { AppError } from "../utils/app-error";
import { logger, serializeError } from "../utils/logger";

type LogLevel = "none" | "warn" | "error";

interface MappedError {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: readonly ErrorDetail[];
  level: LogLevel;
}

function bodyParserType(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "type" in err) {
    const t = (err as { type: unknown }).type;
    return typeof t === "string" ? t : undefined;
  }
  return undefined;
}

function mapError(err: unknown): MappedError {
  if (err instanceof AppError) {
    return {
      statusCode: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
      level: err.statusCode >= 500 ? "error" : "none",
    };
  }

  const parserType = bodyParserType(err);
  if (parserType === "entity.parse.failed") {
    return { statusCode: 400, code: "BAD_REQUEST", message: "Malformed JSON body.", level: "none" };
  }
  if (parserType === "entity.too.large") {
    return { statusCode: 413, code: "PAYLOAD_TOO_LARGE", message: "Request body is too large.", level: "none" };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { statusCode: 409, code: "CONFLICT", message: "A resource with these values already exists.", level: "warn" };
    }
    if (err.code === "P2025") {
      return { statusCode: 404, code: "NOT_FOUND", message: "Resource not found.", level: "warn" };
    }
  }

  return { statusCode: 500, code: "INTERNAL_ERROR", message: "An unexpected error occurred.", level: "error" };
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  const mapped = mapError(err);

  if (mapped.level !== "none") {
    const fields = {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      userId: req.auth?.user.id,
      status: mapped.statusCode,
      ...serializeError(err),
    };
    if (mapped.level === "error") logger.error("request failed", fields);
    else logger.warn("request failed", fields);
  }

  const body: ErrorResponse = {
    error: {
      code: mapped.code,
      message: mapped.message,
      ...(mapped.details && mapped.details.length > 0 ? { details: [...mapped.details] } : {}),
    },
  };
  res.status(mapped.statusCode).json(body);
}
__P3_EOF__

write_file apps/api/src/middleware/request-id.ts <<'__P3_EOF__'
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER } from "@algoforge/contracts";

const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  next();
}
__P3_EOF__

write_file apps/api/src/utils/pagination.ts <<'__P3_EOF__'
import type { PageMeta } from "@algoforge/contracts";

/**
 * Cursor pagination helper. Fetch `limit + 1` rows; the extra row only proves another page exists.
 * `nextCursor` is derived from the last row that is actually returned.
 */
export function paginate<T>(rows: readonly T[], limit: number, cursorOf: (row: T) => string): { items: T[]; meta: PageMeta } {
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, meta: { hasMore, nextCursor: hasMore && last !== undefined ? cursorOf(last) : null } };
}
__P3_EOF__

write_file apps/api/src/validation/common.ts <<'__P3_EOF__'
import type { ZodError } from "zod";
import type { ErrorDetail } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";

export function ensureString(value: unknown, message: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest(message);
  }
  return value.trim();
}

export function zodDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({ path: issue.path.map((p) => String(p)).join("."), message: issue.message }));
}

/** 400 with the first issue as the message and every issue under error.details. */
export function badRequestFromZod(error: ZodError, fallback: string): AppError {
  return AppError.badRequest(error.issues[0]?.message ?? fallback, zodDetails(error));
}
__P3_EOF__

write_file apps/api/src/validation/analysis.ts <<'__P3_EOF__'
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
__P3_EOF__

write_file apps/api/src/validation/explanation-session.ts <<'__P3_EOF__'
import { z } from "zod";
import {
  CreateExplainSessionRequestSchema,
  LIMITS,
  SendMessageRequestSchema,
  type CreateExplainSessionRequest,
  type SendMessageRequest,
} from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

const { defaultSize, maxSize } = LIMITS.pagination.explainSessions;

export const CreateSessionSchema = CreateExplainSessionRequestSchema;
export const SendMessageSchema = SendMessageRequestSchema;
export const ListSessionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().optional(),
});

export type CreateSessionInput = CreateExplainSessionRequest;
export type SendMessageInput = SendMessageRequest;
export type ListSessionsQuery = z.infer<typeof ListSessionsQuerySchema>;

export function parseCreateSession(value: unknown): CreateSessionInput {
  const r = CreateSessionSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid session data.");
  return r.data;
}

export function parseSendMessage(value: unknown): SendMessageInput {
  const r = SendMessageSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid message.");
  return r.data;
}

export function parseListSessionsQuery(value: unknown): ListSessionsQuery {
  const r = ListSessionsQuerySchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query params.");
  return r.data;
}
__P3_EOF__

# ---- serializers -------------------------------------------------------------
write_file apps/api/src/serializers/dates.ts <<'__P3_EOF__'
/** Every date leaves the API as an ISO 8601 UTC string. Cached rows already hold strings, so both are accepted. */
export function toIso(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError("Invalid date value.");
  return date.toISOString();
}
__P3_EOF__

write_file apps/api/src/serializers/analysis.ts <<'__P3_EOF__'
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
__P3_EOF__

write_file apps/api/src/serializers/explain.ts <<'__P3_EOF__'
import {
  SessionMessageSchema,
  type ExplainSessionDetail,
  type ExplainSessionSummary,
  type SessionMessage,
  type SharedExplainSessionResponse,
} from "@algoforge/contracts";
import { logger } from "../utils/logger";
import { toIso } from "./dates";

type DateLike = Date | string;

export function parseMessages(raw: unknown): SessionMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: SessionMessage[] = [];
  for (const item of raw) {
    const parsed = SessionMessageSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
    else logger.warn("dropping malformed stored session message");
  }
  return out;
}

export interface SessionSummaryRow {
  id: string;
  title: string | null;
  shareId: string | null;
  isPublic: boolean;
  createdAt: DateLike;
  updatedAt: DateLike;
}
export interface SessionRow extends SessionSummaryRow {
  messages: unknown;
}

export function serializeSessionSummary(row: SessionSummaryRow): ExplainSessionSummary {
  return { id: row.id, title: row.title, isPublic: row.isPublic, shareId: row.shareId, createdAt: toIso(row.createdAt), updatedAt: toIso(row.updatedAt) };
}

/** Strips internal fields (userId) and normalizes dates and messages. */
export function serializeSessionDetail(row: SessionRow): ExplainSessionDetail {
  return { ...serializeSessionSummary(row), messages: parseMessages(row.messages) };
}

export interface SharedSessionRow extends SessionRow {
  user: { id: string; name: string | null; username: string | null; image: string | null } | null;
}

export function serializeSharedSession(row: SharedSessionRow): SharedExplainSessionResponse {
  return {
    id: row.id,
    title: row.title,
    messages: parseMessages(row.messages),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
    ...(row.user ? { creator: { id: row.user.id, name: row.user.name, username: row.user.username ?? row.user.name, avatarUrl: row.user.image } } : {}),
  };
}
__P3_EOF__

write_file apps/api/src/serializers/admin.ts <<'__P3_EOF__'
import type { AdminUser, UserRole } from "@algoforge/contracts";
import { toIso } from "./dates";

export interface AdminUserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: UserRole;
  createdAt: Date | string;
}

export function serializeAdminUser(row: AdminUserRow): AdminUser {
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: toIso(row.createdAt) };
}
__P3_EOF__

# ---- services ----------------------------------------------------------------
write_file apps/api/src/services/analysis.service.ts <<'__P3_EOF__'
/**
 * Analysis service.
 *
 * Cache strategy (two-layer LRU + Redis):
 *   - AI result is cached by SHA-256 of (language + code) so identical
 *     submissions never hit the AI provider twice.
 *   - The DB record is always written; cache only shields the AI call.
 *
 * Stored results are versioned ({ schemaVersion, data }); reading them is tolerant (see contracts).
 */
import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@algoforge/db";
import { wrapStoredAnalysisResult, type AnalysisResult, type SharedAnalysisResponse } from "@algoforge/contracts";
import { env } from "../config/env";
import { analysisRepository } from "../repositories/analysis.repository";
import { serializeSharedAnalysis } from "../serializers/analysis";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";
import { encodeAnalysisCursor, type AnalysisHistoryQuery, type AnalysisInput } from "../validation/analysis";
import { aiService } from "./ai.service";
import { layeredCache } from "./lib/layered-cache";

function aiCacheKey(language: string, code: string): string {
  const hash = createHash("sha256").update(`${language}:${code}`).digest("hex").slice(0, 32);
  return `ai:analysis:${hash}`;
}

function generateShareId(): string {
  return randomBytes(9).toString("base64url");
}

class AnalysisService {
  async createAnalysis(userId: string, input: AnalysisInput) {
    const key = aiCacheKey(input.language, input.code);

    let aiResult = await layeredCache.get<AnalysisResult>(key);

    if (!aiResult) {
      aiResult = await aiService.analyzeCode({ code: input.code, language: input.language });
      await layeredCache.set(key, aiResult);
    }

    return analysisRepository.create({
      userId,
      code: input.code,
      language: input.language,
      complexity: aiResult.complexity?.time?.average ?? null,
      suggestion: aiResult.improvements?.[0]?.suggestion ?? null,
      result: wrapStoredAnalysisResult(aiResult) as unknown as Prisma.InputJsonValue,
    });
  }

  async listUserAnalyses(userId: string, query: AnalysisHistoryQuery) {
    // One extra row proves whether another page exists.
    const rows = await analysisRepository.findManyByUser(userId, {
      cursorCreatedAt: query.cursorCreatedAt,
      cursorId: query.cursorId,
      take: query.limit + 1,
    });
    return paginate(rows, query.limit, (row) => encodeAnalysisCursor({ createdAt: row.createdAt.toISOString(), id: row.id }));
  }

  async getUserAnalysisById(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findOneByUser(userId, analysisId);
    if (!analysis) throw AppError.notFound("Analysis not found.");
    return analysis;
  }

  async shareAnalysis(userId: string, analysisId: string) {
    const analysis = await analysisRepository.findForShare(analysisId, userId);
    if (!analysis) throw AppError.notFound("Analysis not found.");

    // Idempotent: return the existing share URL if already public.
    if (analysis.shareId && analysis.isPublic) {
      return { shareUrl: `${env.webAppUrl}/share/analysis/${analysis.shareId}` };
    }

    const shareId = generateShareId();
    await analysisRepository.setPublic(analysisId, shareId);
    return { shareUrl: `${env.webAppUrl}/share/analysis/${shareId}` };
  }

  async getPublicAnalysis(shareId: string): Promise<SharedAnalysisResponse> {
    const analysis = await analysisRepository.findPublicByShareId(shareId);
    if (!analysis) throw AppError.notFound("Analysis not found or not public.");
    return serializeSharedAnalysis(analysis);
  }
}

export const analysisService = new AnalysisService();
__P3_EOF__

write_file apps/api/src/services/admin.service.ts <<'__P3_EOF__'
//# filename: apps/api/src/services/admin.service.ts

import { Role } from "@algoforge/db";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";

class AdminService {
  /**
   * Promotes userId to ADMIN.
   * Role is always hardcoded here, it is never accepted from the request body.
   */
  async upgradeToAdmin(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found.");

    if (user.role === Role.ADMIN) {
      return { user, changed: false };
    }

    const updated = await userRepository.setRole(userId, Role.ADMIN);
    return { user: updated, changed: true };
  }

  /**
   * Demotes userId to USER.
   * Role is always hardcoded here, it is never accepted from the request body.
   */
  async downgradeToUser(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw AppError.notFound("User not found.");

    if (user.role === Role.USER) {
      return { user, changed: false };
    }

    const updated = await userRepository.setRole(userId, Role.USER);
    return { user: updated, changed: true };
  }

  async listUsers(limit: number, cursor?: string) {
    const rows = await userRepository.findPage({ take: limit + 1, cursor });
    return paginate(rows, limit, (row) => row.id);
  }
}

export const adminService = new AdminService();
__P3_EOF__

# ---- controllers -------------------------------------------------------------
write_file apps/api/src/controllers/analysis.controller.ts <<'__P3_EOF__'
import { Request, Response } from "express";
import type { AnalysisHistoryResponse } from "@algoforge/contracts";
import { serializeAnalysisRecord, serializeHistoryItem } from "../serializers/analysis";
import { analysisService } from "../services/analysis.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseAnalysisHistoryQuery, parseAnalysisInput } from "../validation/analysis";

class AnalysisController {
  createAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const input = parseAnalysisInput(req.body);
    const analysis = await analysisService.createAnalysis(req.auth!.user.id, input);
    res.status(201).json(serializeAnalysisRecord(analysis));
  });

  listAnalyses = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAnalysisHistoryQuery(req.query);
    const { items, meta } = await analysisService.listUserAnalyses(req.auth!.user.id, query);
    const data = items.flatMap((row) => {
      const item = serializeHistoryItem(row);
      return item ? [item] : [];
    });
    const body: AnalysisHistoryResponse = { data, meta };
    res.json(body);
  });

  getAnalysisById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Analysis id is required.");
    const analysis = await analysisService.getUserAnalysisById(req.auth!.user.id, id);
    res.json(serializeAnalysisRecord(analysis));
  });

  shareAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Analysis id is required.");
    const result = await analysisService.shareAnalysis(req.auth!.user.id, id);
    res.json(result);
  });

  getPublicAnalysis = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const result = await analysisService.getPublicAnalysis(shareId);
    res.json(result);
  });
}

export const analysisController = new AnalysisController();
__P3_EOF__

write_file apps/api/src/controllers/explanation-session.controller.ts <<'__P3_EOF__'
import { Request, Response } from "express";
import type { ExplainSessionListResponse } from "@algoforge/contracts";
import { serializeSessionDetail, serializeSessionSummary, serializeSharedSession } from "../serializers/explain";
import { explanationSessionService } from "../services/explanation-session.service";
import { asyncHandler } from "../utils/async-handler";
import { parseCreateSession, parseSendMessage, parseListSessionsQuery } from "../validation/explanation-session";
import { ensureString } from "../validation/common";

class ExplanationSessionController {
  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateSession(req.body);
    const session = await explanationSessionService.createSession(req.auth!.user.id, input);
    res.status(201).json(serializeSessionDetail(session));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListSessionsQuery(req.query);
    const { items, meta } = await explanationSessionService.listSessions(req.auth!.user.id, query);
    const body: ExplainSessionListResponse = { data: items.map(serializeSessionSummary), meta };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const session = await explanationSessionService.getSession(req.auth!.user.id, id);
    res.json(serializeSessionDetail(session));
  });

  sendMessage = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const input = parseSendMessage(req.body);
    const result = await explanationSessionService.sendMessage(req.auth!.user.id, id, input);
    res.status(201).json(result);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    await explanationSessionService.deleteSession(req.auth!.user.id, id);
    res.status(204).send();
  });

  share = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Session id is required.");
    const result = await explanationSessionService.shareSession(req.auth!.user.id, id);
    res.json(result);
  });

  getPublic = asyncHandler(async (req: Request, res: Response) => {
    const shareId = ensureString(req.params.shareId, "Share id is required.");
    const session = await explanationSessionService.getPublicSession(shareId);
    res.json(serializeSharedSession(session));
  });
}

export const explanationSessionController = new ExplanationSessionController();
__P3_EOF__

write_file apps/api/src/controllers/category.controller.ts <<'__P3_EOF__'
import { Request, Response } from "express";
import type { CategoryListResponse } from "@algoforge/contracts";
import { categoryService } from "../services/category.service";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateCategory, parseUpdateCategory } from "../validation/category";

class CategoryController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const categories = await categoryService.listCategories();
    const body: CategoryListResponse = { data: categories };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const category = await categoryService.getCategoryById(id);
    res.json(category);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateCategory(req.body);
    const category = await categoryService.createCategory(input);
    res.status(201).json(category);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    const input = parseUpdateCategory(req.body);
    const category = await categoryService.updateCategory(id, input);
    res.json(category);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Category ID is required.");
    await categoryService.deleteCategory(id);
    res.status(204).send();
  });
}

export const categoryController = new CategoryController();
__P3_EOF__

write_file apps/api/src/controllers/algorithm.controller.ts <<'__P3_EOF__'
import { Request, Response } from "express";
import { Role } from "@algoforge/db";
import type { AlgorithmListResponse } from "@algoforge/contracts";
import { algorithmService } from "../services/algorithm/index";
import type { AlgorithmVisibility } from "../types/algorithm.types";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateAlgorithm, parseUpdateAlgorithm, parseAlgorithmQuery } from "../validation/algorithm";

const ADMIN_VIEW: AlgorithmVisibility = { isAdmin: true };

function visibilityOf(req: Request): AlgorithmVisibility {
  return { isAdmin: req.auth?.user.role === Role.ADMIN };
}

class AlgorithmController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAlgorithmQuery(req.query);
    const algorithms = await algorithmService.listAlgorithms(query, visibilityOf(req));
    const body: AlgorithmListResponse = { data: algorithms };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    const algorithm = await algorithmService.getAlgorithmById(id, lang, visibilityOf(req));
    res.json(algorithm);
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = ensureString(req.params.slug, "Algorithm slug is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    const algorithm = await algorithmService.getAlgorithmBySlug(slug, lang, visibilityOf(req));
    res.json(algorithm);
  });

  getVisualize = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const execution = await algorithmService.getAlgorithmExecution(id, visibilityOf(req));
    res.json(execution);
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateAlgorithm(req.body);
    const created = await algorithmService.createAlgorithm(input);
    res.status(201).json(created);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const input = parseUpdateAlgorithm(req.body);
    const updated = await algorithmService.updateAlgorithm(id, input);
    res.status(200).json(updated);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    await algorithmService.deleteAlgorithm(id);
    res.status(204).send();
  });
}

export const algorithmController = new AlgorithmController();
__P3_EOF__
# keep the unused-name lint quiet
true

write_file apps/api/src/controllers/admin.controller.ts <<'__P3_EOF__'
//# filename: apps/api/src/controllers/admin.controller.ts

import { Request, Response } from "express";
import { LIMITS, type AdminRoleChangeResponse, type AdminUserListResponse } from "@algoforge/contracts";
import { serializeAdminUser } from "../serializers/admin";
import { adminService } from "../services/admin.service";
import { asyncHandler } from "../utils/async-handler";
import { AppError } from "../utils/app-error";

const { defaultSize: DEFAULT_PAGE_SIZE, maxSize: MAX_PAGE_SIZE } = LIMITS.pagination.adminUsers;

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_PAGE_SIZE;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > MAX_PAGE_SIZE) {
    throw AppError.badRequest(`limit must be an integer between 1 and ${MAX_PAGE_SIZE}.`);
  }
  return n;
}

function readUserId(body: unknown): string {
  const { userId } = (body ?? {}) as { userId?: unknown };
  if (typeof userId !== "string" || !userId.trim()) throw AppError.badRequest("userId is required.");
  return userId.trim();
}

class AdminController {
  /** POST /api/admin/upgrade-user. The role is hard-coded server-side, never read from the body. */
  upgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.upgradeToAdmin(readUserId(req.body));
    const body: AdminRoleChangeResponse = {
      changed: result.changed,
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
    };
    res.json(body);
  });

  /** POST /api/admin/downgrade-user */
  downgradeUser = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.downgradeToUser(readUserId(req.body));
    const body: AdminRoleChangeResponse = {
      changed: result.changed,
      user: { id: result.user.id, email: result.user.email, role: result.user.role },
    };
    res.json(body);
  });

  /** GET /api/admin/users?limit=50&cursor=<userId> */
  listUsers = asyncHandler(async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    const cursor = typeof req.query.cursor === "string" && req.query.cursor.trim() ? req.query.cursor.trim() : undefined;
    const { items, meta } = await adminService.listUsers(limit, cursor);
    const body: AdminUserListResponse = { data: items.map(serializeAdminUser), meta };
    res.json(body);
  });
}

export const adminController = new AdminController();
__P3_EOF__

write_file apps/api/src/routes/openapi.ts <<'__P3_EOF__'
import { Router } from "express";
import { buildOpenApiDocument, type OpenApiDocument } from "@algoforge/contracts";

const router = Router();
let cached: OpenApiDocument | null = null;

/** Mounted by app.ts only outside production. The document is built once from the shared contracts. */
router.get("/openapi.json", (req, res) => {
  cached ??= buildOpenApiDocument({ serverUrl: `${req.protocol}://${req.get("host") ?? "localhost"}` });
  res.json(cached);
});

export default router;
__P3_EOF__

# ---- surgical patches to existing API files -----------------------------------
patch_file apps/api/src/app.ts <<'__P3_EOF__'
export default (src) => {
  if (src.includes("JSON_BODY_LIMIT_BYTES")) return null;
  let out = src;
  const mustReplace = (from, to) => {
    if (!out.includes(from)) throw new Error("app.ts: expected text not found: " + from);
    out = out.replace(from, to);
  };
  mustReplace('import cors from "cors";\n', 'import cors from "cors";\nimport { JSON_BODY_LIMIT_BYTES } from "@algoforge/contracts";\n');
  mustReplace('import healthRouter             from "./routes/health";\n', 'import healthRouter             from "./routes/health";\nimport openapiRouter            from "./routes/openapi";\n');
  mustReplace('express.json({ limit: "256kb" })', "express.json({ limit: JSON_BODY_LIMIT_BYTES })");
  mustReplace("app.use(healthRouter);\n", "app.use(healthRouter);\n\n// OpenAPI document generated from @algoforge/contracts (development only).\nif (!env.isProduction) app.use(openapiRouter);\n");
  return out;
};
__P3_EOF__

patch_file apps/api/src/services/explanation-session.service.ts <<'__P3_EOF__'
export default (src) => {
  if (src.includes("paginate(")) return null;
  const start = src.indexOf("  async listSessions(");
  const endMarker = "return { sessions, nextCursor };\n  }\n";
  const endAt = src.indexOf(endMarker);
  if (start < 0 || endAt < 0) throw new Error("explanation-session.service.ts: listSessions block not found");
  const replacement = [
    "  async listSessions(userId: string, query: ListSessionsQuery) {",
    "    // One extra row proves whether another page exists.",
    "    const rows = await explanationSessionRepository.findManyByUser(userId, {",
    "      take:   query.limit + 1,",
    "      cursor: query.cursor,",
    "    });",
    "    return paginate(rows, query.limit, (row) => row.id);",
    "  }\n",
  ].join("\n");
  let out = src.slice(0, start) + replacement + src.slice(endAt + endMarker.length);
  const imp = 'import { layeredCache } from "./lib/layered-cache";\n';
  if (!out.includes(imp)) throw new Error("explanation-session.service.ts: import anchor not found");
  out = out.replace(imp, imp + 'import { paginate } from "../utils/pagination";\n');
  return out;
};
__P3_EOF__

patch_file apps/api/package.json <<'__P3_EOF__'
export default (src) => {
  const pkg = JSON.parse(src);
  pkg.devDependencies = pkg.devDependencies ?? {};
  pkg.devDependencies["@algoforge/contracts"] = "workspace:*";
  pkg.devDependencies = Object.fromEntries(Object.entries(pkg.devDependencies).sort(([a], [b]) => a.localeCompare(b)));
  const out = JSON.stringify(pkg, null, 2) + "\n";
  return out === src ? null : out;
};
__P3_EOF__

patch_file packages/contracts/src/analysis.ts <<'__P3_EOF__'
export default (src) => {
  let out = src.replace('import { CursorSchema, IsoDateTimeSchema, pageQuerySchema } from "./common";', 'import { IsoDateTimeSchema, pageQuerySchema } from "./common";');
  out = out.replace("export { CursorSchema };\n", "");
  return out === src ? null : out;
};
__P3_EOF__

patch_file package.json <<'__P3_EOF__'
export default (src) => {
  const pkg = JSON.parse(src);
  pkg.scripts = pkg.scripts ?? {};
  pkg.scripts.typecheck = "pnpm --filter @algoforge/db typecheck && pnpm --filter @algoforge/contracts typecheck && pnpm --filter api typecheck";
  pkg.scripts["typecheck:web"] = "pnpm --filter @algoforge/web typecheck";
  pkg.scripts.test = "pnpm --filter @algoforge/contracts test && pnpm --filter api test && pnpm --filter @algoforge/web test";
  pkg.scripts["test:contracts"] = "pnpm --filter @algoforge/contracts test";
  const out = JSON.stringify(pkg, null, 2) + "\n";
  return out === src ? null : out;
};
__P3_EOF__

# ---- API tests: responses validated against the shared schemas ----------------
write_file apps/api/src/contracts/serializers.test.ts <<'__P3_EOF__'
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminUserSchema,
  AnalysisHistoryResponseSchema,
  AnalysisRecordResponseSchema,
  ExplainSessionDetailSchema,
  ExplainSessionListResponseSchema,
  SharedAnalysisResponseSchema,
  SharedExplainSessionResponseSchema,
  wrapStoredAnalysisResult,
  type AnalysisResult,
} from "@algoforge/contracts";
import { serializeAdminUser } from "../serializers/admin";
import { serializeAnalysisRecord, serializeHistoryItem, serializeSharedAnalysis } from "../serializers/analysis";
import { toIso } from "../serializers/dates";
import { serializeSessionDetail, serializeSessionSummary, serializeSharedSession } from "../serializers/explain";
import { paginate } from "../utils/pagination";
import { decodeAnalysisCursor, encodeAnalysisCursor } from "../validation/analysis";

const RESULT: AnalysisResult = {
  summary: "s",
  complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
  breakdown: { approach: "a", steps: ["x"] },
  bottlenecks: [],
  antiPatterns: [],
  improvements: [],
  optimizedCode: "code",
  edgeCases: [],
};
const D = new Date("2026-05-04T10:15:30.000Z");

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("dates", () => {
  it("serializes Date objects and cached strings to ISO UTC", () => {
    expect(toIso(D)).toBe("2026-05-04T10:15:30.000Z");
    expect(toIso("2026-05-04T10:15:30Z")).toBe("2026-05-04T10:15:30.000Z");
    expect(() => toIso("nope")).toThrow(RangeError);
  });
});

describe("analysis responses match the contracts", () => {
  it("serializes a versioned, a legacy and an unreadable stored result", () => {
    const rows = [
      { id: "a1", language: "python", result: wrapStoredAnalysisResult(RESULT), createdAt: D },
      { id: "a2", language: "javascript", result: RESULT, createdAt: D },
      { id: "a3", language: "python", result: { schemaVersion: 99, data: RESULT }, createdAt: D },
      { id: "a4", language: "python", result: { garbage: true }, createdAt: D },
    ];
    const out = rows.map((r) => AnalysisRecordResponseSchema.parse(serializeAnalysisRecord(r)));
    expect(out.map((o) => o.resultStatus)).toEqual(["ok", "ok", "unreadable", "unreadable"]);
    expect(out[2]?.result).toBeNull();
  });

  it("builds a paginated history page that validates", () => {
    const rows = Array.from({ length: 4 }, (_, i) => ({
      id: `id${i}`,
      language: "python",
      complexity: "O(n)",
      suggestion: null,
      createdAt: new Date(D.getTime() - i * 1000),
    }));
    const { items, meta } = paginate(rows, 3, (r) => encodeAnalysisCursor({ createdAt: r.createdAt.toISOString(), id: r.id }));
    const body = AnalysisHistoryResponseSchema.parse({ data: items.flatMap((r) => serializeHistoryItem(r) ?? []), meta });
    expect(body.data).toHaveLength(3);
    expect(meta.hasMore).toBe(true);
    expect(decodeAnalysisCursor(meta.nextCursor ?? "").id).toBe("id2");
  });

  it("skips a history row it cannot represent", () => {
    expect(serializeHistoryItem({ id: "x", language: "cobol", complexity: null, suggestion: null, createdAt: D })).toBeNull();
  });

  it("serializes a shared analysis with an optional creator", () => {
    const base = { id: "a1", language: "python", code: "x", result: wrapStoredAnalysisResult(RESULT), createdAt: D };
    const withUser = SharedAnalysisResponseSchema.parse(serializeSharedAnalysis({ ...base, user: { id: "u1", name: "N", username: null, image: null } }));
    expect(withUser.creator?.username).toBe("N");
    expect(SharedAnalysisResponseSchema.parse(serializeSharedAnalysis({ ...base, user: null })).creator).toBeUndefined();
  });
});

describe("explain responses match the contracts", () => {
  const row = {
    id: "s1",
    userId: "private-user-id",
    title: null,
    shareId: null,
    isPublic: false,
    createdAt: D,
    updatedAt: D,
    messages: [
      { id: "m1", role: "user", content: "hello there", createdAt: "2026-05-04T10:15:30.000Z" },
      { id: "m2", role: "robot", content: "malformed" },
    ],
  };

  it("drops malformed messages and never leaks userId", () => {
    const detail = ExplainSessionDetailSchema.parse(serializeSessionDetail(row));
    expect(detail.messages).toHaveLength(1);
    expect(JSON.stringify(detail)).not.toContain("private-user-id");
  });

  it("builds a paginated session list", () => {
    const { items, meta } = paginate([row, { ...row, id: "s2" }, { ...row, id: "s3" }], 2, (r) => r.id);
    const body = ExplainSessionListResponseSchema.parse({ data: items.map(serializeSessionSummary), meta });
    expect(body.meta).toEqual({ hasMore: true, nextCursor: "s2" });
  });

  it("serializes a public session", () => {
    const shared = SharedExplainSessionResponseSchema.parse(serializeSharedSession({ ...row, user: { id: "u1", name: "N", username: "n", image: null } }));
    expect(shared.creator?.username).toBe("n");
  });
});

describe("admin responses match the contracts", () => {
  it("serializes users with ISO dates", () => {
    expect(AdminUserSchema.parse(serializeAdminUser({ id: "u", email: null, name: null, role: "ADMIN", createdAt: D })).createdAt).toBe(D.toISOString());
  });
});

describe("paginate", () => {
  it("reports no next page when rows fit", () => {
    expect(paginate([1, 2], 3, String)).toEqual({ items: [1, 2], meta: { hasMore: false, nextCursor: null } });
    expect(paginate([], 3, String).meta).toEqual({ hasMore: false, nextCursor: null });
  });
  it("does not claim another page when the page is exactly full", () => {
    expect(paginate([1, 2, 3], 3, String).meta.hasMore).toBe(false);
  });
});
__P3_EOF__

write_file apps/api/src/contracts/http-conformance.test.ts <<'__P3_EOF__'
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  ErrorResponseSchema,
  JSON_BODY_LIMIT_BYTES,
  REQUEST_ID_HEADER,
  paginatedResponse,
  buildOpenApiDocument,
} from "@algoforge/contracts";
import { z } from "zod";

vi.mock("@algoforge/db", () => {
  class PrismaClientKnownRequestError extends Error {
    code: string;
    constructor(message: string, init: { code: string }) {
      super(message);
      this.code = init.code;
    }
  }
  return { Prisma: { PrismaClientKnownRequestError } };
});

import { errorHandler } from "../middleware/error-handler";
import { notFoundHandler } from "../middleware/not-found";
import { requestId } from "../middleware/request-id";
import openapiRouter from "../routes/openapi";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";

let server: http.Server;
let base = "";

beforeAll(async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: JSON_BODY_LIMIT_BYTES }));
  app.use(openapiRouter);
  app.post("/echo", (_req, res) => res.json({ ok: true }));
  app.get("/missing", () => {
    throw AppError.notFound("Thing not found.");
  });
  app.get("/invalid", () => {
    throw AppError.badRequest("Bad input.", [{ path: "code", message: "Too long." }]);
  });
  app.get("/crash", () => {
    throw new Error("internal secret detail");
  });
  app.get("/list", (_req, res) => {
    const { items, meta } = paginate([{ id: "a" }, { id: "b" }, { id: "c" }], 2, (r) => r.id);
    res.json({ data: items, meta });
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  vi.restoreAllMocks();
});

async function errorBody(res: Response) {
  const parsed = ErrorResponseSchema.safeParse(await res.json());
  expect(parsed.success).toBe(true);
  return parsed.success ? parsed.data : null;
}

describe("one error envelope on every failure", () => {
  it("covers 404 (route), 404 (resource), 400 with details, 400 malformed JSON, 413 and 500", async () => {
    const route = await fetch(`${base}/nope`);
    expect(route.status).toBe(404);
    expect((await errorBody(route))?.error.code).toBe("NOT_FOUND");

    const missing = await fetch(`${base}/missing`);
    expect(missing.status).toBe(404);
    expect((await errorBody(missing))?.error.message).toBe("Thing not found.");

    const invalid = await fetch(`${base}/invalid`);
    expect(invalid.status).toBe(400);
    expect((await errorBody(invalid))?.error.details).toEqual([{ path: "code", message: "Too long." }]);

    const malformed = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: "{oops" });
    expect(malformed.status).toBe(400);
    expect((await errorBody(malformed))?.error.message).toBe("Malformed JSON body.");

    const big = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blob: "a".repeat(JSON_BODY_LIMIT_BYTES + 10) }) });
    expect(big.status).toBe(413);
    expect((await errorBody(big))?.error.code).toBe("PAYLOAD_TOO_LARGE");

    const crash = await fetch(`${base}/crash`);
    expect(crash.status).toBe(500);
    const crashBody = await errorBody(crash);
    expect(crashBody?.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(crashBody)).not.toContain("internal secret detail");
  });

  it("accepts a body at the largest code size the contract allows", async () => {
    const res = await fetch(`${base}/echo`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "a".repeat(20_000) }) });
    expect(res.status).toBe(200);
  });
});

describe("X-Request-Id", () => {
  it("is present on success and error responses", async () => {
    for (const path of ["/list", "/missing", "/nope"]) {
      const res = await fetch(`${base}${path}`);
      expect(res.headers.get(REQUEST_ID_HEADER)).toMatch(/^[A-Za-z0-9._-]{8,64}$/);
    }
  });
  it("echoes a safe incoming id and replaces an unsafe one", async () => {
    const safe = await fetch(`${base}/list`, { headers: { [REQUEST_ID_HEADER]: "client-id-12345" } });
    expect(safe.headers.get(REQUEST_ID_HEADER)).toBe("client-id-12345");
    const unsafe = await fetch(`${base}/list`, { headers: { [REQUEST_ID_HEADER]: "bad id with spaces" } });
    expect(unsafe.headers.get(REQUEST_ID_HEADER)).not.toBe("bad id with spaces");
  });
});

describe("pagination envelope", () => {
  it("validates against paginatedResponse", async () => {
    const body = paginatedResponse(z.object({ id: z.string() })).parse(await (await fetch(`${base}/list`)).json());
    expect(body).toEqual({ data: [{ id: "a" }, { id: "b" }], meta: { hasMore: true, nextCursor: "b" } });
  });
});

describe("OpenAPI endpoint", () => {
  it("serves the document generated from the contracts", async () => {
    const res = await fetch(`${base}/openapi.json`);
    expect(res.status).toBe(200);
    const doc = (await res.json()) as { openapi: string; paths: Record<string, unknown> };
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths).sort()).toEqual(Object.keys(buildOpenApiDocument().paths).sort());
  });
});
__P3_EOF__

write_file apps/api/src/contracts/route-table.test.ts <<'__P3_EOF__'
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { JSON_BODY_LIMIT_BYTES, LIMITS, routes, toExpressPath } from "@algoforge/contracts";

const SRC = resolve(__dirname, "..");

/** Mount point of every router in app.ts. A new router file must be added here and to the contracts. */
const MOUNTS: Readonly<Record<string, string>> = {
  "health.ts": "",
  "auth.ts": "/api/auth",
  "algorithm.ts": "/api/algorithms",
  "category.ts": "/api/categories",
  "analysis.ts": "/api/analysis",
  "explanation.ts": "/api/explain",
  "explanation-session.ts": "/api/explain-sessions",
  "share.ts": "/api/share",
  "admin.ts": "/api/admin",
};

function implemented(): string[] {
  const found: string[] = [];
  for (const [file, mount] of Object.entries(MOUNTS)) {
    const text = readFileSync(join(SRC, "routes", file), "utf8");
    for (const m of text.matchAll(/router\s*\.\s*(get|post|patch|delete)\s*\(\s*"([^"]*)"/g)) {
      const path = m[2] === "/" ? mount : mount + m[2];
      found.push(`${m[1]} ${path}`);
    }
  }
  return found.sort();
}

describe("contracts route table", () => {
  it("lists exactly the endpoints the Express routers serve", () => {
    const documented = routes.map((r) => `${r.method} ${toExpressPath(r.path)}`).sort();
    expect(implemented()).toEqual(documented);
  });
});

describe("shared limits are wired in", () => {
  it("app.ts uses the shared body limit instead of a literal", () => {
    const app = readFileSync(join(SRC, "app.ts"), "utf8");
    expect(app).toContain("JSON_BODY_LIMIT_BYTES");
    expect(app).not.toMatch(/limit:\s*"\d+kb"/i);
  });
  it("keeps the body limit above the largest escaped payload", () => {
    expect(JSON_BODY_LIMIT_BYTES).toBeGreaterThan(LIMITS.code.maxChars * 4);
  });
  it("no validator hard-codes the page sizes or code size", () => {
    for (const file of ["validation/analysis.ts", "validation/explanation-session.ts"]) {
      const text = readFileSync(join(SRC, file), "utf8");
      expect(text).not.toMatch(/MAX_PAGE_SIZE\s*=\s*\d+/);
      expect(text).not.toMatch(/max\(\s*\d{2,}/);
    }
  });
});
__P3_EOF__

# =============================================================================
info "3/6 Frontend: package config, typed API client, query layer"
# =============================================================================

patch_file apps/web/package.json <<'__P3_EOF__'
export default (src) => {
  const pkg = JSON.parse(src);
  pkg.dependencies = pkg.dependencies ?? {};
  pkg.dependencies["@algoforge/analysis"] = "workspace:*";
  pkg.dependencies["@algoforge/contracts"] = "workspace:*";
  pkg.dependencies["@tanstack/react-query"] = "^5.90.0";
  pkg.dependencies["zod"] = "^4.3.6";
  pkg.dependencies = Object.fromEntries(Object.entries(pkg.dependencies).sort(([a], [b]) => a.localeCompare(b)));
  const out = JSON.stringify(pkg, null, 2) + "\n";
  return out === src ? null : out;
};
__P3_EOF__

patch_file apps/web/next.config.ts <<'__P3_EOF__'
export default (src) => {
  if (src.includes("@algoforge/contracts")) return null;
  const from = 'transpilePackages: ["@algoforge/analysis", "@algoforge/forge"],';
  if (!src.includes(from)) throw new Error("next.config.ts: transpilePackages line not found");
  return src.replace(from, 'transpilePackages: ["@algoforge/analysis", "@algoforge/contracts", "@algoforge/forge"],');
};
__P3_EOF__

write_file apps/web/src/lib/api/config.ts <<'__P3_EOF__'
/**
 * Where the API lives.
 *  - NEXT_PUBLIC_API_URL unset or empty: same-origin ("/api/..."), the default; Phase 4 adds the Next.js rewrite.
 *  - NEXT_PUBLIC_API_URL=http://localhost:4000: call the API directly (cookies then need a shared site).
 * Pure so it can be tested; the app reads the constant below.
 */
export function resolveApiBaseUrl(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.replace(/\/+$/, "");
}

// A literal process.env access so Next can inline it in client code.
export const API_BASE_URL: string = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL);
__P3_EOF__

write_file apps/web/src/lib/api/errors.ts <<'__P3_EOF__'
import type { ErrorCode, ErrorDetail } from "@algoforge/contracts";

/** The API answered with a non-2xx status. Always carries the typed error envelope when the API sent one. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: readonly ErrorDetail[];
  readonly requestId: string | null;
  /** Seconds the server asked us to wait (429 only). */
  readonly retryAfterSeconds: number | null;

  constructor(init: { status: number; code: ErrorCode; message: string; details?: readonly ErrorDetail[]; requestId?: string | null; retryAfterSeconds?: number | null }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }
}

/** The request never produced a response (offline, DNS, CORS, server down). */
export class NetworkError extends Error {
  constructor(message = "Could not reach the server.", options?: { cause?: unknown }) {
    super(message, options);
    this.name = "NetworkError";
  }
}

/** The API answered 2xx but the body did not match the shared contract. */
export class ResponseValidationError extends Error {
  readonly path: string;
  readonly issues: readonly ErrorDetail[];

  constructor(path: string, issues: readonly ErrorDetail[]) {
    super(`The response from ${path} did not match the API contract.`);
    this.name = "ResponseValidationError";
    this.path = path;
    this.issues = issues;
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** A short message that is safe to show to people. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) {
      return error.retryAfterSeconds !== null ? `Too many requests. Try again in ${error.retryAfterSeconds}s.` : "Too many requests. Try again shortly.";
    }
    return error.message;
  }
  if (error instanceof NetworkError) return error.message;
  if (error instanceof ResponseValidationError) return "The server sent an unexpected response.";
  return "Something went wrong.";
}
__P3_EOF__

write_file apps/web/src/lib/api/csrf.ts <<'__P3_EOF__'
import { CSRF_COOKIE_NAME } from "@algoforge/contracts";

/** Reads one cookie from a cookie header string. Pure, so it is testable without a DOM. */
export function readCookie(header: string, name: string): string | null {
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(eq + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** The af_csrf cookie is readable by design (double-submit). The access and refresh cookies are httpOnly. */
export function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  return readCookie(document.cookie, CSRF_COOKIE_NAME);
}
__P3_EOF__

write_file apps/web/src/lib/api/client.ts <<'__P3_EOF__'
import { z } from "zod";
import { CSRF_HEADER_NAME, ERROR_CODES, ErrorResponseSchema, REQUEST_ID_HEADER, RETRY_AFTER_HEADER, type ErrorCode } from "@algoforge/contracts";
import { API_BASE_URL } from "./config";
import { getCsrfToken } from "./csrf";
import { ApiError, NetworkError, ResponseValidationError } from "./errors";

export type QueryParams = Readonly<Record<string, string | number | boolean | null | undefined>>;

export interface ApiClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  getCsrfToken?: () => string | null;
  /** Called when a 401 could not be fixed by refreshing the session (Phase 4 uses it to show sign-in). */
  onSessionExpired?: () => void;
  /** A GET that gets a 429 with a Retry-After at most this long is retried once automatically. */
  maxAutoRetryWaitSeconds?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  query?: QueryParams;
  signal?: AbortSignal;
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";
const REFRESH_PATH = "/api/auth/refresh";
const NO_REFRESH_PREFIXES = [REFRESH_PATH, "/api/auth/google/"];
const MUTATING: ReadonlySet<Method> = new Set<Method>(["POST", "PATCH", "DELETE"]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const CODE_FOR_STATUS: Readonly<Record<number, ErrorCode>> = {
  400: "BAD_REQUEST", 401: "UNAUTHORIZED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE", 429: "TOO_MANY_REQUESTS", 502: "BAD_GATEWAY",
};
const isErrorCode = (value: string): value is ErrorCode => (ERROR_CODES as readonly string[]).includes(value);

/** Retry-After is either a number of seconds or an HTTP date. */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, Math.ceil((at - now) / 1000));
}

function buildQuery(query: QueryParams | undefined): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : "";
}

async function toApiError(res: Response): Promise<ApiError> {
  const requestId = res.headers.get(REQUEST_ID_HEADER);
  const retryAfterSeconds = parseRetryAfter(res.headers.get(RETRY_AFTER_HEADER));
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const parsed = ErrorResponseSchema.safeParse(payload);
  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError({ status: res.status, code, message, details, requestId, retryAfterSeconds });
  }
  const code = CODE_FOR_STATUS[res.status] ?? "INTERNAL_ERROR";
  return new ApiError({ status: res.status, code: isErrorCode(code) ? code : "INTERNAL_ERROR", message: res.statusText || "Request failed.", requestId, retryAfterSeconds });
}

export function createApiClient(options: ApiClientOptions = {}) {
  const baseUrl = (options.baseUrl ?? API_BASE_URL).replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const csrfToken = options.getCsrfToken ?? getCsrfToken;
  const sleep = options.sleep ?? defaultSleep;
  const maxAutoRetryWait = options.maxAutoRetryWaitSeconds ?? 5;

  async function transport(method: Method, path: string, body: unknown, query: QueryParams | undefined, signal: AbortSignal | undefined): Promise<Response> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (MUTATING.has(method)) {
      const token = csrfToken(); // read per attempt: a refresh rotates the cookie
      if (token) headers[CSRF_HEADER_NAME] = token;
    }
    try {
      return await doFetch(`${baseUrl}${path}${buildQuery(query)}`, {
        method,
        headers,
        credentials: "include",
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      throw new NetworkError(undefined, { cause: error });
    }
  }

  // Single-flight: concurrent 401s share one refresh request.
  let refreshing: Promise<boolean> | null = null;
  function refreshSession(): Promise<boolean> {
    refreshing ??= (async () => {
      try {
        const res = await transport("POST", REFRESH_PATH, undefined, undefined, undefined);
        return res.ok;
      } catch {
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function execute(method: Method, path: string, body: unknown, opts: RequestOptions): Promise<Response> {
    let res = await transport(method, path, body, opts.query, opts.signal);

    if (res.status === 401 && !NO_REFRESH_PREFIXES.some((p) => path.startsWith(p))) {
      if (await refreshSession()) res = await transport(method, path, body, opts.query, opts.signal); // exactly one retry
      if (res.status === 401) options.onSessionExpired?.();
    }

    if (res.status === 429 && method === "GET") {
      const wait = parseRetryAfter(res.headers.get(RETRY_AFTER_HEADER));
      if (wait !== null && wait <= maxAutoRetryWait) {
        await sleep(wait * 1000);
        res = await transport(method, path, body, opts.query, opts.signal);
      }
    }

    if (!res.ok) throw await toApiError(res);
    return res;
  }

  async function parseBody<S extends z.ZodType>(res: Response, path: string, schema: S): Promise<z.output<S>> {
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new ResponseValidationError(path, [{ path: "", message: "The response body was not valid JSON." }]);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ResponseValidationError(path, parsed.error.issues.map((i) => ({ path: i.path.map(String).join("."), message: i.message })));
    }
    return parsed.data;
  }

  return {
    get: async <S extends z.ZodType>(path: string, schema: S, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("GET", path, undefined, opts), path, schema),
    post: async <S extends z.ZodType>(path: string, schema: S, body?: unknown, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("POST", path, body, opts), path, schema),
    patch: async <S extends z.ZodType>(path: string, schema: S, body?: unknown, opts: RequestOptions = {}): Promise<z.output<S>> =>
      parseBody(await execute("PATCH", path, body, opts), path, schema),
    /** For endpoints that answer 204 with no body. */
    postEmpty: async (path: string, body?: unknown, opts: RequestOptions = {}): Promise<void> => {
      await execute("POST", path, body, opts);
    },
    delete: async (path: string, opts: RequestOptions = {}): Promise<void> => {
      await execute("DELETE", path, undefined, opts);
    },
    refreshSession,
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

/** The app-wide client. Phase 4 passes onSessionExpired when the auth provider exists. */
export const apiClient: ApiClient = createApiClient();
__P3_EOF__

write_file apps/web/src/lib/api/endpoints.ts <<'__P3_EOF__'
import {
  AlgorithmListResponseSchema,
  AnalysisHistoryResponseSchema,
  CategoryListResponseSchema,
  ExplainSessionListResponseSchema,
  type AlgorithmListQuery,
  type AlgorithmListResponse,
  type AnalysisHistoryResponse,
  type CategoryListResponse,
  type ExplainSessionListResponse,
} from "@algoforge/contracts";
import { apiClient, type ApiClient } from "./client";

export interface PageParams {
  limit?: number;
  cursor?: string;
}

/** Typed endpoint functions. Every response is validated against the shared schema. */
export function createEndpoints(client: ApiClient) {
  return {
    analysisHistory: (params: PageParams = {}, signal?: AbortSignal): Promise<AnalysisHistoryResponse> =>
      client.get("/api/analysis", AnalysisHistoryResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
    algorithms: (params: AlgorithmListQuery = {}, signal?: AbortSignal): Promise<AlgorithmListResponse> =>
      client.get("/api/algorithms", AlgorithmListResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
    categories: (signal?: AbortSignal): Promise<CategoryListResponse> =>
      client.get("/api/categories", CategoryListResponseSchema, signal ? { signal } : {}),
    explainSessions: (params: PageParams = {}, signal?: AbortSignal): Promise<ExplainSessionListResponse> =>
      client.get("/api/explain-sessions", ExplainSessionListResponseSchema, { query: { ...params }, ...(signal ? { signal } : {}) }),
  };
}

export const endpoints = createEndpoints(apiClient);
__P3_EOF__

write_file apps/web/src/lib/api/index.ts <<'__P3_EOF__'
export { API_BASE_URL, resolveApiBaseUrl } from "./config";
export { ApiError, NetworkError, ResponseValidationError, errorMessage, isApiError } from "./errors";
export { getCsrfToken, readCookie } from "./csrf";
export { apiClient, createApiClient, parseRetryAfter } from "./client";
export type { ApiClient, ApiClientOptions, QueryParams, RequestOptions } from "./client";
export { createEndpoints, endpoints } from "./endpoints";
export type { PageParams } from "./endpoints";
__P3_EOF__

write_file apps/web/src/lib/query/queryClient.ts <<'__P3_EOF__'
import { QueryClient } from "@tanstack/react-query";
import { ApiError, NetworkError } from "../api/errors";

const MAX_RETRIES = 2;

/** Retry rules shared by every query: transient problems retry, caller mistakes do not. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) return false;
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) return error.status === 429 || error.status >= 500;
  return false; // 4xx (the API client already tried a session refresh) and contract violations
}

/** 429 waits for the server's hint (capped); everything else backs off exponentially. */
export function retryDelayMs(attempt: number, error: unknown): number {
  if (error instanceof ApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, gcTime: 5 * 60_000, refetchOnWindowFocus: false, retry: shouldRetry, retryDelay: retryDelayMs },
      mutations: { retry: false },
    },
  });
}
__P3_EOF__

write_file apps/web/src/lib/query/keys.ts <<'__P3_EOF__'
import type { AlgorithmListQuery } from "@algoforge/contracts";

/** One place for every cache key, so invalidation stays predictable. */
export const queryKeys = {
  analysisHistory: () => ["analysis", "history"] as const,
  algorithms: (params: AlgorithmListQuery = {}) => ["algorithms", "list", params] as const,
  categories: () => ["categories", "list"] as const,
  explainSessions: () => ["explain", "sessions"] as const,
};
__P3_EOF__

write_file apps/web/src/lib/query/QueryProvider.tsx <<'__P3_EOF__'
"use client";

import { useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createQueryClient } from "./queryClient";

export function QueryProvider({ children }: { children: ReactNode }) {
  // Created once per browser session, never at module scope (so it is not shared between server requests).
  const [client] = useState(createQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
__P3_EOF__

write_file apps/web/src/lib/query/hooks.ts <<'__P3_EOF__'
"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { LIMITS, type AlgorithmListQuery } from "@algoforge/contracts";
import { endpoints } from "../api/endpoints";
import { queryKeys } from "./keys";

/** History pages follow meta.nextCursor until meta.hasMore is false. */
export function useAnalysisHistory(options: { enabled?: boolean; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? LIMITS.pagination.analysisHistory.defaultSize;
  return useInfiniteQuery({
    queryKey: [...queryKeys.analysisHistory(), pageSize],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.analysisHistory({ limit: pageSize, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    enabled: options.enabled ?? true,
  });
}

export function useAlgorithms(params: AlgorithmListQuery = {}) {
  return useQuery({ queryKey: queryKeys.algorithms(params), queryFn: ({ signal }) => endpoints.algorithms(params, signal) });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories(), queryFn: ({ signal }) => endpoints.categories(signal) });
}

export function useExplainSessions(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.explainSessions(), queryFn: ({ signal }) => endpoints.explainSessions({}, signal), enabled: options.enabled ?? true });
}
__P3_EOF__

write_file apps/web/src/lib/query/QueryBoundary.tsx <<'__P3_EOF__'
"use client";

import type { ReactNode } from "react";
import { errorMessage } from "../api/errors";

export interface QueryStateLike {
  isPending: boolean;
  isError: boolean;
  error: unknown;
  isFetching: boolean;
  refetch: () => unknown;
}

/** The one loading / error / retry pattern. Pass any TanStack query result; render children when data is ready. */
export function QueryBoundary({ query, children, loadingLabel = "Loading…" }: { query: QueryStateLike; children: ReactNode; loadingLabel?: string }) {
  if (query.isPending) {
    return (
      <div role="status" aria-busy className="p-6 text-center text-xs text-muted-foreground">
        {loadingLabel}
      </div>
    );
  }
  if (query.isError) {
    return (
      <div role="alert" className="flex flex-col items-center gap-3 p-6 text-center">
        <p className="text-xs text-muted-foreground">{errorMessage(query.error)}</p>
        <button
          type="button"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          className="h-7 rounded-md border border-primary-foreground/20 px-3 text-[11px] font-medium disabled:opacity-50"
        >
          {query.isFetching ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }
  return <>{children}</>;
}
__P3_EOF__

write_file apps/web/src/lib/query/index.ts <<'__P3_EOF__'
export { QueryProvider } from "./QueryProvider";
export { QueryBoundary } from "./QueryBoundary";
export type { QueryStateLike } from "./QueryBoundary";
export { createQueryClient, retryDelayMs, shouldRetry } from "./queryClient";
export { queryKeys } from "./keys";
export { useAlgorithms, useAnalysisHistory, useCategories, useExplainSessions } from "./hooks";
__P3_EOF__

# ---- frontend patches -----------------------------------------------------------
patch_file apps/web/src/app/layout.tsx <<'__P3_EOF__'
export default (src) => {
  if (src.includes("QueryProvider")) return null;
  const imp = 'import MotionProvider from "@/components/MotionProvider";\n';
  const body = "<MotionProvider>{children}</MotionProvider>";
  if (!src.includes(imp) || !src.includes(body)) throw new Error("layout.tsx: expected anchors not found");
  return src
    .replace(imp, imp + 'import { QueryProvider } from "@/lib/query/QueryProvider";\n')
    .replace(body, "<MotionProvider>\n                    <QueryProvider>{children}</QueryProvider>\n                </MotionProvider>");
};
__P3_EOF__

patch_file apps/web/src/components/DashBoard/Analysis.tsx <<'__P3_EOF__'
export default (src) => {
  if (src.includes("@algoforge/contracts")) return null;
  const start = src.indexOf("export type Language = ");
  const end = src.indexOf("export type SeriesKey");
  if (start < 0 || end < 0 || end < start) throw new Error("Analysis.tsx: type block not found");
  const block = [
    "// Analysis types come from the shared contracts package; none are declared here.",
    "export type { AnalysisResult, Bottleneck, Breakdown, Comparison, ComplexityResult, Improvement };",
    "export type Language = AnalysisLanguage;",
    "export type Analysis = AnalysisReport;",
    'type State = "idle" | "analyzing" | "completed";',
    "",
    "",
  ].join("\n");
  let out = src.slice(0, start) + block + src.slice(end);
  const anchor = 'import { SampleChip } from "@/components/ui/SampleChip";\n';
  if (!out.includes(anchor)) throw new Error("Analysis.tsx: import anchor not found");
  const imp =
    'import type {\n    AnalysisLanguage,\n    AnalysisReport,\n    AnalysisResult,\n    Bottleneck,\n    Breakdown,\n    Comparison,\n    ComplexityResult,\n    Improvement,\n} from "@algoforge/contracts";\n';
  out = out.replace(anchor, anchor + imp);
  return out;
};
__P3_EOF__

# ---- frontend tests -------------------------------------------------------------
write_file apps/web/src/lib/api/client.test.ts <<'__P3_EOF__'
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CSRF_HEADER_NAME } from "@algoforge/contracts";
import { createApiClient, parseRetryAfter } from "./client";
import { readCookie } from "./csrf";
import { resolveApiBaseUrl } from "./config";
import { ApiError, NetworkError, ResponseValidationError, errorMessage } from "./errors";
import { retryDelayMs, shouldRetry } from "../query/queryClient";

const Item = z.object({ id: z.string() });
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;
function client(handler: Handler, extra: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    return handler(url, init ?? {});
  };
  return { api: createApiClient({ baseUrl: "http://api.test", fetchImpl, getCsrfToken: () => "csrf-1", sleep: async () => undefined, ...extra }), calls };
}

describe("config and csrf helpers", () => {
  it("normalizes the base url", () => {
    expect(resolveApiBaseUrl(undefined)).toBe("");
    expect(resolveApiBaseUrl("  http://localhost:4000/// ")).toBe("http://localhost:4000");
  });
  it("reads a cookie by name", () => {
    expect(readCookie("a=1; af_csrf=tok%20en; b=2", "af_csrf")).toBe("tok en");
    expect(readCookie("a=1", "af_csrf")).toBeNull();
  });
  it("parses Retry-After seconds and dates", () => {
    expect(parseRetryAfter("12")).toBe(12);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(new Date(1_000_000 + 7_000).toUTCString(), 1_000_000)).toBeGreaterThanOrEqual(6);
  });
});

describe("requests", () => {
  it("sends credentials, builds the query and validates the response", async () => {
    const { api, calls } = client(() => json(200, { id: "a" }));
    const out = await api.get("/api/x", Item, { query: { limit: 5, cursor: undefined, q: "" } });
    expect(out).toEqual({ id: "a" });
    expect(calls[0]?.url).toBe("http://api.test/api/x?limit=5");
    expect(calls[0]?.init.credentials).toBe("include");
  });

  it("adds the CSRF header to mutations only", async () => {
    const { api, calls } = client(() => json(200, { id: "a" }));
    await api.get("/api/x", Item);
    await api.post("/api/x", Item, { a: 1 });
    const headerOf = (i: number) => (calls[i]?.init.headers as Record<string, string>)[CSRF_HEADER_NAME];
    expect(headerOf(0)).toBeUndefined();
    expect(headerOf(1)).toBe("csrf-1");
  });

  it("throws ResponseValidationError when the body breaks the contract", async () => {
    const { api } = client(() => json(200, { nope: true }));
    await expect(api.get("/api/x", Item)).rejects.toBeInstanceOf(ResponseValidationError);
  });

  it("maps the typed error envelope, request id and details", async () => {
    const { api } = client(() => json(400, { error: { code: "BAD_REQUEST", message: "Bad.", details: [{ path: "code", message: "Too long." }] } }, { "X-Request-Id": "rid-12345678" }));
    const error = await api.get("/api/x", Item).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: "BAD_REQUEST", requestId: "rid-12345678", details: [{ path: "code", message: "Too long." }] });
  });

  it("falls back to a status-based error for a non-envelope body", async () => {
    const { api } = client(() => new Response("<html>", { status: 502 }));
    expect(await api.get("/api/x", Item).catch((e: unknown) => e)).toMatchObject({ status: 502, code: "BAD_GATEWAY" });
  });

  it("wraps a failed fetch as NetworkError", async () => {
    const api = createApiClient({ baseUrl: "http://api.test", fetchImpl: () => Promise.reject(new TypeError("fail")), getCsrfToken: () => null });
    await expect(api.get("/api/x", Item)).rejects.toBeInstanceOf(NetworkError);
  });

  it("returns nothing for 204 responses", async () => {
    const { api } = client(() => new Response(null, { status: 204 }));
    await expect(api.delete("/api/x/1")).resolves.toBeUndefined();
  });
});

describe("401 refresh", () => {
  it("refreshes once and retries the request once", async () => {
    let calls401 = 0;
    const { api, calls } = client((url) => {
      if (url.endsWith("/api/auth/refresh")) return json(200, { user: {} });
      if (calls401++ === 0) return json(401, { error: { code: "UNAUTHORIZED", message: "x" } });
      return json(200, { id: "a" });
    });
    expect(await api.get("/api/x", Item)).toEqual({ id: "a" });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/api/x", "/api/auth/refresh", "/api/x"]);
  });

  it("shares one refresh between concurrent 401s", async () => {
    const seen = new Set<string>();
    const { api, calls } = client((url) => {
      if (url.endsWith("/api/auth/refresh")) return json(200, { user: {} });
      if (!seen.has(url)) {
        seen.add(url);
        return json(401, { error: { code: "UNAUTHORIZED", message: "x" } });
      }
      return json(200, { id: "a" });
    });
    await Promise.all([api.get("/api/a", Item), api.get("/api/b", Item), api.get("/api/c", Item)]);
    expect(calls.filter((c) => c.url.endsWith("/api/auth/refresh"))).toHaveLength(1);
  });

  it("gives up after one retry and reports the expired session", async () => {
    const onSessionExpired = vi.fn();
    const { api, calls } = client(
      (url) => (url.endsWith("/api/auth/refresh") ? json(200, { user: {} }) : json(401, { error: { code: "UNAUTHORIZED", message: "x" } })),
      { onSessionExpired },
    );
    await expect(api.get("/api/x", Item)).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.url.endsWith("/api/x"))).toHaveLength(2);
    expect(onSessionExpired).toHaveBeenCalled();
  });

  it("does not loop when the refresh itself is rejected", async () => {
    const { api, calls } = client((url) => (url.endsWith("/api/auth/refresh") ? json(401, { error: { code: "UNAUTHORIZED", message: "x" } }) : json(401, { error: { code: "UNAUTHORIZED", message: "x" } })));
    await expect(api.get("/api/x", Item)).rejects.toMatchObject({ status: 401 });
    expect(calls.filter((c) => c.url.endsWith("/api/auth/refresh"))).toHaveLength(1);
  });

  it("never tries to refresh for a refresh or sign-in path", async () => {
    const { api, calls } = client(() => json(401, { error: { code: "UNAUTHORIZED", message: "x" } }));
    await expect(api.postEmpty("/api/auth/refresh")).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
  });
});

describe("429 handling", () => {
  const limited = (retry: string) => json(429, { error: { code: "TOO_MANY_REQUESTS", message: "slow" } }, { "Retry-After": retry });

  it("retries a GET once when the hint is short", async () => {
    let n = 0;
    const sleep = vi.fn(async () => undefined);
    const { api, calls } = client(() => (n++ === 0 ? limited("2") : json(200, { id: "a" })), { sleep });
    expect(await api.get("/api/x", Item)).toEqual({ id: "a" });
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(calls).toHaveLength(2);
  });

  it("surfaces a long hint instead of waiting", async () => {
    const { api, calls } = client(() => limited("60"));
    const error = await api.get("/api/x", Item).catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 429, retryAfterSeconds: 60 });
    expect(errorMessage(error)).toContain("60s");
    expect(calls).toHaveLength(1);
  });

  it("never auto-retries a mutation", async () => {
    const { api, calls } = client(() => limited("1"));
    await expect(api.post("/api/x", Item, {})).rejects.toMatchObject({ status: 429 });
    expect(calls).toHaveLength(1);
  });
});

describe("query retry policy", () => {
  const api429 = new ApiError({ status: 429, code: "TOO_MANY_REQUESTS", message: "x", retryAfterSeconds: 9 });
  it("retries transient failures only, and not forever", () => {
    expect(shouldRetry(0, new NetworkError())).toBe(true);
    expect(shouldRetry(0, api429)).toBe(true);
    expect(shouldRetry(0, new ApiError({ status: 503, code: "BAD_GATEWAY", message: "x" }))).toBe(true);
    expect(shouldRetry(0, new ApiError({ status: 404, code: "NOT_FOUND", message: "x" }))).toBe(false);
    expect(shouldRetry(0, new ResponseValidationError("/x", []))).toBe(false);
    expect(shouldRetry(2, new NetworkError())).toBe(false);
  });
  it("waits for the server hint on 429", () => {
    expect(retryDelayMs(0, api429)).toBe(9000);
    expect(retryDelayMs(1, new NetworkError())).toBe(2000);
  });
});
__P3_EOF__

write_file apps/web/src/lib/api/no-local-analysis-types.test.ts <<'__P3_EOF__'
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Analysis.tsx", () => {
  const source = readFileSync(resolve(__dirname, "../../components/DashBoard/Analysis.tsx"), "utf8");

  it("imports analysis types from the contracts package", () => {
    expect(source).toContain('from "@algoforge/contracts"');
  });

  it("declares none of the shared analysis types locally", () => {
    for (const name of ["ComplexityResult", "Breakdown", "Bottleneck", "Improvement", "Comparison", "AnalysisResult", "Analysis"]) {
      expect(source).not.toMatch(new RegExp(`export interface ${name}\\b`));
    }
    expect(source).not.toMatch(/export type Language\s*=\s*"python"/);
  });
});
__P3_EOF__

# =============================================================================
info "4/6 Install dependencies (lockfile updates are allowed)"
# =============================================================================
run_check() {
  local name="$1" required="$2"; shift 2
  local log="$WORK/check-$(printf '%s' "$name" | tr -c 'A-Za-z0-9' '_').log"
  if "$@" >"$log" 2>&1; then
    VALIDATION+=("PASS  $name")
  else
    if [[ "$required" == "required" ]]; then VALIDATION+=("FAIL  $name (required)"); REQUIRED_FAILED=1
    else VALIDATION+=("FAIL  $name (advisory)"); fi
    echo "---- $name: last 25 lines ----"; tail -n 25 "$log"; echo "------------------------------"
  fi
}

if command -v pnpm >/dev/null 2>&1; then
  run_check "pnpm install" required pnpm install --no-frozen-lockfile
else
  VALIDATION+=("FAIL  pnpm not found (required)"); REQUIRED_FAILED=1
fi

# =============================================================================
info "5/6 Validate"
# =============================================================================
if command -v pnpm >/dev/null 2>&1; then
  run_check "db generate"                 required pnpm --filter @algoforge/db generate
  run_check "contracts typecheck"         required pnpm --filter @algoforge/contracts typecheck
  run_check "contracts tests"             required pnpm --filter @algoforge/contracts test
  run_check "api typecheck"               required pnpm --filter api typecheck
  run_check "api tests (incl. response validation)" required pnpm --filter api test
  run_check "api lint"                    advisory pnpm --filter api lint
  run_check "api build (tsup bundle)"     required pnpm --filter api build
  run_check "web typecheck"               required pnpm --filter @algoforge/web typecheck
  run_check "web tests"                   required pnpm --filter @algoforge/web test
  run_check "web lint"                    advisory pnpm --filter @algoforge/web lint
fi

if [[ ${#WRITTEN_TS[@]} -gt 0 ]]; then
  if grep -nE ': any\b|as any\b|<any>|@ts-ignore|@ts-nocheck|@ts-expect-error' "${WRITTEN_TS[@]}" >"$WORK/banned.log" 2>&1; then
    VALIDATION+=("FAIL  banned TypeScript escapes found (required)"); REQUIRED_FAILED=1; cat "$WORK/banned.log"
  else
    VALIDATION+=("PASS  no any / @ts-ignore in files written by this script")
  fi
fi

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git -C "$ROOT" ls-files --error-unmatch -- '*.env' '.env' '.env.*' >/dev/null 2>&1; then
    VALIDATION+=("WARN  an environment file is tracked by git (not touched; remove it from tracking yourself)")
  else
    VALIDATION+=("PASS  no tracked environment files")
  fi
fi

# =============================================================================
info "6/6 Report"
# =============================================================================
echo
echo "================ PHASE 3 REPORT ================"
echo "Backups of modified files: $BACKUP_DIR"
echo
echo "Changed files (${#CHANGED[@]}):"
if [[ ${#CHANGED[@]} -gt 0 ]]; then printf '  %s\n' "${CHANGED[@]}"; else echo "  (none)"; fi
echo
echo "Already up to date (${#UNCHANGED[@]}):"
if [[ ${#UNCHANGED[@]} -gt 0 ]]; then printf '  %s\n' "${UNCHANGED[@]}"; else echo "  (none)"; fi
echo
echo "Validation:"
printf '  %s\n' "${VALIDATION[@]}"
echo
cat <<'__P3_EOF__'
Remaining issues (by design, outside Phase 3):
  - GET /api/auth/me still returns the public user shape (A-03). The contract already describes the
    full user ({ id, email, username, name, image, role }); Phase 4 fixes the endpoint and adds /me to the web client.
  - Contracts for visualizations, shares, capabilities and device sessions exist, but no endpoint serves them yet
    (Phases 4, 6 and 9). They are in the OpenAPI components, not in its paths.
  - /api/algorithms/*/visualize and the algorithm create/update bodies still use the legacy forge payload
    (opaque in the contract); Phase 6 replaces it with a script.
  - GET /api/analysis/:id still omits `code` (A-05, Phase 7). Explain-session cursor ordering (A-06) is Phase 8.
  - Rows written before this phase store a bare result (schema version 0); they are read through the
    legacy path. New rows are stored as { schemaVersion: 1, data }.
  - The new API client and query hooks are not wired into screens yet; AuthProvider arrives in Phase 4 and
    the history/analysis screens in Phase 7.
  - The OpenAPI document is served at /openapi.json outside production only.
__P3_EOF__
echo "================================================"

if [[ "$REQUIRED_FAILED" -ne 0 ]]; then
  echo "Phase 3 finished with FAILED required checks. Review the output above; originals are in $BACKUP_DIR." >&2
  exit 2
fi
echo "Phase 3 completed successfully."