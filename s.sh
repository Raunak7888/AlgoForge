#!/usr/bin/env bash
# =============================================================================
# AlgoForge Phase 5: Data Model Evolution and Migrations
# Run from the repository root:  bash phase5.sh
# Scope: audit items D-01..D-11 and B-06 only. Nothing from Phase 6+ is built.
# =============================================================================
set -Eeuo pipefail

trap 'rc=$?; echo "ERROR: phase5.sh failed (exit ${rc}) at line ${LINENO}: ${BASH_COMMAND}" >&2' ERR

TS_RUN="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR=".phase5-backup/${TS_RUN}"
MIG_DIR="packages/db/prisma/migrations"
MIG_SUFFIX="_phase5_data_model"
WORK="$(mktemp -d)"
CONTAINER=""
declare -a CREATED=() MODIFIED=() UNCHANGED=() PASSED=() SKIPPED=()

log()  { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die()  { printf 'FATAL: %s\n' "$*" >&2; exit 1; }

cleanup() {
  if [[ -n "${CONTAINER}" ]]; then docker rm -f "${CONTAINER}" >/dev/null 2>&1 || true; fi
  rm -rf "${WORK}"
}
trap cleanup EXIT

# ---------------------------------------------------------------- file helpers
backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  mkdir -p "${BACKUP_DIR}/$(dirname "$f")"
  [[ -f "${BACKUP_DIR}/$f" ]] || cp "$f" "${BACKUP_DIR}/$f"
}

# write_file <path>  (content on stdin). Idempotent: identical content is left alone.
write_file() {
  local path="$1" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [[ -f "$path" ]]; then
    if cmp -s "$tmp" "$path"; then UNCHANGED+=("$path"); rm -f "$tmp"; return 0; fi
    backup_file "$path"
    cat "$tmp" >"$path"
    MODIFIED+=("$path")
  else
    mkdir -p "$(dirname "$path")"
    cat "$tmp" >"$path"
    CREATED+=("$path")
  fi
  rm -f "$tmp"
}

# patch_file <path> <marker> <old> <new>
# Replaces <old> (must occur exactly once) with <new>. Skips when <marker> is already present.
cat >"${WORK}/patch.mjs" <<'P5EOF'
import fs from "node:fs";
import path from "node:path";
const [file, backupDir] = process.argv.slice(2);
const { PATCH_MARK: mark, PATCH_OLD: oldStr, PATCH_NEW: newStr } = process.env;
const src = fs.readFileSync(file, "utf8");
if (src.includes(mark)) process.exit(10);
const first = src.indexOf(oldStr);
if (first === -1 || src.indexOf(oldStr, first + 1) !== -1) {
  console.error(`anchor not found exactly once in ${file}`);
  process.exit(3);
}
fs.mkdirSync(path.join(backupDir, path.dirname(file)), { recursive: true });
const bak = path.join(backupDir, file);
if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
fs.writeFileSync(file, src.slice(0, first) + newStr + src.slice(first + oldStr.length));
P5EOF

patch_file() {
  local file="$1" mark="$2" old="$3" new="$4" rc=0
  [[ -f "$file" ]] || die "Cannot patch missing file: $file"
  PATCH_MARK="$mark" PATCH_OLD="$old" PATCH_NEW="$new" node "${WORK}/patch.mjs" "$file" "${BACKUP_DIR}" || rc=$?
  case "$rc" in
    0)  MODIFIED+=("$file (patched: ${mark})") ;;
    10) UNCHANGED+=("$file (already patched: ${mark})") ;;
    *)  die "Could not patch $file (the expected code anchor was not found exactly once; has the file changed since Phase 4?)" ;;
  esac
}

run_check() {
  local label="$1"; shift
  log "CHECK: ${label}"
  "$@" || die "Check failed: ${label}"
  PASSED+=("${label}")
}

# ------------------------------------------------------------------- preflight
log "Preflight"
[[ -f package.json && -f packages/db/prisma/schema.prisma && -d apps/api/src && -d packages/contracts ]] \
  || die "Run this script from the AlgoForge repository root."
grep -q '"name": "algoforge"' package.json || die "package.json is not the AlgoForge root."
for t in node pnpm; do command -v "$t" >/dev/null 2>&1 || die "Required tool missing: $t"; done
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)' || die "Node >= 20 is required."
[[ -f apps/api/src/serializers/auth.ts && -f apps/api/src/services/session-cleanup.service.ts && -f apps/web/src/lib/auth/AuthProvider.tsx ]] \
  || die "Phase 4 artifacts not found. Complete Phases 1-4 first."
[[ -d "${MIG_DIR}" ]] && compgen -G "${MIG_DIR}/*/migration.sql" >/dev/null \
  || die "No existing migrations in ${MIG_DIR}. Phase 5 needs the baseline migration (Phase 1) to build on. Nothing was changed."
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  tracked="$(git ls-files | grep -E '(^|/)\.env(\.|$)' | grep -v '\.example$' || true)"
  [[ -z "${tracked}" ]] || warn "Tracked environment files detected (this script does not read or change them): ${tracked//$'\n'/, }"
fi
[[ -d node_modules ]] || { log "node_modules missing: running pnpm install"; pnpm install; }

mig_checksum() {
  node -e '
const fs=require("fs"),p=require("path"),c=require("crypto");
const out=[];
(function walk(d){
  for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const f=p.join(d,e.name);
    if(e.isDirectory()){ if(!e.name.endsWith("'"${MIG_SUFFIX}"'")) walk(f); }
    else out.push(f+" "+c.createHash("sha256").update(fs.readFileSync(f)).digest("hex"));
  }
})(process.argv[1]);
console.log(out.join("\n"));' "${MIG_DIR}"
}
mig_checksum >"${WORK}/mig.before"

# =============================================================================
# 1. PRISMA SCHEMA
# =============================================================================
log "Writing Prisma schema"
write_file packages/db/prisma/schema.prisma <<'P5EOF'
// filename: packages/db/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum Difficulty {
  beginner
  intermediate
  advanced
}

enum ShareType {
  analysis
  explain
  visualization
}

enum AiFeature {
  analysis
  explain
  session
}

enum ExplanationContextType {
  none
  algorithm
  visualization
}

enum ExplanationMessageRole {
  user
  assistant
}

model User {
  id          String    @id @default(cuid())
  email       String?   @unique
  username    String?   @unique
  name        String?
  image       String?
  role        Role      @default(USER)
  lastLoginAt DateTime? @map("last_login_at")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")

  accounts            Account[]
  sessions            Session[]
  analyses            Analysis[]
  explanationSessions ExplanationSession[]
  visualizations      Visualization[]
  shares              Share[]
  aiUsage             AiUsage[]
  auditLogs           AuditLog[]
  createdAlgorithms   Algorithm[]

  @@index([email])
  @@index([username])
  @@map("users")
}

model Account {
  id                String @id @default(cuid())
  userId            String @map("user_id")
  provider          String
  providerAccountId String @map("provider_account_id")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
  @@map("accounts")
}

model Session {
  id            String    @id @default(cuid())
  userId        String    @map("user_id")
  tokenHash     String    @unique @map("token_hash")
  expiresAt     DateTime  @map("expires_at")
  revokedAt     DateTime? @map("revoked_at")
  lastUsedAt    DateTime  @map("last_used_at")
  ipAddress     String?   @map("ip_address")
  userAgent     String?   @map("user_agent")
  rotatedFromId String?   @map("rotated_from_id")
  createdAt     DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
  @@index([rotatedFromId])
  @@index([expiresAt])
  @@map("sessions")
}

model Analysis {
  id            String   @id @default(cuid())
  userId        String   @map("user_id")
  code          String
  language      String
  complexity    String?
  suggestion    String?
  result        Json
  // Legacy sharing columns: kept until Phase 9 moves every consumer to Share.
  shareId       String?  @unique @map("share_id")
  isPublic      Boolean  @default(false) @map("is_public")
  // Phase 5 additions
  title         String?
  model         String?
  promptVersion String?  @map("prompt_version")
  schemaVersion Int      @default(1) @map("schema_version")
  codeHash      String?  @map("code_hash")
  latencyMs     Int?     @map("latency_ms")
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @default(now()) @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([userId, language, createdAt])
  @@index([shareId])
  @@map("analyses")
}

model ExplanationSession {
  id          String                 @id @default(cuid())
  userId      String                 @map("user_id")
  title       String? // Auto-set from first message if not provided
  // Legacy columns: kept until Phase 8 (messages) and Phase 9 (sharing) switch to the new tables.
  shareId     String?                @unique @map("share_id")
  isPublic    Boolean                @default(false) @map("is_public")
  messages    Json                   @default("[]") // Array of SessionMessage objects
  // Phase 5 additions
  contextType ExplanationContextType @default(none) @map("context_type")
  contextId   String?                @map("context_id")
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")

  user        User                 @relation(fields: [userId], references: [id], onDelete: Cascade)
  messageRows ExplanationMessage[]

  @@index([userId, createdAt])
  @@index([userId, updatedAt])
  @@index([shareId])
  @@map("explanation_sessions")
}

model ExplanationMessage {
  id        String                 @id @default(cuid())
  sessionId String                 @map("session_id")
  seq       Int
  role      ExplanationMessageRole
  content   String
  intent    String?
  createdAt DateTime               @default(now()) @map("created_at")

  session ExplanationSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@unique([sessionId, seq])
  @@map("explanation_messages")
}

model Visualization {
  id           String   @id @default(cuid())
  userId       String   @map("user_id")
  title        String
  description  String?
  script       String
  code         String?
  language     String?
  structures   Json     @default("[]")
  stepCount    Int      @default(0) @map("step_count")
  schemaVersion Int     @default(1) @map("schema_version")
  forkedFromId String?  @map("forked_from_id")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @default(now()) @updatedAt @map("updated_at")

  user       User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  forkedFrom Visualization?  @relation("VisualizationFork", fields: [forkedFromId], references: [id], onDelete: SetNull)
  forks      Visualization[] @relation("VisualizationFork")

  @@index([userId, updatedAt])
  @@index([forkedFromId])
  @@map("visualizations")
}

// One row per shareable object. targetId is polymorphic (no FK): the repository verifies
// that the owner owns the target before creating a share.
model Share {
  id        String    @id @default(cuid())
  shareId   String    @unique @map("share_id")
  type      ShareType
  targetId  String    @map("target_id")
  ownerId   String    @map("owner_id")
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")
  expiresAt DateTime? @map("expires_at")
  viewCount Int       @default(0) @map("view_count")

  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@unique([type, targetId])
  @@index([targetId])
  @@index([ownerId])
  @@map("shares")
}

model AiUsage {
  id        String    @id @default(cuid())
  userId    String    @map("user_id")
  feature   AiFeature
  day       DateTime  @db.Date
  requests  Int       @default(0)
  tokensIn  Int       @default(0) @map("tokens_in")
  tokensOut Int       @default(0) @map("tokens_out")
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @default(now()) @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, feature, day])
  @@index([day])
  @@map("ai_usage")
}

model AuditLog {
  id         String   @id @default(cuid())
  actorId    String?  @map("actor_id")
  action     String
  targetType String?  @map("target_type")
  targetId   String?  @map("target_id")
  meta       Json     @default("{}")
  createdAt  DateTime @default(now()) @map("created_at")

  actor User? @relation(fields: [actorId], references: [id], onDelete: SetNull)

  @@index([actorId, createdAt])
  @@index([targetType, targetId])
  @@index([createdAt])
  @@map("audit_logs")
}

model Category {
  id          String   @id
  // Documented slug. Equal to id today; lets ids change later without breaking URLs.
  slug        String   @unique
  label       String
  description String?
  iconName    String?  @map("icon_name")
  sortOrder   Int      @default(0) @map("sort_order")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  algorithms Algorithm[]

  @@index([sortOrder])
  @@map("categories")
}

model Algorithm {
  id              String     @id @default(uuid())
  slug            String     @unique
  name            String
  description     String
  categoryId      String     @map("category_id")
  difficulty      Difficulty @default(beginner)
  isPublished     Boolean    @default(false) @map("is_published")
  timeBest        String?    @map("time_best")
  timeAverage     String?    @map("time_average")
  timeWorst       String?    @map("time_worst")
  spaceComplexity String?    @map("space_complexity")
  // Phase 5 additions (script replaces forge in Phase 6; forge stays until then)
  script          String?
  scriptVersion   Int        @default(1) @map("script_version")
  sortOrder       Int        @default(0) @map("sort_order")
  publishedAt     DateTime?  @map("published_at")
  createdById     String?    @map("created_by_id")
  createdAt       DateTime   @default(now()) @map("created_at")
  updatedAt       DateTime   @updatedAt @map("updated_at")

  category     Category       @relation(fields: [categoryId], references: [id])
  createdBy    User?          @relation(fields: [createdById], references: [id], onDelete: SetNull)
  displayCodes DisplayCode[]
  forge        ForgeConfig?
  tags         AlgorithmTag[]

  @@index([categoryId])
  @@index([slug])
  @@index([difficulty])
  @@index([isPublished])
  @@index([isPublished, sortOrder])
  @@index([createdById])
  @@index([name(ops: raw("gin_trgm_ops"))], type: Gin, map: "algorithms_name_trgm_idx")
  @@index([description(ops: raw("gin_trgm_ops"))], type: Gin, map: "algorithms_description_trgm_idx")
  @@map("algorithms")
}

model DisplayCode {
  id          String @id @default(uuid())
  algorithmId String @map("algorithm_id")
  language    String
  code        String

  algorithm Algorithm @relation(fields: [algorithmId], references: [id], onDelete: Cascade)

  @@unique([algorithmId, language])
  @@index([algorithmId])
  @@map("display_codes")
}

model ForgeConfig {
  id          String @id @default(uuid())
  algorithmId String @unique @map("algorithm_id")
  forgeCode   Json   @map("forge_code")
  inputSchema Json   @map("input_schema")
  guardRanges Json   @map("guard_ranges")
  version     Int    @default(1)

  algorithm Algorithm @relation(fields: [algorithmId], references: [id], onDelete: Cascade)

  @@map("forge_configs")
}

model Tag {
  id         String         @id @default(uuid())
  label      String         @unique
  algorithms AlgorithmTag[]

  @@map("tags")
}

model AlgorithmTag {
  algorithmId String @map("algorithm_id")
  tagId       String @map("tag_id")

  algorithm Algorithm @relation(fields: [algorithmId], references: [id], onDelete: Cascade)
  tag       Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([algorithmId, tagId])
  @@map("algorithm_tags")
}
P5EOF

# =============================================================================
# 2. MIGRATION (additive) + RERUNNABLE BACKFILL
# =============================================================================
log "Preparing migration SQL"

cat >"${WORK}/backfill.sql" <<'P5EOF'
-- Phase 5 rerunnable backfill. Safe to run any number of times:
--   * only fills NULLs,
--   * inserts use ON CONFLICT DO NOTHING,
--   * messages are copied only for sessions that have no rows in explanation_messages yet.
-- Nothing here deletes or rewrites existing data.
DO $phase5$
BEGIN
  UPDATE "analyses"
     SET "code_hash" = encode(sha256(convert_to("code", 'UTF8')), 'hex')
   WHERE "code_hash" IS NULL;

  UPDATE "algorithms"
     SET "published_at" = "created_at"
   WHERE "is_published" = true AND "published_at" IS NULL;

  INSERT INTO "shares" ("id", "share_id", "type", "target_id", "owner_id", "created_at", "revoked_at")
  SELECT md5('share:analysis:' || a."id"), a."share_id", 'analysis'::"ShareType", a."id", a."user_id", a."created_at",
         CASE WHEN a."is_public" THEN NULL ELSE CURRENT_TIMESTAMP END
    FROM "analyses" a
   WHERE a."share_id" IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO "shares" ("id", "share_id", "type", "target_id", "owner_id", "created_at", "revoked_at")
  SELECT md5('share:explain:' || s."id"), s."share_id", 'explain'::"ShareType", s."id", s."user_id", s."created_at",
         CASE WHEN s."is_public" THEN NULL ELSE CURRENT_TIMESTAMP END
    FROM "explanation_sessions" s
   WHERE s."share_id" IS NOT NULL
  ON CONFLICT DO NOTHING;

  INSERT INTO "explanation_messages"
  ("id", "session_id", "seq", "role", "content", "intent", "created_at")

  SELECT
      md5(s."id" || ':' || m.seq::text),
      s."id",
      m.seq,
      (m.elem ->> 'role')::"ExplanationMessageRole",
      COALESCE(m.elem ->> 'content', ''),
      m.elem ->> 'intent',

      CASE
        WHEN (m.elem ->> 'createdAt') ~
          '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'
        THEN ((m.elem ->> 'createdAt')::timestamptz AT TIME ZONE 'UTC')
        ELSE s."created_at"
      END

  FROM "explanation_sessions" s

  CROSS JOIN LATERAL (
      SELECT
          valid.elem,
          ROW_NUMBER() OVER (ORDER BY valid.ord)::integer AS seq

      FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(s."messages") = 'array'
            THEN s."messages"
            ELSE '[]'::jsonb
          END
      ) WITH ORDINALITY AS valid(elem, ord)

      WHERE jsonb_typeof(valid.elem) = 'object'
        AND (valid.elem ->> 'role') IN ('user', 'assistant')

  ) AS m

  WHERE NOT EXISTS (
      SELECT 1
      FROM "explanation_messages" x
      WHERE x."session_id" = s."id"
  )

  ON CONFLICT DO NOTHING;
END
$phase5$;
P5EOF

cat >"${WORK}/ddl.sql" <<'P5EOF'
-- Phase 5: data model evolution.
-- ADDITIVE ONLY. Nothing is dropped, truncated or rewritten destructively.
-- Rollback notes: docs/phase5-data-model.md

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Enums ----------------------------------------------------------------------
CREATE TYPE "ShareType" AS ENUM ('analysis', 'explain', 'visualization');
CREATE TYPE "AiFeature" AS ENUM ('analysis', 'explain', 'session');
CREATE TYPE "ExplanationContextType" AS ENUM ('none', 'algorithm', 'visualization');
CREATE TYPE "ExplanationMessageRole" AS ENUM ('user', 'assistant');

-- Phase 4 schema items, guarded so this migration is correct whether or not
-- Phase 4 shipped its own migration for them (D-08).
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMP(3);
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "sessions_rotated_from_id_idx" ON "sessions"("rotated_from_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");

-- sessions.token_hash becomes unique (D-08). Refuse safely, before any change, if duplicates exist.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM "sessions" GROUP BY "token_hash" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Phase 5: duplicate sessions.token_hash values exist. Resolve them, then re-apply this migration.';
  END IF;
END
$guard$;
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- analyses (D-03) ------------------------------------------------------------
ALTER TABLE "analyses"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "model" TEXT,
  ADD COLUMN "prompt_version" TEXT,
  ADD COLUMN "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "code_hash" TEXT,
  ADD COLUMN "latency_ms" INTEGER;
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_latency_ms_check" CHECK ("latency_ms" IS NULL OR "latency_ms" >= 0);
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_schema_version_check" CHECK ("schema_version" >= 0);
CREATE INDEX "analyses_user_id_language_created_at_idx" ON "analyses"("user_id", "language", "created_at");

-- explanation_sessions (D-04) ------------------------------------------------
ALTER TABLE "explanation_sessions"
  ADD COLUMN "context_type" "ExplanationContextType" NOT NULL DEFAULT 'none',
  ADD COLUMN "context_id" TEXT;
CREATE INDEX "explanation_sessions_user_id_updated_at_idx" ON "explanation_sessions"("user_id", "updated_at");

-- categories (D-11) ----------------------------------------------------------
ALTER TABLE "categories" ADD COLUMN "slug" TEXT;
UPDATE "categories" SET "slug" = "id" WHERE "slug" IS NULL;
ALTER TABLE "categories" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- algorithms (D-02, D-08, D-10) ----------------------------------------------
ALTER TABLE "algorithms"
  ADD COLUMN "script" TEXT,
  ADD COLUMN "script_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "algorithms" ADD CONSTRAINT "algorithms_script_version_check" CHECK ("script_version" >= 1);
ALTER TABLE "algorithms"
  ADD CONSTRAINT "algorithms_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "algorithms_is_published_sort_order_idx" ON "algorithms"("is_published", "sort_order");
CREATE INDEX "algorithms_created_by_id_idx" ON "algorithms"("created_by_id");
CREATE INDEX "algorithms_name_trgm_idx" ON "algorithms" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "algorithms_description_trgm_idx" ON "algorithms" USING GIN ("description" gin_trgm_ops);

-- visualizations (D-01) ------------------------------------------------------
CREATE TABLE "visualizations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "script" TEXT NOT NULL,
  "code" TEXT,
  "language" TEXT,
  "structures" JSONB NOT NULL DEFAULT '[]',
  "step_count" INTEGER NOT NULL DEFAULT 0,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "forked_from_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "visualizations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "visualizations_step_count_check" CHECK ("step_count" >= 0),
  CONSTRAINT "visualizations_schema_version_check" CHECK ("schema_version" >= 1)
);
CREATE INDEX "visualizations_user_id_updated_at_idx" ON "visualizations"("user_id", "updated_at");
CREATE INDEX "visualizations_forked_from_id_idx" ON "visualizations"("forked_from_id");
ALTER TABLE "visualizations" ADD CONSTRAINT "visualizations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "visualizations" ADD CONSTRAINT "visualizations_forked_from_id_fkey"
  FOREIGN KEY ("forked_from_id") REFERENCES "visualizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- shares (D-05) --------------------------------------------------------------
CREATE TABLE "shares" (
  "id" TEXT NOT NULL,
  "share_id" TEXT NOT NULL,
  "type" "ShareType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "owner_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revoked_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "view_count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "shares_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shares_view_count_check" CHECK ("view_count" >= 0),
  CONSTRAINT "shares_expiry_check" CHECK ("expires_at" IS NULL OR "expires_at" > "created_at")
);
CREATE UNIQUE INDEX "shares_share_id_key" ON "shares"("share_id");
CREATE UNIQUE INDEX "shares_type_target_id_key" ON "shares"("type", "target_id");
CREATE INDEX "shares_target_id_idx" ON "shares"("target_id");
CREATE INDEX "shares_owner_id_idx" ON "shares"("owner_id");
ALTER TABLE "shares" ADD CONSTRAINT "shares_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- explanation_messages (D-04) ------------------------------------------------
CREATE TABLE "explanation_messages" (
  "id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "seq" INTEGER NOT NULL,
  "role" "ExplanationMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "intent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "explanation_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "explanation_messages_seq_check" CHECK ("seq" >= 1)
);
CREATE UNIQUE INDEX "explanation_messages_session_id_seq_key" ON "explanation_messages"("session_id", "seq");
ALTER TABLE "explanation_messages" ADD CONSTRAINT "explanation_messages_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "explanation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ai_usage (D-06) ------------------------------------------------------------
CREATE TABLE "ai_usage" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "feature" "AiFeature" NOT NULL,
  "day" DATE NOT NULL,
  "requests" INTEGER NOT NULL DEFAULT 0,
  "tokens_in" INTEGER NOT NULL DEFAULT 0,
  "tokens_out" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_counts_check" CHECK ("requests" >= 0 AND "tokens_in" >= 0 AND "tokens_out" >= 0)
);
CREATE UNIQUE INDEX "ai_usage_user_id_feature_day_key" ON "ai_usage"("user_id", "feature", "day");
CREATE INDEX "ai_usage_day_idx" ON "ai_usage"("day");
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- audit_logs (D-07): rows outlive their actor (actor_id is set to NULL) ----------
CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "target_type" TEXT,
  "target_id" TEXT,
  "meta" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One-time column backfills (run once, inside this migration only) --------------
-- Existing rows keep their original timestamps: updated_at starts equal to created_at.
UPDATE "analyses" SET "updated_at" = "created_at";
-- Wrapped results ({ schemaVersion, data }) keep their version; bare legacy results are version 0.
UPDATE "analyses"
   SET "schema_version" = CASE WHEN ("result" ->> 'schemaVersion') ~ '^[0-9]{1,9}$'
                               THEN ("result" ->> 'schemaVersion')::integer
                               ELSE 0 END;

-- Rerunnable backfill (same text as packages/db/prisma/backfills/phase5_backfill.sql) -
P5EOF

{ cat "${WORK}/ddl.sql"; echo; cat "${WORK}/backfill.sql"; } >"${WORK}/migration.sql"

write_file packages/db/prisma/backfills/phase5_backfill.sql <"${WORK}/backfill.sql"

log "Creating migration directory (existing migrations are never modified)"
existing_mig="$(find "${MIG_DIR}" -maxdepth 1 -type d -name "*${MIG_SUFFIX}" 2>/dev/null | head -n 1 || true)"
if [[ -n "${existing_mig}" ]]; then
  cmp -s "${WORK}/migration.sql" "${existing_mig}/migration.sql" \
    || die "${existing_mig}/migration.sql already exists but differs from this script's version. Refusing to rewrite an existing migration (it may already be applied). Create a new follow-up migration instead."
  UNCHANGED+=("${existing_mig}/migration.sql")
  MIG_NAME="$(basename "${existing_mig}")"
else
  latest="$(ls -1 "${MIG_DIR}" | grep -E '^[0-9]+_' | sort | tail -n 1 || true)"
  ts="$(date -u +%Y%m%d%H%M%S)"
  if [[ -n "${latest}" && "${latest}" > "${ts}${MIG_SUFFIX}" ]]; then
    lp="${latest%%_*}"
    if [[ "${#lp}" -eq 14 ]]; then ts="$((10#${lp} + 1))"
    else die "Latest migration '${latest}' sorts after the new Phase 5 migration; cannot order it safely."; fi
  fi
  MIG_NAME="${ts}${MIG_SUFFIX}"
  mkdir -p "${MIG_DIR}/${MIG_NAME}"
  cat "${WORK}/migration.sql" >"${MIG_DIR}/${MIG_NAME}/migration.sql"
  CREATED+=("${MIG_DIR}/${MIG_NAME}/migration.sql")
fi

# =============================================================================
# 3. DB HELPER SCRIPTS (backfill runner, verifier), SEED
# =============================================================================
log "Writing db helper scripts"
write_file packages/db/prisma/run-backfill.ts <<'P5EOF'
/* Re-runs the Phase 5 backfill. Idempotent. Usage: pnpm db:backfill:phase5
   Run it again right before the Phase 8 / Phase 9 cutovers to pick up rows written since the migration. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../src/index";

async function main(): Promise<void> {
  const file = path.resolve(__dirname, "backfills/phase5_backfill.sql");
  await prisma.$executeRawUnsafe(readFileSync(file, "utf8"));
  console.log("Phase 5 backfill finished (safe to run again).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
P5EOF

write_file packages/db/prisma/verify-phase5.ts <<'P5EOF'
/* Verifies Phase 5 data invariants. Exit code 1 when any check finds violations.
   Usage: pnpm db:verify:phase5 */
import { prisma } from "../src/index";

const checks: { name: string; sql: string }[] = [
  {
    name: "analyses with a legacy share_id but no shares row",
    sql: `SELECT count(*)::int AS n FROM analyses a WHERE a.share_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shares s WHERE s.type = 'analysis' AND s.target_id = a.id)`,
  },
  {
    name: "explanation sessions with a legacy share_id but no shares row",
    sql: `SELECT count(*)::int AS n FROM explanation_sessions e WHERE e.share_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM shares s WHERE s.type = 'explain' AND s.target_id = e.id)`,
  },
  {
    name: "shares whose share_id differs from the legacy column",
    sql: `SELECT count(*)::int AS n FROM shares s WHERE (s.type = 'analysis' AND EXISTS (SELECT 1 FROM analyses a WHERE a.id = s.target_id AND a.share_id IS NOT NULL AND a.share_id <> s.share_id)) OR (s.type = 'explain' AND EXISTS (SELECT 1 FROM explanation_sessions e WHERE e.id = s.target_id AND e.share_id IS NOT NULL AND e.share_id <> s.share_id))`,
  },
  {
    name: "shares pointing at a missing target (orphans)",
    sql: `SELECT count(*)::int AS n FROM shares s WHERE (s.type = 'analysis' AND NOT EXISTS (SELECT 1 FROM analyses a WHERE a.id = s.target_id)) OR (s.type = 'explain' AND NOT EXISTS (SELECT 1 FROM explanation_sessions e WHERE e.id = s.target_id)) OR (s.type = 'visualization' AND NOT EXISTS (SELECT 1 FROM visualizations v WHERE v.id = s.target_id))`,
  },
  {
    name: "sessions whose valid JSON messages differ in number from explanation_messages rows",
    sql: `SELECT count(*)::int AS n FROM explanation_sessions s WHERE (SELECT count(*) FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.messages) = 'array' THEN s.messages ELSE '[]'::jsonb END) e WHERE jsonb_typeof(e) = 'object' AND (e ->> 'role') IN ('user', 'assistant')) <> (SELECT count(*) FROM explanation_messages m WHERE m.session_id = s.id)`,
  },
  {
    name: "sessions whose message seq numbers are not 1..n without gaps",
    sql: `SELECT count(*)::int AS n FROM (SELECT session_id FROM explanation_messages GROUP BY session_id HAVING MIN(seq) <> 1 OR MAX(seq) <> COUNT(*)) t`,
  },
  {
    name: "analyses without code_hash",
    sql: `SELECT count(*)::int AS n FROM analyses WHERE code_hash IS NULL`,
  },
  {
    name: "published algorithms without published_at",
    sql: `SELECT count(*)::int AS n FROM algorithms WHERE is_published AND published_at IS NULL`,
  },
  {
    name: "categories whose slug is empty",
    sql: `SELECT count(*)::int AS n FROM categories WHERE slug = ''`,
  },
];

async function main(): Promise<void> {
  let failed = 0;
  for (const c of checks) {
    const rows = await prisma.$queryRawUnsafe<{ n: number }[]>(c.sql);
    const n = Number(rows[0]?.n ?? 0);
    console.log(`${n === 0 ? "ok  " : "FAIL"}  ${c.name}${n === 0 ? "" : ` (${n})`}`);
    if (n !== 0) failed++;
  }
  if (failed > 0) {
    console.error(`${failed} Phase 5 check(s) failed.`);
    process.exitCode = 1;
  } else {
    console.log("All Phase 5 data checks passed.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
P5EOF

write_file packages/db/prisma/seed.ts <<'P5EOF'
/* Development seed. Idempotent (upserts with fixed ids). Refuses to run in production.
   Creates: 3 categories, 6 published algorithms (3 with visualizer scripts), 2 demo users,
   2 analyses, 2 chat sessions with 6 messages, 2 visualizations (one a fork),
   3 shares, 2 AI usage rows and 2 audit-log rows. Demo emails use the reserved .invalid TLD.
   Sessions/accounts are intentionally not seeded (they hold auth tokens). */
import { createHash } from "node:crypto";
import { prisma, Difficulty, Role, Prisma } from "../src/index";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production.");
  process.exit(1);
}

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const messageRowId = (sessionId: string, seq: number) => createHash("md5").update(`${sessionId}:${seq}`).digest("hex");
const utcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const json = (v: unknown) => v as Prisma.InputJsonValue;

const categories = [
  { id: "sorting", label: "Sorting", description: "Put items in order.", iconName: "sort", sortOrder: 1 },
  { id: "searching", label: "Searching", description: "Find items in a collection.", iconName: "search", sortOrder: 2 },
  { id: "graph-traversal", label: "Graph traversal", description: "Visit the vertices of a graph.", iconName: "graph", sortOrder: 3 },
];

const bubbleJs = `function bubbleSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return a;
}`;
const bubblePy = `def bubble_sort(arr):
    a = list(arr)
    for i in range(len(a) - 1):
        swapped = False
        for j in range(len(a) - 1 - i):
            if a[j] > a[j + 1]:
                a[j], a[j + 1] = a[j + 1], a[j]
                swapped = True
        if not swapped:
            break
    return a`;

const mergeJs = `function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0, j = 0;
  while (i < left.length && j < right.length) {
    out.push(left[i] <= right[j] ? left[i++] : right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}`;
const mergePy = `def merge_sort(arr):
    if len(arr) <= 1:
        return list(arr)
    mid = len(arr) // 2
    left, right = merge_sort(arr[:mid]), merge_sort(arr[mid:])
    out, i, j = [], 0, 0
    while i < len(left) and j < len(right):
        if left[i] <= right[j]:
            out.append(left[i]); i += 1
        else:
            out.append(right[j]); j += 1
    return out + left[i:] + right[j:]`;

const linearJs = `function linearSearch(arr, target) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] === target) return i;
  }
  return -1;
}`;
const linearPy = `def linear_search(arr, target):
    for i, value in enumerate(arr):
        if value == target:
            return i
    return -1`;

const binaryJs = `function binarySearch(arr, target) {
  let lo = 0, hi = arr.length - 1;
  while (lo <= hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`;
const binaryPy = `def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = lo + (hi - lo) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1`;

const bfsJs = `function bfs(graph, start) {
  const seen = new Set([start]);
  const queue = [start];
  const order = [];
  while (queue.length) {
    const node = queue.shift();
    order.push(node);
    for (const next of graph[node] ?? []) {
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  return order;
}`;
const bfsPy = `from collections import deque

def bfs(graph, start):
    seen, queue, order = {start}, deque([start]), []
    while queue:
        node = queue.popleft()
        order.append(node)
        for nxt in graph.get(node, []):
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return order`;

const dfsJs = `function dfs(graph, start, seen = new Set()) {
  seen.add(start);
  const order = [start];
  for (const next of graph[start] ?? []) {
    if (!seen.has(next)) order.push(...dfs(graph, next, seen));
  }
  return order;
}`;
const dfsPy = `def dfs(graph, start, seen=None):
    seen = seen if seen is not None else set()
    seen.add(start)
    order = [start]
    for nxt in graph.get(start, []):
        if nxt not in seen:
            order.extend(dfs(graph, nxt, seen))
    return order`;

// Visualizer scripts in the frontend's JSON script format (see Phase 6 for the shared compiler).
const scripts: Record<string, string> = {
  "bubble-sort": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
      { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
      { step: 2, message: "5 > 3, so the two are swapped." },
      { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
      { step: 3, message: "8 > 1, so they are swapped." },
    ],
    null,
    2,
  ),
  "linear-search": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [4, 8, 15, 16] },
      { step: 2, id: "A", op: "highlight", index: 0, color: "#FF430F" },
      { step: 2, message: "Check index 0: 4 is not 15." },
      { step: 3, id: "A", op: "highlight", index: 2, color: "#17A34A" },
      { step: 3, message: "Index 2 holds 15: found." },
    ],
    null,
    2,
  ),
  "binary-search": JSON.stringify(
    [
      { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 3, 5, 7, 9, 11] },
      { step: 2, id: "A", op: "highlight", index: 2, color: "#FF430F" },
      { step: 2, message: "mid = 2 holds 5, which is smaller than 9: search the right half." },
      { step: 3, id: "A", op: "highlight", index: 4, color: "#17A34A" },
      { step: 3, message: "mid = 4 holds 9: found." },
    ],
    null,
    2,
  ),
};

const algorithms = [
  { slug: "bubble-sort", name: "Bubble Sort", categoryId: "sorting", difficulty: Difficulty.beginner,
    description: "Repeatedly swaps adjacent elements that are out of order until the array is sorted.",
    timeBest: "O(n)", timeAverage: "O(n^2)", timeWorst: "O(n^2)", spaceComplexity: "O(1)",
    tags: ["sorting", "comparison", "in-place"], js: bubbleJs, py: bubblePy },
  { slug: "merge-sort", name: "Merge Sort", categoryId: "sorting", difficulty: Difficulty.intermediate,
    description: "Splits the array in halves, sorts each half recursively and merges them.",
    timeBest: "O(n log n)", timeAverage: "O(n log n)", timeWorst: "O(n log n)", spaceComplexity: "O(n)",
    tags: ["sorting", "divide-and-conquer", "stable"], js: mergeJs, py: mergePy },
  { slug: "linear-search", name: "Linear Search", categoryId: "searching", difficulty: Difficulty.beginner,
    description: "Checks every element in order until the target is found.",
    timeBest: "O(1)", timeAverage: "O(n)", timeWorst: "O(n)", spaceComplexity: "O(1)",
    tags: ["searching", "sequential"], js: linearJs, py: linearPy },
  { slug: "binary-search", name: "Binary Search", categoryId: "searching", difficulty: Difficulty.beginner,
    description: "Halves a sorted array on every step to locate the target.",
    timeBest: "O(1)", timeAverage: "O(log n)", timeWorst: "O(log n)", spaceComplexity: "O(1)",
    tags: ["searching", "divide-and-conquer", "sorted-input"], js: binaryJs, py: binaryPy },
  { slug: "breadth-first-search", name: "Breadth-First Search", categoryId: "graph-traversal", difficulty: Difficulty.intermediate,
    description: "Visits a graph level by level using a queue.",
    timeBest: "O(V + E)", timeAverage: "O(V + E)", timeWorst: "O(V + E)", spaceComplexity: "O(V)",
    tags: ["graph", "traversal", "queue"], js: bfsJs, py: bfsPy },
  { slug: "depth-first-search", name: "Depth-First Search", categoryId: "graph-traversal", difficulty: Difficulty.intermediate,
    description: "Explores as far as possible along each branch before backtracking.",
    timeBest: "O(V + E)", timeAverage: "O(V + E)", timeWorst: "O(V + E)", spaceComplexity: "O(V)",
    tags: ["graph", "traversal", "recursion"], js: dfsJs, py: dfsPy },
];

async function main() {
  // ── users ──
  const admin = await prisma.user.upsert({
    where: { email: "dev-admin@example.invalid" },
    update: { role: Role.ADMIN, name: "Dev Admin" },
    create: { email: "dev-admin@example.invalid", username: "dev_admin", name: "Dev Admin", role: Role.ADMIN },
    select: { id: true },
  });
  const learner = await prisma.user.upsert({
    where: { email: "dev-learner@example.invalid" },
    update: { name: "Dev Learner" },
    create: { email: "dev-learner@example.invalid", username: "dev_learner", name: "Dev Learner", role: Role.USER },
    select: { id: true },
  });

  // ── catalog ──
  for (const c of categories) {
    await prisma.category.upsert({
      where: { id: c.id },
      create: { ...c, slug: c.id },
      update: { label: c.label, description: c.description, iconName: c.iconName, sortOrder: c.sortOrder },
    });
  }
  let order = 0;
  for (const a of algorithms) {
    order += 1;
    const script = scripts[a.slug] ?? null;
    const fields = {
      name: a.name, description: a.description, categoryId: a.categoryId, difficulty: a.difficulty,
      isPublished: true, timeBest: a.timeBest, timeAverage: a.timeAverage, timeWorst: a.timeWorst,
      spaceComplexity: a.spaceComplexity, sortOrder: order, script, scriptVersion: 1,
    };
    await prisma.algorithm.upsert({
      where: { slug: a.slug },
      update: fields,
      create: {
        slug: a.slug,
        ...fields,
        publishedAt: new Date(),
        createdById: admin.id,
        displayCodes: { create: [{ language: "javascript", code: a.js }, { language: "python", code: a.py }] },
        tags: { create: a.tags.map((label) => ({ tag: { connectOrCreate: { where: { label }, create: { label } } } })) },
      },
    });
  }
  const bubble = await prisma.algorithm.findUnique({ where: { slug: "bubble-sort" }, select: { id: true } });

  // ── analyses (one shared) ──
  const code1 = linearJs;
  const result = (summary: string) => ({
    schemaVersion: 1,
    data: {
      summary,
      complexity: { time: { best: "O(1)", average: "O(n)", worst: "O(n)" }, space: "O(1)" },
      breakdown: { approach: "Sequential scan.", steps: ["Visit each element", "Compare with the target", "Return the index or -1"] },
      bottlenecks: [],
      antiPatterns: [],
      improvements: [{ suggestion: "Sort the data and use binary search for repeated lookups.", expectedImpact: "O(log n) per lookup" }],
      optimizedCode: "function linearSearch(arr, target) { return arr.indexOf(target); }",
      edgeCases: [],
      readabilityScore: 90,
      tags: ["searching"],
    },
  });
  await prisma.analysis.upsert({
    where: { id: "seed_analysis_1" },
    update: {},
    create: {
      id: "seed_analysis_1", userId: learner.id, code: code1, language: "javascript", complexity: "O(n)",
      suggestion: "Sort the data and use binary search for repeated lookups.", result: json(result("Linear search over an array.")),
      title: "Linear search", model: "seed", promptVersion: "seed-1", schemaVersion: 1, codeHash: sha256(code1),
      latencyMs: 820, shareId: "seedshare001", isPublic: true,
    },
  });
  const code2 = bubbleJs;
  await prisma.analysis.upsert({
    where: { id: "seed_analysis_2" },
    update: {},
    create: {
      id: "seed_analysis_2", userId: learner.id, code: code2, language: "javascript", complexity: "O(n^2)",
      suggestion: "Use a built-in O(n log n) sort for large inputs.", result: json(result("Bubble sort with an early exit.")),
      title: "Bubble sort", model: "seed", promptVersion: "seed-1", schemaVersion: 1, codeHash: sha256(code2), latencyMs: 1010,
    },
  });
  await prisma.share.upsert({
    where: { shareId: "seedshare001" }, update: {},
    create: { shareId: "seedshare001", type: "analysis", targetId: "seed_analysis_1", ownerId: learner.id },
  });

  // ── chat sessions + messages (legacy JSON and the new table are kept in sync) ──
  const sessions = [
    {
      id: "seed_session_1", title: "How does bubble sort work?", shareId: "seedshare002" as string | null,
      contextType: "algorithm" as const, contextId: bubble?.id ?? null,
      messages: [
        { role: "user" as const, content: "How does bubble sort work?" },
        { role: "assistant" as const, content: "It repeatedly swaps neighbouring elements that are out of order.", intent: "explain_algorithm" },
        { role: "user" as const, content: "Why is it O(n^2)?" },
        { role: "assistant" as const, content: "Each of the n passes compares up to n elements.", intent: "explain_algorithm" },
      ],
    },
    {
      id: "seed_session_2", title: "Binary search edge cases", shareId: null,
      contextType: "none" as const, contextId: null,
      messages: [
        { role: "user" as const, content: "What breaks binary search?" },
        { role: "assistant" as const, content: "Unsorted input and overflow in (lo + hi) / 2.", intent: "general" },
      ],
    },
  ];
  for (const s of sessions) {
    const now = Date.now();
    const rows = s.messages.map((m, i) => ({ ...m, id: `seed_msg_${s.id}_${i + 1}`, createdAt: new Date(now - (s.messages.length - i) * 60_000) }));
    await prisma.explanationSession.upsert({
      where: { id: s.id }, update: {},
      create: {
        id: s.id, userId: learner.id, title: s.title, shareId: s.shareId, isPublic: s.shareId !== null,
        contextType: s.contextType, contextId: s.contextId,
        messages: json(rows.map((r) => ({ id: r.id, role: r.role, content: r.content, ...(r.intent ? { intent: r.intent } : {}), createdAt: r.createdAt.toISOString() }))),
      },
    });
    await prisma.explanationMessage.createMany({
      data: rows.map((r, i) => ({ id: messageRowId(s.id, i + 1), sessionId: s.id, seq: i + 1, role: r.role, content: r.content, intent: r.intent ?? null, createdAt: r.createdAt })),
      skipDuplicates: true,
    });
    if (s.shareId) {
      await prisma.share.upsert({
        where: { shareId: s.shareId }, update: {},
        create: { shareId: s.shareId, type: "explain", targetId: s.id, ownerId: learner.id },
      });
    }
  }

  // ── visualizations (one shared, one fork) ──
  const structures = [{ id: "A", ds: "array", label: "Array" }];
  await prisma.visualization.upsert({
    where: { id: "seed_viz_1" }, update: {},
    create: {
      id: "seed_viz_1", userId: learner.id, title: "Bubble sort, first pass", description: "Two swaps on a four-element array.",
      script: scripts["bubble-sort"], structures: json(structures), stepCount: 3, schemaVersion: 1,
    },
  });
  await prisma.visualization.upsert({
    where: { id: "seed_viz_2" }, update: {},
    create: {
      id: "seed_viz_2", userId: admin.id, title: "Bubble sort (copy)", description: "A fork of the learner's visualization.",
      script: scripts["bubble-sort"], structures: json(structures), stepCount: 3, schemaVersion: 1, forkedFromId: "seed_viz_1",
    },
  });
  await prisma.share.upsert({
    where: { shareId: "seedshare003" }, update: {},
    create: { shareId: "seedshare003", type: "visualization", targetId: "seed_viz_1", ownerId: learner.id },
  });

  // ── AI usage and audit log ──
  const day = utcDay();
  for (const u of [
    { feature: "analysis" as const, requests: 2, tokensIn: 1800, tokensOut: 2600 },
    { feature: "session" as const, requests: 3, tokensIn: 900, tokensOut: 1400 },
  ]) {
    await prisma.aiUsage.upsert({
      where: { userId_feature_day: { userId: learner.id, feature: u.feature, day } }, update: {},
      create: { userId: learner.id, feature: u.feature, day, requests: u.requests, tokensIn: u.tokensIn, tokensOut: u.tokensOut },
    });
  }
  await prisma.auditLog.upsert({
    where: { id: "seed_audit_1" }, update: {},
    create: { id: "seed_audit_1", actorId: admin.id, action: "seed.data_created", targetType: "seed", targetId: null, meta: json({ source: "seed.ts" }) },
  });
  await prisma.auditLog.upsert({
    where: { id: "seed_audit_2" }, update: {},
    create: { id: "seed_audit_2", actorId: admin.id, action: "algorithm.create", targetType: "algorithm", targetId: bubble?.id ?? null, meta: json({ slug: "bubble-sort", source: "seed.ts" }) },
  });

  console.log(`Seeded ${categories.length} categories, ${algorithms.length} algorithms and demo data for every Phase 5 model.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
P5EOF

patch_file packages/db/package.json 'verify:phase5' \
'    "make-admin": "tsx prisma/make-admin.ts"' \
'    "make-admin": "tsx prisma/make-admin.ts",
    "verify:phase5": "tsx prisma/verify-phase5.ts",
    "backfill:phase5": "tsx prisma/run-backfill.ts"'

patch_file package.json 'db:verify:phase5' \
'    "db:make-admin": "pnpm --filter @algoforge/db make-admin",' \
'    "db:make-admin": "pnpm --filter @algoforge/db make-admin",
    "db:verify:phase5": "pnpm --filter @algoforge/db verify:phase5",
    "db:backfill:phase5": "pnpm --filter @algoforge/db backfill:phase5",'

# =============================================================================
# 4. API: REPOSITORIES (ownership is part of every query)
# =============================================================================
log "Writing repositories"

write_file apps/api/src/repositories/audit-log.repository.ts <<'P5EOF'
import { prisma, Prisma } from "@algoforge/db";

export const auditLogRepository = {
  create(data: {
    actorId: string | null;
    action: string;
    targetType: string | null;
    targetId: string | null;
    meta: Prisma.InputJsonValue;
  }) {
    return prisma.auditLog.create({ data, select: { id: true } });
  },

  /** Newest first. `take` should be limit + 1 to detect a next page. */
  findPage(opts: { take: number; cursor?: string; actorId?: string; targetType?: string; targetId?: string }) {
    return prisma.auditLog.findMany({
      where: {
        ...(opts.actorId ? { actorId: opts.actorId } : {}),
        ...(opts.targetType ? { targetType: opts.targetType } : {}),
        ...(opts.targetId ? { targetId: opts.targetId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  },
};
P5EOF

write_file apps/api/src/repositories/visualization.repository.ts <<'P5EOF'
import { prisma, Prisma } from "@algoforge/db";

const summarySelect = {
  id: true,
  title: true,
  description: true,
  language: true,
  structures: true,
  stepCount: true,
  schemaVersion: true,
  forkedFromId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface VisualizationWrite {
  title: string;
  description?: string | null;
  script: string;
  code?: string | null;
  language?: string | null;
  structures: Prisma.InputJsonValue;
  stepCount: number;
  schemaVersion?: number;
  forkedFromId?: string | null;
}

/** Every read and write below is scoped by userId inside the query itself, so an IDOR cannot be reintroduced by a caller forgetting a check. */
export const visualizationRepository = {
  create(userId: string, data: VisualizationWrite) {
    return prisma.visualization.create({
      data: {
        userId,
        title: data.title,
        description: data.description ?? null,
        script: data.script,
        code: data.code ?? null,
        language: data.language ?? null,
        structures: data.structures,
        stepCount: data.stepCount,
        schemaVersion: data.schemaVersion ?? 1,
        forkedFromId: data.forkedFromId ?? null,
      },
    });
  },

  findOneByUser(id: string, userId: string) {
    return prisma.visualization.findFirst({ where: { id, userId } });
  },

  async existsByUser(id: string, userId: string): Promise<boolean> {
    return (await prisma.visualization.count({ where: { id, userId } })) > 0;
  },

  /** Newest first. `take` should be limit + 1 to detect a next page. */
  findPageByUser(userId: string, opts: { take: number; cursor?: string }) {
    return prisma.visualization.findMany({
      where: { userId },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
      select: summarySelect,
    });
  },

  updateByUser(id: string, userId: string, patch: Partial<VisualizationWrite>) {
    const data: Prisma.VisualizationUncheckedUpdateManyInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.script !== undefined) data.script = patch.script;
    if (patch.code !== undefined) data.code = patch.code;
    if (patch.language !== undefined) data.language = patch.language;
    if (patch.structures !== undefined) data.structures = patch.structures;
    if (patch.stepCount !== undefined) data.stepCount = patch.stepCount;
    if (patch.schemaVersion !== undefined) data.schemaVersion = patch.schemaVersion;
    return prisma.visualization.updateMany({ where: { id, userId }, data });
  },

  deleteByUser(id: string, userId: string) {
    return prisma.visualization.deleteMany({ where: { id, userId } });
  },

  countByUser(userId: string) {
    return prisma.visualization.count({ where: { userId } });
  },
};
P5EOF

write_file apps/api/src/repositories/share.repository.ts <<'P5EOF'
import { prisma, Prisma, type ShareType } from "@algoforge/db";

const activeWhere = (now: Date): Prisma.ShareWhereInput => ({
  revokedAt: null,
  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
});

async function ownsTarget(tx: Prisma.TransactionClient, ownerId: string, type: ShareType, targetId: string): Promise<boolean> {
  switch (type) {
    case "analysis":
      return (await tx.analysis.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "explain":
      return (await tx.explanationSession.count({ where: { id: targetId, userId: ownerId } })) > 0;
    case "visualization":
      return (await tx.visualization.count({ where: { id: targetId, userId: ownerId } })) > 0;
  }
}

export const shareRepository = {
  /**
   * Idempotent. Returns null when the owner does not own the target (the ownership check and the write
   * happen in one transaction). An active share is returned unchanged; a revoked one is re-opened
   * with the new shareId so an old, revoked link never comes back to life.
   */
  createForOwnedTarget(ownerId: string, type: ShareType, targetId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      if (!(await ownsTarget(tx, ownerId, type, targetId))) return null;
      const existing = await tx.share.findUnique({ where: { type_targetId: { type, targetId } } });
      if (existing && existing.ownerId === ownerId && existing.revokedAt === null) return existing;
      if (existing) {
        return tx.share.update({
          where: { id: existing.id },
          data: { shareId, ownerId, revokedAt: null, expiresAt: null },
        });
      }
      return tx.share.create({ data: { shareId, type, targetId, ownerId } });
    });
  },

  /** Only the owner can revoke. Returns the number of shares revoked (0 = not found, not yours, or already revoked). */
  revokeByOwner(shareId: string, ownerId: string) {
    return prisma.share.updateMany({ where: { shareId, ownerId, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  /** A share that is neither revoked nor expired. */
  findActiveByShareId(shareId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { shareId, ...activeWhere(now) } });
  },

  findActiveByTarget(type: ShareType, targetId: string, now: Date = new Date()) {
    return prisma.share.findFirst({ where: { type, targetId, ...activeWhere(now) } });
  },

  findByOwnerAndTarget(ownerId: string, type: ShareType, targetId: string) {
    return prisma.share.findFirst({ where: { ownerId, type, targetId } });
  },

  incrementViewCount(shareId: string, now: Date = new Date()) {
    return prisma.share.updateMany({ where: { shareId, ...activeWhere(now) }, data: { viewCount: { increment: 1 } } });
  },
};
P5EOF

write_file apps/api/src/repositories/ai-usage.repository.ts <<'P5EOF'
import { prisma, type AiFeature } from "@algoforge/db";

export interface UsageDelta {
  requests: number;
  tokensIn: number;
  tokensOut: number;
}

export const aiUsageRepository = {
  /** Atomic upsert-and-increment on the (user, feature, day) row. `day` must be a UTC midnight date. */
  increment(userId: string, feature: AiFeature, day: Date, delta: UsageDelta) {
    return prisma.aiUsage.upsert({
      where: { userId_feature_day: { userId, feature, day } },
      create: { userId, feature, day, requests: delta.requests, tokensIn: delta.tokensIn, tokensOut: delta.tokensOut },
      update: {
        requests: { increment: delta.requests },
        tokensIn: { increment: delta.tokensIn },
        tokensOut: { increment: delta.tokensOut },
      },
    });
  },

  findForDay(userId: string, feature: AiFeature, day: Date) {
    return prisma.aiUsage.findUnique({ where: { userId_feature_day: { userId, feature, day } } });
  },

  async sumSince(userId: string, feature: AiFeature, sinceDay: Date) {
    const agg = await prisma.aiUsage.aggregate({
      where: { userId, feature, day: { gte: sinceDay } },
      _sum: { requests: true, tokensIn: true, tokensOut: true },
    });
    return {
      requests: agg._sum.requests ?? 0,
      tokensIn: agg._sum.tokensIn ?? 0,
      tokensOut: agg._sum.tokensOut ?? 0,
    };
  },
};
P5EOF

write_file apps/api/src/repositories/explanation-message.repository.ts <<'P5EOF'
import { createHash } from "crypto";
import { prisma, type Prisma } from "@algoforge/db";

/** Same formula as the Phase 5 backfill (md5 of "<sessionId>:<seq>"), so rewrites keep stable ids. */
export const explanationMessageRowId = (sessionId: string, seq: number): string =>
  createHash("md5").update(`${sessionId}:${seq}`).digest("hex");

export interface MessageInput {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  createdAt: string;
}

export const explanationMessageRepository = {
  /** Messages of a session the user owns. Ownership is a relation filter in the query. */
  listBySession(sessionId: string, userId: string, opts: { take: number; afterSeq?: number }) {
    return prisma.explanationMessage.findMany({
      where: {
        sessionId,
        session: { userId },
        ...(opts.afterSeq !== undefined ? { seq: { gt: opts.afterSeq } } : {}),
      },
      orderBy: { seq: "asc" },
      take: opts.take,
    });
  },

  countBySession(sessionId: string, userId: string) {
    return prisma.explanationMessage.count({ where: { sessionId, session: { userId } } });
  },

  /**
   * Makes the table mirror the given messages (seq = position, starting at 1).
   * Must run inside the same transaction that has already verified ownership of the session.
   */
  async replaceForSession(tx: Prisma.TransactionClient, sessionId: string, messages: readonly MessageInput[]): Promise<void> {
    await tx.explanationMessage.deleteMany({ where: { sessionId } });
    if (messages.length === 0) return;
    await tx.explanationMessage.createMany({
      data: messages.map((m, i) => {
        const at = new Date(m.createdAt);
        return {
          id: explanationMessageRowId(sessionId, i + 1),
          sessionId,
          seq: i + 1,
          role: m.role,
          content: m.content,
          intent: m.intent ?? null,
          createdAt: Number.isNaN(at.getTime()) ? new Date() : at,
        };
      }),
    });
  },
};
P5EOF

write_file apps/api/src/repositories/analysis.repository.ts <<'P5EOF'
//# filename: apps/api/src/repositories/analysis.repository.ts

import { createHash } from "crypto";
import { prisma, Prisma } from "@algoforge/db";
import { AppError } from "../utils/app-error";

/** SHA-256 (hex) of the submitted code. Same formula as the Phase 5 backfill. */
export const hashCode = (code: string): string => createHash("sha256").update(code, "utf8").digest("hex");

export const analysisRepository = {
  create(data: {
    userId: string;
    code: string;
    language: string;
    complexity: string | null;
    suggestion: string | null;
    result: Prisma.InputJsonValue;
  }) {
    return prisma.analysis.create({
      data: { ...data, codeHash: hashCode(data.code) },
      select: { id: true, language: true, result: true, createdAt: true },
    });
  },

  findManyByUser(
    userId: string,
    opts: {
      cursorCreatedAt?: Date;
      cursorId?: string;
      take: number;
    },
  ) {
    return prisma.analysis.findMany({
      where: {
        userId,
        ...(opts.cursorCreatedAt && opts.cursorId
          ? {
              OR: [
                { createdAt: { lt: opts.cursorCreatedAt } },
                {
                  createdAt: { equals: opts.cursorCreatedAt },
                  id: { lt: opts.cursorId },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: opts.take,
      select: {
        id: true,
        language: true,
        complexity: true,
        suggestion: true,
        createdAt: true,
      },
    });
  },

  findOneByUser(userId: string, analysisId: string) {
    return prisma.analysis.findFirst({
      where: { id: analysisId, userId },
      select: { id: true, language: true, result: true, createdAt: true },
    });
  },

  findForShare(analysisId: string, userId: string) {
    return prisma.analysis.findFirst({ where: { id: analysisId, userId } });
  },

  /**
   * Marks the analysis public AND mirrors that into the shares table in one transaction.
   * The legacy columns stay authoritative until Phase 9. The owner is part of the query.
   */
  setPublic(analysisId: string, userId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.analysis.updateMany({
        where: { id: analysisId, userId },
        data: { shareId, isPublic: true },
      });
      if (updated.count === 0) throw AppError.notFound("Analysis not found.");
      await tx.share.upsert({
        where: { type_targetId: { type: "analysis", targetId: analysisId } },
        create: { shareId, type: "analysis", targetId: analysisId, ownerId: userId },
        update: { shareId, revokedAt: null },
      });
      return { id: analysisId, shareId };
    });
  },

  findPublicByShareId(shareId: string) {
    return prisma.analysis.findUnique({
      where: { shareId, isPublic: true },
      select: {
        id: true,
        code: true,
        language: true,
        result: true,
        createdAt: true,
        isPublic: true,
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
  },
};
P5EOF

write_file apps/api/src/repositories/explanation-session.repository.ts <<'P5EOF'
import { prisma, Prisma } from "@algoforge/db";
import type { SessionMessage } from "../services/explanation-session.service";
import { AppError } from "../utils/app-error";
import { explanationMessageRepository } from "./explanation-message.repository";

export const explanationSessionRepository = {
  // ─── Create ────────────────────────────────────────────────────────────────

  create(userId: string, title?: string) {
    return prisma.explanationSession.create({
      data: { userId, title: title ?? null, messages: [] },
    });
  },

  // ─── Read ──────────────────────────────────────────────────────────────────

  /** Paginated list — keyset by id (cursor = last seen id). */
  findManyByUser(userId: string, opts: { take: number; cursor?: string }) {
    return prisma.explanationSession.findMany({
      where: {
        userId,
        ...(opts.cursor ? { id: { lt: opts.cursor } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    opts.take,
      select:  {
        id:        true,
        title:     true,
        isPublic:  true,
        shareId:   true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  /** Full session including messages — only accessible by owner. */
  findOneByUser(id: string, userId: string) {
    return prisma.explanationSession.findFirst({
      where: { id, userId },
    });
  },

  /** Public session by shareId — includes basic creator info. */
  findPublicByShareId(shareId: string) {
    return prisma.explanationSession.findUnique({
      where:   { shareId, isPublic: true },
      include: {
        user: { select: { id: true, name: true, username: true, image: true } },
      },
    });
  },

  // ─── Update ────────────────────────────────────────────────────────────────

  /**
   * Replaces the messages array (and optionally the title) of a session the user owns, and mirrors the
   * messages into explanation_messages in the same transaction. The JSON column stays authoritative until Phase 8.
   */
  appendMessages(id: string, userId: string, messages: SessionMessage[], title?: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.explanationSession.updateMany({
        where: { id, userId },
        data: {
          messages: messages as unknown as Prisma.InputJsonValue,
          ...(title ? { title } : {}),
        },
      });
      if (updated.count === 0) throw AppError.notFound("Session not found.");
      await explanationMessageRepository.replaceForSession(tx, id, messages);
    });
  },

  /** Make the session public and set its shareId (mirrored into the shares table). The owner is part of the query. */
  share(id: string, userId: string, shareId: string) {
    return prisma.$transaction(async (tx) => {
      const updated = await tx.explanationSession.updateMany({
        where: { id, userId },
        data: { shareId, isPublic: true },
      });
      if (updated.count === 0) throw AppError.notFound("Session not found.");
      await tx.share.upsert({
        where: { type_targetId: { type: "explain", targetId: id } },
        create: { shareId, type: "explain", targetId: id, ownerId: userId },
        update: { shareId, revokedAt: null },
      });
    });
  },

  // ─── Delete ────────────────────────────────────────────────────────────────

  /** Hard-delete — returns count so callers can detect not-found. Also removes the session's share row (no orphans). */
  delete(id: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.share.deleteMany({ where: { type: "explain", targetId: id, ownerId: userId } });
      return tx.explanationSession.deleteMany({ where: { id, userId } });
    });
  },
};
P5EOF

# =============================================================================
# 5. API: SERVICES (audit helper + thin services for the new models)
# =============================================================================
log "Writing services"

write_file apps/api/src/services/audit.service.ts <<'P5EOF'
import type { Request } from "express";
import type { Prisma } from "@algoforge/db";
import { auditLogRepository } from "../repositories/audit-log.repository";
import { logger, serializeError } from "../utils/logger";
import { paginate } from "../utils/pagination";

/** Every admin mutation uses one of these names, so the log stays searchable. */
export const AUDIT_ACTIONS = {
  USER_UPGRADE: "admin.user.upgrade",
  USER_DOWNGRADE: "admin.user.downgrade",
  ALGORITHM_CREATE: "algorithm.create",
  ALGORITHM_UPDATE: "algorithm.update",
  ALGORITHM_DELETE: "algorithm.delete",
  CATEGORY_CREATE: "category.create",
  CATEGORY_UPDATE: "category.update",
  CATEGORY_DELETE: "category.delete",
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export interface AuditTarget {
  type: string;
  id?: string | null;
}
export interface AuditEntry {
  actorId: string | null;
  action: string;
  target?: AuditTarget;
  meta?: Record<string, unknown>;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const MAX_DEPTH = 4;
const MAX_STRING = 500;
const MAX_ITEMS = 50;
const SENSITIVE_KEY = /secret|token|password|passwd|authorization|cookie|api[-_]?key|credential/i;

/** Makes arbitrary metadata safe to store: bounded size and depth, JSON-only values, secrets redacted by key name. */
export function sanitizeMeta(value: unknown, depth = 0): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "function" || typeof value === "symbol") return null;
  if (depth >= MAX_DEPTH) return "[truncated]";
  if (Array.isArray(value)) return value.slice(0, MAX_ITEMS).map((v) => sanitizeMeta(v, depth + 1));
  if (typeof value === "object") {
    const out: { [key: string]: Json } = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>).slice(0, MAX_ITEMS)) {
      if (k === "__proto__") continue;
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : sanitizeMeta(v, depth + 1);
    }
    return out;
  }
  return String(value);
}

class AuditService {
  /**
   * Writes one audit row. NEVER throws: a failed audit write must not turn a mutation that already
   * succeeded into an error response. Failures are logged at error level. Returns whether the row was written.
   */
  async record(entry: AuditEntry): Promise<boolean> {
    try {
      await auditLogRepository.create({
        actorId: entry.actorId,
        action: entry.action.slice(0, 100),
        targetType: entry.target?.type ?? null,
        targetId: entry.target?.id ?? null,
        meta: sanitizeMeta(entry.meta ?? {}) as unknown as Prisma.InputJsonValue,
      });
      return true;
    } catch (error) {
      logger.error("audit log write failed", { action: entry.action, actorId: entry.actorId, ...serializeError(error) });
      return false;
    }
  }

  /** Convenience for controllers: the actor and request id come from the request. */
  recordFromRequest(req: Request, action: string, target?: AuditTarget, meta: Record<string, unknown> = {}): Promise<boolean> {
    return this.record({
      actorId: req.auth?.user.id ?? null,
      action,
      target,
      meta: { ...meta, requestId: req.requestId ?? null },
    });
  }

  async list(query: { limit: number; cursor?: string; actorId?: string; targetType?: string; targetId?: string }) {
    const rows = await auditLogRepository.findPage({ ...query, take: query.limit + 1 });
    return paginate(rows, query.limit, (row) => row.id);
  }
}

export const auditService = new AuditService();
P5EOF

write_file apps/api/src/services/visualization.service.ts <<'P5EOF'
import { visualizationRepository, type VisualizationWrite } from "../repositories/visualization.repository";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";

/**
 * Ownership-safe data access for saved visualizations. No HTTP routes and no script compilation here:
 * those arrive in Phase 6. Every method takes the acting user's id and passes it into the query.
 */
class VisualizationService {
  create(userId: string, data: VisualizationWrite) {
    return visualizationRepository.create(userId, data);
  }

  async get(userId: string, id: string) {
    const row = await visualizationRepository.findOneByUser(id, userId);
    if (!row) throw AppError.notFound("Visualization not found.");
    return row;
  }

  async list(userId: string, query: { limit: number; cursor?: string }) {
    const rows = await visualizationRepository.findPageByUser(userId, { take: query.limit + 1, cursor: query.cursor });
    return paginate(rows, query.limit, (row) => row.id);
  }

  async update(userId: string, id: string, patch: Partial<VisualizationWrite>) {
    const result = await visualizationRepository.updateByUser(id, userId, patch);
    if (result.count === 0) throw AppError.notFound("Visualization not found.");
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await visualizationRepository.deleteByUser(id, userId);
    if (result.count === 0) throw AppError.notFound("Visualization not found.");
  }
}

export const visualizationService = new VisualizationService();
P5EOF

# A deleted visualization must not leave a share row behind (shares.target_id has no FK).
patch_file apps/api/src/repositories/visualization.repository.ts 'type: "visualization", targetId: id' \
'    return prisma.visualization.deleteMany({ where: { id, userId } });' \
'    return prisma.$transaction(async (tx) => {
      const result = await tx.visualization.deleteMany({ where: { id, userId } });
      if (result.count > 0) await tx.share.deleteMany({ where: { type: "visualization", targetId: id } });
      return result;
    });'

write_file apps/api/src/services/share.service.ts <<'P5EOF'
import { randomBytes } from "crypto";
import { Prisma, type ShareType } from "@algoforge/db";
import { shareRepository } from "../repositories/share.repository";
import { AppError } from "../utils/app-error";

const MAX_ATTEMPTS = 5;

/** 12 base64url characters, the format the unified share id uses (decision D7). */
export const newShareId = (): string => randomBytes(9).toString("base64url");

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/**
 * Data access for the shares table. No HTTP routes and no cache purging yet (Phase 9).
 * Callers always pass the acting user as `ownerId`; the repository checks ownership inside its transaction.
 */
class ShareService {
  /** Idempotent. Retries when a freshly generated id collides with an existing one. */
  async create(ownerId: string, type: ShareType, targetId: string) {
    for (let attempt = 1; ; attempt++) {
      try {
        const share = await shareRepository.createForOwnedTarget(ownerId, type, targetId, newShareId());
        if (!share) throw AppError.notFound("Item not found.");
        return share;
      } catch (error) {
        if (error instanceof AppError) throw error;
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  async revoke(ownerId: string, shareId: string): Promise<void> {
    const result = await shareRepository.revokeByOwner(shareId, ownerId);
    if (result.count === 0) throw AppError.notFound("Share not found.");
  }

  /** The active (not revoked, not expired) share, or 404. */
  async resolve(shareId: string) {
    const share = await shareRepository.findActiveByShareId(shareId);
    if (!share) throw AppError.notFound("Share not found.");
    return share;
  }
}

export const shareService = new ShareService();
P5EOF

write_file apps/api/src/services/ai-usage.service.ts <<'P5EOF'
import { Prisma, type AiFeature } from "@algoforge/db";
import { aiUsageRepository } from "../repositories/ai-usage.repository";

const MAX_ATTEMPTS = 4;
const INT32_MAX = 2_000_000_000;

/** The calendar day (UTC midnight) used as the usage bucket. */
export function utcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const clampCount = (n: number | undefined): number =>
  n === undefined || !Number.isFinite(n) ? 0 : Math.max(0, Math.min(INT32_MAX, Math.floor(n)));

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

/** Accounting only. Quotas and limits that read this data arrive in Phase 7. */
class AiUsageService {
  /** Records one AI request. Two requests racing to create the day's row both end up counted. */
  async record(userId: string, feature: AiFeature, tokens: { tokensIn?: number; tokensOut?: number } = {}, now: Date = new Date()) {
    const day = utcDay(now);
    const delta = { requests: 1, tokensIn: clampCount(tokens.tokensIn), tokensOut: clampCount(tokens.tokensOut) };
    for (let attempt = 1; ; attempt++) {
      try {
        return await aiUsageRepository.increment(userId, feature, day, delta);
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) continue;
        throw error;
      }
    }
  }

  today(userId: string, feature: AiFeature, now: Date = new Date()) {
    return aiUsageRepository.findForDay(userId, feature, utcDay(now));
  }
}

export const aiUsageService = new AiUsageService();
P5EOF

# =============================================================================
# 6. WIRE THE EXISTING CODE TO THE NEW SCHEMA
# =============================================================================
log "Updating existing callers (minimal, anchor-checked patches)"

# Repository signatures now take the acting user so ownership is part of the query.
patch_file apps/api/src/services/analysis.service.ts 'setPublic(analysisId, userId, shareId)' \
'await analysisRepository.setPublic(analysisId, shareId);' \
'await analysisRepository.setPublic(analysisId, userId, shareId);'

patch_file apps/api/src/services/explanation-session.service.ts 'appendMessages(sessionId, userId,' \
'await explanationSessionRepository.appendMessages(sessionId, updatedMessages, title);' \
'await explanationSessionRepository.appendMessages(sessionId, userId, updatedMessages, title);'

patch_file apps/api/src/services/explanation-session.service.ts '.share(id, userId, shareId)' \
'await explanationSessionRepository.share(id, shareId);' \
'await explanationSessionRepository.share(id, userId, shareId);'

# categories.slug is NOT NULL: new categories get slug = id (D-11).
patch_file apps/api/src/repositories/category.repository.ts 'slug: data.id' \
'    return prisma.category.create({ data });' \
'    return prisma.category.create({ data: { ...data, slug: data.id } });'

# Algorithms: record who created them and when they were first published (D-10).
patch_file apps/api/src/repositories/algorithm.repository.ts 'createdById: data.createdById' \
'        slug: data.slug,' \
'        slug: data.slug,
        publishedAt: data.publishedAt ?? null,
        createdById: data.createdById ?? null,'

patch_file apps/api/src/repositories/algorithm.repository.ts 'createdById?: string | null;' \
'    isPublished: boolean;' \
'    isPublished: boolean;
    publishedAt?: Date | null;
    createdById?: string | null;'

patch_file apps/api/src/services/algorithm/mutation.service.ts 'actorId?: string' \
'export async function createAlgorithm(input: CreateAlgorithm) {' \
'export async function createAlgorithm(input: CreateAlgorithm, actorId?: string) {'

patch_file apps/api/src/services/algorithm/mutation.service.ts 'createdById: actorId' \
'  const created = await algorithmRepository.create(toCreateData(input, category.id));' \
'  const created = await algorithmRepository.create({
    ...toCreateData(input, category.id),
    publishedAt: input.isPublished ? new Date() : null,
    createdById: actorId ?? null,
  });'

patch_file apps/api/src/services/algorithm/mutation.service.ts 'existing.isPublished' \
'    toUpdateData(input, existing.forge ?? null, categoryId),' \
'    {
      ...toUpdateData(input, existing.forge ?? null, categoryId),
      // First publication time: set when a draft becomes published, never rewritten afterwards.
      ...(input.isPublished === true && !existing.isPublished ? { publishedAt: new Date() } : {}),
    },'

# Admin audit log (D-07): every admin mutation records who did what.
patch_file apps/api/src/controllers/admin.controller.ts 'services/audit.service' \
'import { adminService } from "../services/admin.service";' \
'import { adminService } from "../services/admin.service";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";'

patch_file apps/api/src/controllers/admin.controller.ts 'AUDIT_ACTIONS.USER_UPGRADE' \
'    const result = await adminService.upgradeToAdmin(readUserId(req.body));' \
'    const result = await adminService.upgradeToAdmin(readUserId(req.body));
    if (result.changed) await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_UPGRADE, { type: "user", id: result.user.id }, { newRole: "ADMIN" });'

patch_file apps/api/src/controllers/admin.controller.ts 'AUDIT_ACTIONS.USER_DOWNGRADE' \
'    const result = await adminService.downgradeToUser(readUserId(req.body));' \
'    const result = await adminService.downgradeToUser(readUserId(req.body));
    if (result.changed) await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_DOWNGRADE, { type: "user", id: result.user.id }, { newRole: "USER" });'

patch_file apps/api/src/controllers/algorithm.controller.ts 'services/audit.service' \
'import { algorithmService } from "../services/algorithm/index";' \
'import { algorithmService } from "../services/algorithm/index";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";'

patch_file apps/api/src/controllers/algorithm.controller.ts 'AUDIT_ACTIONS.ALGORITHM_CREATE' \
'    const created = await algorithmService.createAlgorithm(input);' \
'    const created = await algorithmService.createAlgorithm(input, req.auth?.user.id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_CREATE, { type: "algorithm", id: created.id }, { slug: input.slug });'

patch_file apps/api/src/controllers/algorithm.controller.ts 'AUDIT_ACTIONS.ALGORITHM_UPDATE' \
'    const updated = await algorithmService.updateAlgorithm(id, input);' \
'    const updated = await algorithmService.updateAlgorithm(id, input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_UPDATE, { type: "algorithm", id }, { fields: Object.keys(input) });'

patch_file apps/api/src/controllers/algorithm.controller.ts 'AUDIT_ACTIONS.ALGORITHM_DELETE' \
'    await algorithmService.deleteAlgorithm(id);' \
'    await algorithmService.deleteAlgorithm(id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_DELETE, { type: "algorithm", id });'

patch_file apps/api/src/controllers/category.controller.ts 'services/audit.service' \
'import { categoryService } from "../services/category.service";' \
'import { categoryService } from "../services/category.service";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";'

patch_file apps/api/src/controllers/category.controller.ts 'AUDIT_ACTIONS.CATEGORY_CREATE' \
'    const category = await categoryService.createCategory(input);' \
'    const category = await categoryService.createCategory(input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_CREATE, { type: "category", id: category.id }, { label: input.label });'

patch_file apps/api/src/controllers/category.controller.ts 'AUDIT_ACTIONS.CATEGORY_UPDATE' \
'    const category = await categoryService.updateCategory(id, input);' \
'    const category = await categoryService.updateCategory(id, input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_UPDATE, { type: "category", id }, { fields: Object.keys(input) });'

patch_file apps/api/src/controllers/category.controller.ts 'AUDIT_ACTIONS.CATEGORY_DELETE' \
'    await categoryService.deleteCategory(id);' \
'    await categoryService.deleteCategory(id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.CATEGORY_DELETE, { type: "category", id });'

# =============================================================================
# 7. TESTS
# =============================================================================
log "Writing tests"

write_file apps/api/src/db/phase5-schema.test.ts <<'P5EOF'
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const prismaDir = path.resolve(__dirname, "../../../../packages/db/prisma");
const schema = readFileSync(path.join(prismaDir, "schema.prisma"), "utf8");
const migrationsDir = path.join(prismaDir, "migrations");
const phase5Dir = readdirSync(migrationsDir).find((d) => d.endsWith("_phase5_data_model"));
const sql = phase5Dir ? readFileSync(path.join(migrationsDir, phase5Dir, "migration.sql"), "utf8") : "";
const backfill = readFileSync(path.join(prismaDir, "backfills/phase5_backfill.sql"), "utf8");

describe("Phase 5 schema", () => {
  it.each(["Visualization", "Share", "ExplanationMessage", "AiUsage", "AuditLog"])("declares model %s", (name) => {
    expect(schema).toMatch(new RegExp(`model ${name} \\{`));
  });

  it("adds the Analysis columns", () => {
    for (const col of ["title", "model", "promptVersion", "schemaVersion", "codeHash", "latencyMs", "updatedAt"]) {
      expect(schema).toMatch(new RegExp(`model Analysis \\{[\\s\\S]*?\\n\\s+${col}\\s`));
    }
  });

  it("adds the Algorithm columns", () => {
    for (const col of ["script", "scriptVersion", "sortOrder", "publishedAt", "createdById"]) {
      expect(schema).toMatch(new RegExp(`model Algorithm \\{[\\s\\S]*?\\n\\s+${col}\\s`));
    }
  });

  it("keeps the legacy columns until their consumers move (Phases 8 and 9)", () => {
    expect(schema).toMatch(/model Analysis \{[\s\S]*?shareId\s+String\?/);
    expect(schema).toMatch(/model ExplanationSession \{[\s\S]*?messages\s+Json/);
    expect(schema).toMatch(/model ForgeConfig \{/);
  });

  it("makes sessions.token_hash unique and gives categories a unique slug", () => {
    expect(schema).toMatch(/tokenHash\s+String\s+@unique/);
    expect(schema).toMatch(/model Category \{[\s\S]*?slug\s+String\s+@unique/);
  });

  it("enforces one share per target and one usage row per user, feature and day", () => {
    expect(schema).toMatch(/@@unique\(\[type, targetId\]\)/);
    expect(schema).toMatch(/@@unique\(\[userId, feature, day\]\)/);
    expect(schema).toMatch(/@@unique\(\[sessionId, seq\]\)/);
  });
});

describe("Phase 5 migration", () => {
  it("exists", () => {
    expect(phase5Dir).toBeTruthy();
    expect(sql.length).toBeGreaterThan(0);
  });

  it("is additive: nothing is dropped, truncated or deleted", () => {
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });

  it.each(["visualizations", "shares", "explanation_messages", "ai_usage", "audit_logs"])("creates table %s", (t) => {
    expect(sql).toMatch(new RegExp(`CREATE TABLE "${t}"`));
  });

  it("guards against duplicate token hashes before adding the unique index", () => {
    expect(sql.indexOf("RAISE EXCEPTION")).toBeGreaterThan(-1);
    expect(sql.indexOf("RAISE EXCEPTION")).toBeLessThan(sql.indexOf('CREATE UNIQUE INDEX "sessions_token_hash_key"'));
  });

  it("ends with the exact rerunnable backfill", () => {
    expect(sql.endsWith(backfill) || sql.trimEnd().endsWith(backfill.trimEnd())).toBe(true);
  });
});


describe("Phase 5 backfill", () => {
    it("is rerunnable: conflicts are ignored and copies are guarded", () => {
        expect(backfill.match(/^\s*ON CONFLICT DO NOTHING\s*;/gm)?.length).toBe(
            3,
        );

        expect(backfill).toMatch(
            /NOT EXISTS\s*\(\s*SELECT 1\s+FROM\s+"explanation_messages"/,
        );

        expect(backfill).toMatch(/"code_hash" IS NULL/);
        expect(backfill).toMatch(/"published_at" IS NULL/);
    });
    it("never deletes or updates legacy columns", () => {
        expect(backfill).not.toMatch(/\bDELETE\b/i);
        expect(backfill).not.toMatch(
            /UPDATE "explanation_sessions"|UPDATE "analyses" SET "share_id"|"is_public" =/i,
        );
    });
});


describe("seed", () => {
  it("refuses to run in production", () => {
    const seed = readFileSync(path.join(prismaDir, "seed.ts"), "utf8");
    expect(seed).toMatch(/NODE_ENV === "production"/);
  });
});
P5EOF

write_file apps/api/src/services/audit.service.test.ts <<'P5EOF'
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../repositories/audit-log.repository", () => ({
  auditLogRepository: { create: vi.fn(), findPage: vi.fn() },
}));

import { auditLogRepository } from "../repositories/audit-log.repository";
import { AUDIT_ACTIONS, auditService, sanitizeMeta } from "./audit.service";

const create = vi.mocked(auditLogRepository.create);

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue({ id: "a1" });
});

describe("sanitizeMeta", () => {
  it("keeps plain JSON", () => {
    expect(sanitizeMeta({ a: 1, b: "x", c: [true, null] })).toEqual({ a: 1, b: "x", c: [true, null] });
  });
  it("redacts secret-looking keys at any depth", () => {
    expect(sanitizeMeta({ token: "t", nested: { Password: "p", apiKey: "k", ok: 1 } })).toEqual({
      token: "[redacted]",
      nested: { Password: "[redacted]", apiKey: "[redacted]", ok: 1 },
    });
  });
  it("bounds string length, depth and list size", () => {
    expect((sanitizeMeta("x".repeat(2000)) as string).length).toBeLessThan(600);
    expect(sanitizeMeta({ a: { b: { c: { d: { e: 1 } } } } })).toEqual({ a: { b: { c: { d: "[truncated]" } } } });
    expect((sanitizeMeta(Array.from({ length: 500 }, (_, i) => i)) as unknown[]).length).toBe(50);
  });
  it("turns non-JSON values into JSON", () => {
    expect(sanitizeMeta({ d: new Date("2026-01-01T00:00:00Z"), n: NaN, u: undefined, f: () => 1 })).toEqual({
      d: "2026-01-01T00:00:00.000Z",
      n: null,
      u: null,
      f: null,
    });
  });
  it("cannot be used to poison the prototype", () => {
    const out = sanitizeMeta(JSON.parse('{"__proto__":{"x":1},"y":2}')) as Record<string, unknown>;
    expect(out.y).toBe(2);
    expect(({} as Record<string, unknown>).x).toBeUndefined();
  });
});

describe("auditService.record", () => {
  it("writes the entry with sanitized metadata", async () => {
    const ok = await auditService.record({ actorId: "u1", action: AUDIT_ACTIONS.ALGORITHM_CREATE, target: { type: "algorithm", id: "g1" }, meta: { secret: "s", slug: "x" } });
    expect(ok).toBe(true);
    expect(create).toHaveBeenCalledWith({
      actorId: "u1",
      action: "algorithm.create",
      targetType: "algorithm",
      targetId: "g1",
      meta: { secret: "[redacted]", slug: "x" },
    });
  });
  it("never throws when the write fails: it reports false", async () => {
    create.mockRejectedValue(new Error("db down"));
    await expect(auditService.record({ actorId: "u1", action: "x" })).resolves.toBe(false);
  });
  it("takes the actor and request id from the request", async () => {
    const req = { auth: { user: { id: "admin1" } }, requestId: "req-1" } as unknown as Parameters<typeof auditService.recordFromRequest>[0];
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.USER_UPGRADE, { type: "user", id: "u9" }, { newRole: "ADMIN" });
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ actorId: "admin1", targetType: "user", targetId: "u9", meta: { newRole: "ADMIN", requestId: "req-1" } }));
  });
  it("limits the action name length", async () => {
    await auditService.record({ actorId: null, action: "a".repeat(300) });
    expect(create.mock.calls[0][0].action.length).toBe(100);
  });
});
P5EOF

write_file apps/api/src/db/phase5.integration.test.ts <<'P5EOF'
/* Runs only when PHASE5_TEST_DATABASE_URL points at a database that already has every migration applied.
   phase5.sh starts a throwaway Postgres for this. Without the variable, these tests are skipped. */
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionMessage } from "../services/explanation-session.service";

const url = process.env.PHASE5_TEST_DATABASE_URL;
const sid = () => randomBytes(9).toString("base64url");

describe.skipIf(!url)("Phase 5 database behaviour", () => {
  let prisma: typeof import("@algoforge/db").prisma;
  let shareRepository: typeof import("../repositories/share.repository").shareRepository;
  let visualizationRepository: typeof import("../repositories/visualization.repository").visualizationRepository;
  let analysisRepository: typeof import("../repositories/analysis.repository").analysisRepository;
  let hashCode: typeof import("../repositories/analysis.repository").hashCode;
  let sessionRepository: typeof import("../repositories/explanation-session.repository").explanationSessionRepository;
  let categoryRepository: typeof import("../repositories/category.repository").categoryRepository;
  let aiUsageService: typeof import("../services/ai-usage.service").aiUsageService;
  let shareService: typeof import("../services/share.service").shareService;
  let auditService: typeof import("../services/audit.service").auditService;

  const userIds: string[] = [];
  const newUser = async () => {
    const u = await prisma.user.create({ data: { email: `p5-${randomUUID()}@example.invalid` }, select: { id: true } });
    userIds.push(u.id);
    return u.id;
  };
  const viz = (userId: string, title = "t") =>
    visualizationRepository.create(userId, { title, script: "[]", structures: [], stepCount: 0 });
  const msgs = (n: number): SessionMessage[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `c${i}`,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    }));

  beforeAll(async () => {
    process.env.DATABASE_URL = url as string;
    ({ prisma } = await import("@algoforge/db"));
    ({ shareRepository } = await import("../repositories/share.repository"));
    ({ visualizationRepository } = await import("../repositories/visualization.repository"));
    ({ analysisRepository, hashCode } = await import("../repositories/analysis.repository"));
    ({ explanationSessionRepository: sessionRepository } = await import("../repositories/explanation-session.repository"));
    ({ categoryRepository } = await import("../repositories/category.repository"));
    ({ aiUsageService } = await import("../services/ai-usage.service"));
    ({ shareService } = await import("../services/share.service"));
    ({ auditService } = await import("../services/audit.service"));
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      await prisma.$disconnect();
    }
  });

  it("visualizations: another user can neither read, change nor delete", async () => {
    const a = await newUser();
    const b = await newUser();
    const v = await viz(a);
    expect(await visualizationRepository.findOneByUser(v.id, b)).toBeNull();
    expect((await visualizationRepository.updateByUser(v.id, b, { title: "hijack" })).count).toBe(0);
    expect((await visualizationRepository.deleteByUser(v.id, b)).count).toBe(0);
    expect((await visualizationRepository.findOneByUser(v.id, a))?.title).toBe("t");
    expect((await visualizationRepository.updateByUser(v.id, a, { title: "mine" })).count).toBe(1);
    expect((await visualizationRepository.findPageByUser(b, { take: 10 })).map((r) => r.id)).not.toContain(v.id);
    expect((await visualizationRepository.deleteByUser(v.id, a)).count).toBe(1);
  });

  it("visualizations: deleting a parent keeps its forks (fork link is cleared)", async () => {
    const a = await newUser();
    const parent = await viz(a, "parent");
    const fork = await visualizationRepository.create(a, { title: "fork", script: "[]", structures: [], stepCount: 0, forkedFromId: parent.id });
    await visualizationRepository.deleteByUser(parent.id, a);
    expect((await visualizationRepository.findOneByUser(fork.id, a))?.forkedFromId).toBeNull();
  });

  it("visualizations: deleting one also deletes its share (no orphans)", async () => {
    const a = await newUser();
    const v = await viz(a);
    await shareService.create(a, "visualization", v.id);
    await visualizationRepository.deleteByUser(v.id, a);
    expect(await prisma.share.count({ where: { type: "visualization", targetId: v.id } })).toBe(0);
  });

  it("visualizations: the database rejects a negative step count", async () => {
    const a = await newUser();
    await expect(visualizationRepository.create(a, { title: "x", script: "[]", structures: [], stepCount: -1 })).rejects.toBeTruthy();
  });

  it("shares: only the owner can create, idempotent, revoke, and a revoked link stays dead", async () => {
    const a = await newUser();
    const b = await newUser();
    const v = await viz(a);
    expect(await shareRepository.createForOwnedTarget(b, "visualization", v.id, sid())).toBeNull();
    const first = await shareService.create(a, "visualization", v.id);
    const again = await shareService.create(a, "visualization", v.id);
    expect(again.shareId).toBe(first.shareId);
    expect((await shareRepository.findActiveByShareId(first.shareId))?.targetId).toBe(v.id);
    expect((await shareRepository.revokeByOwner(first.shareId, b)).count).toBe(0);
    expect((await shareRepository.revokeByOwner(first.shareId, a)).count).toBe(1);
    expect(await shareRepository.findActiveByShareId(first.shareId)).toBeNull();
    const reopened = await shareService.create(a, "visualization", v.id);
    expect(reopened.shareId).not.toBe(first.shareId);
    expect(await shareRepository.findActiveByShareId(first.shareId)).toBeNull();
    expect((await shareRepository.findActiveByShareId(reopened.shareId))?.revokedAt).toBeNull();
  });

  it("shares: one row per target and expired shares do not resolve", async () => {
    const a = await newUser();
    const v = await viz(a);
    const s = await shareService.create(a, "visualization", v.id);
    await expect(prisma.share.create({ data: { shareId: sid(), type: "visualization", targetId: v.id, ownerId: a } })).rejects.toBeTruthy();
    await prisma.share.update({ where: { id: s.id }, data: { expiresAt: new Date(Date.now() + 60_000) } });
    expect(await shareRepository.findActiveByShareId(s.shareId)).not.toBeNull();
    expect(await shareRepository.findActiveByShareId(s.shareId, new Date(Date.now() + 120_000))).toBeNull();
  });

  it("shares: view counts only grow for active shares", async () => {
    const a = await newUser();
    const v = await viz(a);
    const s = await shareService.create(a, "visualization", v.id);
    await shareRepository.incrementViewCount(s.shareId);
    await shareRepository.incrementViewCount(s.shareId);
    await shareRepository.revokeByOwner(s.shareId, a);
    await shareRepository.incrementViewCount(s.shareId);
    expect((await prisma.share.findUniqueOrThrow({ where: { id: s.id } })).viewCount).toBe(2);
  });

  it("analyses: code hash is stored, and only the owner can make one public", async () => {
    const a = await newUser();
    const b = await newUser();
    const created = await analysisRepository.create({ userId: a, code: "let x = 1;", language: "javascript", complexity: null, suggestion: null, result: {} });
    const row = await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.codeHash).toBe(hashCode("let x = 1;"));
    await expect(analysisRepository.setPublic(created.id, b, sid())).rejects.toMatchObject({ statusCode: 404 });
    expect((await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } })).isPublic).toBe(false);
    const shareId = sid();
    await analysisRepository.setPublic(created.id, a, shareId);
    const pub = await prisma.analysis.findUniqueOrThrow({ where: { id: created.id } });
    expect(pub.isPublic).toBe(true);
    expect((await prisma.share.findUniqueOrThrow({ where: { shareId } })).targetId).toBe(created.id);
  });

  it("chat: messages mirror into explanation_messages and only the owner can write", async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await sessionRepository.create(a, "chat");
    await expect(sessionRepository.appendMessages(s.id, b, msgs(2), "x")).rejects.toMatchObject({ statusCode: 404 });
    expect(await prisma.explanationMessage.count({ where: { sessionId: s.id } })).toBe(0);
    await sessionRepository.appendMessages(s.id, a, msgs(4), "x");
    await sessionRepository.appendMessages(s.id, a, msgs(6), "x");
    const rows = await prisma.explanationMessage.findMany({ where: { sessionId: s.id }, orderBy: { seq: "asc" } });
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows[0].role).toBe("user");
    await expect(prisma.explanationMessage.create({ data: { sessionId: s.id, seq: 1, role: "user", content: "dup" } })).rejects.toBeTruthy();
  });

  it("chat: sharing and deleting keep shares and messages consistent", async () => {
    const a = await newUser();
    const b = await newUser();
    const s = await sessionRepository.create(a, "chat");
    await sessionRepository.appendMessages(s.id, a, msgs(2), "x");
    await expect(sessionRepository.share(s.id, b, sid())).rejects.toMatchObject({ statusCode: 404 });
    const shareId = sid();
    await sessionRepository.share(s.id, a, shareId);
    expect((await shareRepository.findActiveByShareId(shareId))?.type).toBe("explain");
    expect((await sessionRepository.delete(s.id, b)).count).toBe(0);
    expect((await sessionRepository.delete(s.id, a)).count).toBe(1);
    expect(await prisma.share.count({ where: { shareId } })).toBe(0);
    expect(await prisma.explanationMessage.count({ where: { sessionId: s.id } })).toBe(0);
  });

  it("ai usage: one row per user, feature and day, and parallel requests are all counted", async () => {
    const a = await newUser();
    await Promise.all(Array.from({ length: 10 }, () => aiUsageService.record(a, "analysis", { tokensIn: 1, tokensOut: 2 })));
    const rows = await prisma.aiUsage.findMany({ where: { userId: a } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requests: 10, tokensIn: 10, tokensOut: 20 });
    await expect(prisma.aiUsage.create({ data: { userId: a, feature: "analysis", day: rows[0].day, requests: -1 } })).rejects.toBeTruthy();
  });

  it("audit log: rows are written, survive their actor, and a bad actor never throws", async () => {
    const actor = await newUser();
    expect(await auditService.record({ actorId: actor, action: "test.action", target: { type: "thing", id: "t1" }, meta: { token: "x", n: 1 } })).toBe(true);
    const row = await prisma.auditLog.findFirstOrThrow({ where: { actorId: actor, action: "test.action" } });
    expect(row.meta).toEqual({ token: "[redacted]", n: 1 });
    await prisma.user.delete({ where: { id: actor } });
    expect((await prisma.auditLog.findUniqueOrThrow({ where: { id: row.id } })).actorId).toBeNull();
    expect(await auditService.record({ actorId: "no-such-user", action: "test.bad" })).toBe(false);
  });

  it("categories get slug = id, and algorithms keep their rows when the creator is deleted", async () => {
    const creator = await newUser();
    const id = `p5-${randomUUID().slice(0, 8)}`;
    const cat = await categoryRepository.create({ id, label: "P5", sortOrder: 0 });
    expect(cat.slug).toBe(id);
    const algo = await prisma.algorithm.create({ data: { slug: id, name: "A", description: "d", categoryId: id, createdById: creator } });
    await prisma.user.delete({ where: { id: creator } });
    expect((await prisma.algorithm.findUniqueOrThrow({ where: { id: algo.id } })).createdById).toBeNull();
    await prisma.algorithm.delete({ where: { id: algo.id } });
    await prisma.category.delete({ where: { id } });
  });
});
P5EOF

# =============================================================================
# 8. DOCUMENTATION (rollback)
# =============================================================================
log "Writing documentation"
write_file docs/phase5-data-model.md <<'P5EOF'
# Phase 5: data model evolution

Audit items: D-01 to D-11, B-06. The migration is **additive only**. It drops nothing, rewrites no existing
migration, and keeps every legacy column until its consumer has moved (messages: Phase 8, sharing: Phase 9).

## What changed

| Area | Change |
| --- | --- |
| New tables | `visualizations`, `shares`, `explanation_messages`, `ai_usage`, `audit_logs` |
| `analyses` | `title`, `updated_at`, `model`, `prompt_version`, `schema_version`, `code_hash`, `latency_ms`; index `(user_id, language, created_at)` |
| `explanation_sessions` | `context_type`, `context_id`; index `(user_id, updated_at)` |
| `algorithms` | `script`, `script_version`, `sort_order`, `published_at`, `created_by_id`; trigram indexes on `name` and `description`; index `(is_published, sort_order)` |
| `categories` | documented `slug` (equals `id`), unique |
| `sessions` | `token_hash` is now unique; indexes on `rotated_from_id` and `expires_at` (created only if Phase 4 did not already) |
| Constraints | non-negative counters, `shares.expires_at > created_at`, `UNIQUE(type, target_id)` on shares, `UNIQUE(session_id, seq)` on messages, `UNIQUE(user_id, feature, day)` on usage |
| Ownership | every repository query for the new models carries the owner id; nothing relies on a separate check |

`shares.target_id` is polymorphic and has no foreign key. The share repository verifies ownership inside its
transaction, and deleting a chat session or visualization also deletes its share row.

## Backfill

Inside the migration (and rerunnable on its own): `analyses.code_hash`, `algorithms.published_at`, `shares` rows for
existing `share_id` values (a legacy non-public share becomes a revoked share), and `explanation_messages` rows
copied from the legacy JSON `messages` column. Rows with an unknown role are skipped; `seq` is renumbered 1..n.

```bash
pnpm db:backfill:phase5   # safe to run any number of times
pnpm db:verify:phase5     # exits 1 when any invariant is violated
```

Run the backfill again immediately before the Phase 8 and Phase 9 cutovers to pick up rows written since.
The write paths added in Phase 5 keep the new tables in sync with the legacy columns until then.

## Applying

```bash
pnpm db:migrate:deploy
pnpm db:verify:phase5
```

If `sessions.token_hash` contains duplicates the migration stops before changing anything and says so. Resolve them and re-apply.

## Rolling back

There is no automatic rollback. Take a backup first (`pg_dump`). Because the migration only adds, the application
(Phases 1 to 4 code) keeps working against the new schema, so the usual rollback is to redeploy the previous code
and leave the schema in place. To remove the schema as well, run the statements below manually, in this order,
only after confirming nothing reads the new tables.

```sql
DROP TABLE IF EXISTS "audit_logs", "ai_usage", "explanation_messages", "shares", "visualizations";

ALTER TABLE "algorithms"
  DROP CONSTRAINT IF EXISTS "algorithms_created_by_id_fkey",
  DROP CONSTRAINT IF EXISTS "algorithms_script_version_check",
  DROP COLUMN IF EXISTS "script", DROP COLUMN IF EXISTS "script_version", DROP COLUMN IF EXISTS "sort_order",
  DROP COLUMN IF EXISTS "published_at", DROP COLUMN IF EXISTS "created_by_id";
DROP INDEX IF EXISTS "algorithms_name_trgm_idx", "algorithms_description_trgm_idx";

ALTER TABLE "categories" DROP COLUMN IF EXISTS "slug";
ALTER TABLE "explanation_sessions" DROP COLUMN IF EXISTS "context_type", DROP COLUMN IF EXISTS "context_id";
ALTER TABLE "analyses"
  DROP CONSTRAINT IF EXISTS "analyses_latency_ms_check", DROP CONSTRAINT IF EXISTS "analyses_schema_version_check",
  DROP COLUMN IF EXISTS "title", DROP COLUMN IF EXISTS "updated_at", DROP COLUMN IF EXISTS "model",
  DROP COLUMN IF EXISTS "prompt_version", DROP COLUMN IF EXISTS "schema_version",
  DROP COLUMN IF EXISTS "code_hash", DROP COLUMN IF EXISTS "latency_ms";
DROP INDEX IF EXISTS "sessions_token_hash_key";

DROP TYPE IF EXISTS "ExplanationMessageRole", "ExplanationContextType", "AiFeature", "ShareType";

-- Let Prisma re-apply the migration later:
DELETE FROM "_prisma_migrations" WHERE "migration_name" LIKE '%_phase5_data_model';
```

Dropping the legacy columns (`analyses.share_id`, `analyses.is_public`, `explanation_sessions.share_id`,
`explanation_sessions.is_public`, `explanation_sessions.messages`) and `forge_configs` is **not** part of this phase.
Each goes in its own later migration, in a release after its last reader is gone.
P5EOF

# =============================================================================
# 9. VALIDATION
# =============================================================================
log "Validation"

run_check "prisma generate" pnpm db:generate

DUMMY_URL="postgresql://validate:validate@127.0.0.1:1/validate"
run_check "prisma schema validates" bash -c "cd packages/db && DATABASE_URL='${DUMMY_URL}' pnpm exec prisma validate"

mig_checksum >"${WORK}/mig.after"
run_check "existing migrations are byte-for-byte unchanged" diff -u "${WORK}/mig.before" "${WORK}/mig.after"

run_check "typecheck (db, contracts, api)" pnpm typecheck
run_check "typecheck (web)" pnpm typecheck:web
run_check "lint (api)" pnpm lint
run_check "api build (tsup bundle)" pnpm build:api

HAVE_DOCKER=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then HAVE_DOCKER=1; fi

PG_PASSWORD=""; PG_PORT=""
psql_db() { local db="$1"; shift; docker exec -i "${CONTAINER}" psql -U postgres -d "${db}" -v ON_ERROR_STOP=1 -X -q "$@"; }
db_url()  { echo "postgresql://postgres:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/$1"; }
scalar()  { psql_db "$1" -t -A -c "$2" | tr -d '[:space:]'; }
expect_eq() {
  local label="$1" got="$2" want="$3"
  [[ "${got}" == "${want}" ]] || die "${label}: expected '${want}', got '${got}'"
  echo "  ok  ${label} = ${want}"
}
must_fail() {
  local label="$1" db="$2" sql="$3"
  if psql_db "${db}" -c "${sql}" >/dev/null 2>&1; then die "Constraint check failed: '${label}' was accepted but must be rejected."; fi
  echo "  ok  rejected: ${label}"
}
migrate_deploy() { # migrate_deploy <db> [schema-path]
  if [[ -n "${2:-}" ]]; then
    (cd packages/db && DATABASE_URL="$(db_url "$1")" pnpm exec prisma migrate deploy --schema "$2")
  else
    (cd packages/db && DATABASE_URL="$(db_url "$1")" pnpm exec prisma migrate deploy)
  fi
}

if [[ "${HAVE_DOCKER}" -eq 0 ]]; then
  if [[ "${PHASE5_ALLOW_SKIP_DB:-0}" == "1" ]]; then
    warn "Docker is not available: all database checks are SKIPPED (PHASE5_ALLOW_SKIP_DB=1)."
    SKIPPED+=("migration on an empty database" "migration on production-shaped data" "backfill counts and rerun" "constraint checks" "seed integrity" "ownership integration tests" "drift check")
    run_check "api and web unit tests (database tests skipped)" pnpm test
  else
    die "Docker is required for the database validation, and none is available. The files above were written and the static checks passed, so re-running this script after starting Docker is safe (it is idempotent). To skip database checks on purpose: PHASE5_ALLOW_SKIP_DB=1 bash phase5.sh"
  fi
else
  log "Starting a throwaway Postgres 16 (random password, bound to localhost, removed on exit)"
  PG_PASSWORD="$(node -e 'console.log(require("crypto").randomBytes(16).toString("hex"))')"
  CONTAINER="p5-pg-$(node -e 'console.log(require("crypto").randomBytes(4).toString("hex"))')"
  docker run -d --rm --name "${CONTAINER}" -e POSTGRES_PASSWORD="${PG_PASSWORD}" -p 127.0.0.1::5432 postgres:16 >/dev/null
  PG_PORT="$(docker port "${CONTAINER}" 5432/tcp | head -n 1)"; PG_PORT="${PG_PORT##*:}"
  for _ in $(seq 1 60); do docker exec "${CONTAINER}" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
  sleep 3
  for _ in $(seq 1 30); do psql_db postgres -c 'select 1' >/dev/null 2>&1 && break; sleep 1; done
  psql_db postgres -c 'select 1' >/dev/null 2>&1 || die "The throwaway Postgres did not become ready."
  for d in p5_empty p5_legacy p5_dup; do psql_db postgres -c "CREATE DATABASE ${d}" >/dev/null; done

  # ---- A. empty database ----------------------------------------------------
  run_check "migrations apply on an empty database" migrate_deploy p5_empty
  run_check "schema.prisma matches the migrated database (no drift)" \
    bash -c "cd packages/db && DATABASE_URL='$(db_url p5_empty)' pnpm exec prisma migrate diff --from-url '$(db_url p5_empty)' --to-schema-datamodel prisma/schema.prisma --exit-code"

  run_check "seed runs" bash -c "cd packages/db && NODE_ENV=development DATABASE_URL='$(db_url p5_empty)' pnpm exec tsx prisma/seed.ts"
  seed_counts() { psql_db p5_empty -t -A -c "select (select count(*) from categories)||','||(select count(*) from algorithms)||','||(select count(*) from users)||','||(select count(*) from analyses)||','||(select count(*) from explanation_sessions)||','||(select count(*) from explanation_messages)||','||(select count(*) from visualizations)||','||(select count(*) from shares)||','||(select count(*) from ai_usage)||','||(select count(*) from audit_logs)"; }
  first_seed="$(seed_counts)"
  run_check "seed is idempotent (second run)" bash -c "cd packages/db && NODE_ENV=development DATABASE_URL='$(db_url p5_empty)' pnpm exec tsx prisma/seed.ts"
  expect_eq "seed row counts unchanged by a second run" "$(seed_counts)" "${first_seed}"
  expect_eq "seed: categories,algorithms,users,analyses,sessions,messages,visualizations,shares,usage,audit" "${first_seed}" "3,6,2,2,2,6,2,3,2,2"
  expect_eq "seed: published algorithms" "$(scalar p5_empty "select count(*) from algorithms where is_published and published_at is not null")" "6"
  expect_eq "seed: algorithms with a visualizer script" "$(scalar p5_empty "select count(*) from algorithms where script is not null")" "3"
  run_check "seed data satisfies every Phase 5 invariant" bash -c "cd packages/db && DATABASE_URL='$(db_url p5_empty)' pnpm exec tsx prisma/verify-phase5.ts"
  run_check "seed refuses to run in production" bash -c "cd packages/db && if NODE_ENV=production DATABASE_URL='$(db_url p5_empty)' pnpm exec tsx prisma/seed.ts >/dev/null 2>&1; then exit 1; else exit 0; fi"

  # ---- B. production-shaped data -------------------------------------------
  log "Building a pre-Phase-5 database with legacy data"
  cp -R packages/db/prisma "${WORK}/prisma-pre"
  rm -rf "${WORK}/prisma-pre/migrations/${MIG_NAME}"
  run_check "baseline (pre-Phase-5) migrations apply" migrate_deploy p5_legacy "${WORK}/prisma-pre/schema.prisma"

  psql_db p5_legacy -f - >/dev/null <<'SQL'
INSERT INTO users (id, email, updated_at) VALUES
  ('lu1', 'legacy1@example.invalid', CURRENT_TIMESTAMP),
  ('lu2', 'legacy2@example.invalid', CURRENT_TIMESTAMP);
INSERT INTO analyses (id, user_id, code, language, result, share_id, is_public) VALUES
  ('la1', 'lu1', 'function a(){}', 'javascript', '{"summary":"s"}', 'oldshare0001', true),
  ('la2', 'lu1', 'def b(): pass',  'python',     '{"summary":"s"}', 'oldshare0002', false),
  ('la3', 'lu2', 'x = 1',          'python',     '{"summary":"s"}', NULL,           false);
INSERT INTO explanation_sessions (id, user_id, title, share_id, is_public, messages, updated_at) VALUES
  ('ls1', 'lu1', 'Shared chat', 'oldshare0003', true,
   '[{"id":"m1","role":"user","content":"hi","createdAt":"2026-01-01T10:00:00.000Z"},{"id":"m2","role":"system","content":"skip me"},{"id":"m3","role":"assistant","content":"hello","intent":"general","createdAt":"2026-01-01T10:00:05.000Z"},{"id":"m4","role":"user","content":"thanks"}]',
   CURRENT_TIMESTAMP),
  ('ls2', 'lu2', 'Empty chat', NULL, false, '[]', CURRENT_TIMESTAMP),
  ('ls3', 'lu2', 'Odd chat',  NULL, false, '{}', CURRENT_TIMESTAMP);
INSERT INTO categories (id, label, updated_at) VALUES ('legacy-cat', 'Legacy', CURRENT_TIMESTAMP);
INSERT INTO algorithms (id, slug, name, description, category_id, is_published, updated_at) VALUES
  ('lalg1', 'legacy-pub',   'P', 'd', 'legacy-cat', true,  CURRENT_TIMESTAMP),
  ('lalg2', 'legacy-draft', 'D', 'd', 'legacy-cat', false, CURRENT_TIMESTAMP);
SQL
  PRE_USERS="$(scalar p5_legacy "select count(*) from users")"
  PRE_ANALYSES="$(scalar p5_legacy "select count(*) from analyses")"
  PRE_SESSIONS="$(scalar p5_legacy "select count(*) from explanation_sessions")"
  PRE_ALGOS="$(scalar p5_legacy "select count(*) from algorithms")"
  PRE_JSON_LEN="$(scalar p5_legacy "select jsonb_array_length(messages) from explanation_sessions where id='ls1'")"

  run_check "Phase 5 migration applies on existing data" migrate_deploy p5_legacy
  run_check "no drift after migrating existing data" \
    bash -c "cd packages/db && pnpm exec prisma migrate diff --from-url '$(db_url p5_legacy)' --to-schema-datamodel prisma/schema.prisma --exit-code"

  log "Backfill correctness (existing data)"
  expect_eq "users preserved" "$(scalar p5_legacy "select count(*) from users")" "${PRE_USERS}"
  expect_eq "analyses preserved" "$(scalar p5_legacy "select count(*) from analyses")" "${PRE_ANALYSES}"
  expect_eq "chat sessions preserved" "$(scalar p5_legacy "select count(*) from explanation_sessions")" "${PRE_SESSIONS}"
  expect_eq "algorithms preserved" "$(scalar p5_legacy "select count(*) from algorithms")" "${PRE_ALGOS}"
  expect_eq "legacy JSON messages untouched" "$(scalar p5_legacy "select jsonb_array_length(messages) from explanation_sessions where id='ls1'")" "${PRE_JSON_LEN}"
  expect_eq "legacy share_id columns untouched" "$(scalar p5_legacy "select count(*) from analyses where share_id is not null")" "2"
  expect_eq "shares created from legacy ids" "$(scalar p5_legacy "select count(*) from shares")" "3"
  expect_eq "non-public legacy share becomes revoked" "$(scalar p5_legacy "select count(*) from shares where revoked_at is not null")" "1"
  expect_eq "share keeps its original id" "$(scalar p5_legacy "select share_id from shares where target_id='la1'")" "oldshare0001"
  expect_eq "share keeps its owner" "$(scalar p5_legacy "select owner_id from shares where target_id='ls1'")" "lu1"
  expect_eq "messages copied (unknown role skipped)" "$(scalar p5_legacy "select count(*) from explanation_messages")" "3"
  expect_eq "message seq is 1..n without gaps" "$(scalar p5_legacy "select string_agg(seq::text, ',' order by seq) from explanation_messages where session_id='ls1'")" "1,2,3"
  expect_eq "message roles in order" "$(scalar p5_legacy "select string_agg(role::text, ',' order by seq) from explanation_messages where session_id='ls1'")" "user,assistant,user"
  expect_eq "message without a timestamp falls back to the session's" "$(scalar p5_legacy "select (m.created_at = s.created_at)::text from explanation_messages m join explanation_sessions s on s.id=m.session_id where m.session_id='ls1' and m.seq=3")" "true"
  expect_eq "analyses without code_hash" "$(scalar p5_legacy "select count(*) from analyses where code_hash is null")" "0"
  expect_eq "legacy bare results are schema_version 0" "$(scalar p5_legacy "select count(*) from analyses where schema_version = 0")" "3"
  expect_eq "published algorithm got published_at" "$(scalar p5_legacy "select count(*) from algorithms where published_at is not null")" "1"
  expect_eq "categories slug = id" "$(scalar p5_legacy "select count(*) from categories where slug = id")" "$(scalar p5_legacy "select count(*) from categories")"

  snapshot() { psql_db p5_legacy -t -A -c "select (select count(*) from shares)||','||(select count(*) from explanation_messages)||','||(select count(*) from analyses where code_hash is not null)"; }
  BEFORE_RERUN="$(snapshot)"
  run_check "backfill rerun #1" bash -c "cd packages/db && DATABASE_URL='$(db_url p5_legacy)' pnpm exec tsx prisma/run-backfill.ts"
  run_check "backfill rerun #2" bash -c "cd packages/db && DATABASE_URL='$(db_url p5_legacy)' pnpm exec tsx prisma/run-backfill.ts"
  expect_eq "rerun creates no duplicates" "$(snapshot)" "${BEFORE_RERUN}"
  run_check "verify script passes on migrated legacy data" bash -c "cd packages/db && DATABASE_URL='$(db_url p5_legacy)' pnpm exec tsx prisma/verify-phase5.ts"

  log "Constraints enforced by the database"
  must_fail "second share for the same target"       p5_legacy "INSERT INTO shares (id, share_id, type, target_id, owner_id) VALUES ('x1','dupshare01','analysis','la1','lu1')"
  must_fail "share with a duplicate share_id"        p5_legacy "INSERT INTO shares (id, share_id, type, target_id, owner_id) VALUES ('x2','oldshare0001','analysis','la3','lu2')"
  must_fail "share whose owner does not exist"       p5_legacy "INSERT INTO shares (id, share_id, type, target_id, owner_id) VALUES ('x3','shareownr01','analysis','la3','nobody')"
  must_fail "share that expires before it was made"  p5_legacy "INSERT INTO shares (id, share_id, type, target_id, owner_id, created_at, expires_at) VALUES ('x4','shareexp001','analysis','la3','lu2', now(), now() - interval '1 day')"
  must_fail "duplicate (session, seq) message"       p5_legacy "INSERT INTO explanation_messages (id, session_id, seq, role, content) VALUES ('x5','ls1',1,'user','dup')"
  must_fail "message for a missing session"          p5_legacy "INSERT INTO explanation_messages (id, session_id, seq, role, content) VALUES ('x6','nosession',1,'user','c')"
  must_fail "negative AI usage"                      p5_legacy "INSERT INTO ai_usage (id, user_id, feature, day, requests) VALUES ('x7','lu1','analysis', CURRENT_DATE, -1)"
  must_fail "duplicate usage row for the same day"   p5_legacy "INSERT INTO ai_usage (id, user_id, feature, day) VALUES ('x8','lu1','analysis', CURRENT_DATE), ('x9','lu1','analysis', CURRENT_DATE)"
  must_fail "visualization for a missing user"       p5_legacy "INSERT INTO visualizations (id, user_id, title, script) VALUES ('x10','nobody','t','[]')"
  must_fail "negative visualization step count"      p5_legacy "INSERT INTO visualizations (id, user_id, title, script, step_count) VALUES ('x11','lu1','t','[]',-1)"
  must_fail "duplicate category slug"                p5_legacy "INSERT INTO categories (id, slug, label, updated_at) VALUES ('other-cat','legacy-cat','L',CURRENT_TIMESTAMP)"
  PASSED+=("database constraints reject invalid rows (11 cases)")

  # ---- C. unsafe data: the migration must refuse and change nothing ----------
  log "Duplicate token hashes must stop the migration before any change"
  cp -R packages/db/prisma "${WORK}/prisma-pre2"
  rm -rf "${WORK}/prisma-pre2/migrations/${MIG_NAME}"
  migrate_deploy p5_dup "${WORK}/prisma-pre2/schema.prisma" >/dev/null
  psql_db p5_dup -f - >/dev/null <<'SQL'
INSERT INTO users (id, email, updated_at) VALUES ('du1', 'dup@example.invalid', CURRENT_TIMESTAMP);
INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at) VALUES
  ('ds1', 'du1', 'samehash', now() + interval '1 day', now()),
  ('ds2', 'du1', 'samehash', now() + interval '1 day', now());
SQL
  if migrate_deploy p5_dup >/dev/null 2>&1; then die "Migration accepted duplicate token hashes; it must refuse."; fi
  expect_eq "refused migration left no new table behind" "$(scalar p5_dup "select count(*) from information_schema.tables where table_name='visualizations'")" "0"
  PASSED+=("migration refuses unsafe data and leaves the database unchanged")

  # ---- D. app-level tests against the migrated database ----------------------
  log "Unit, ownership and regression tests (database tests enabled)"
  export PHASE5_TEST_DATABASE_URL="$(db_url p5_empty)"
  run_check "all tests: contracts, api (incl. ownership and audit), web" pnpm test
  unset PHASE5_TEST_DATABASE_URL
fi

# =============================================================================
# 10. SUMMARY
# =============================================================================
print_list() {
  local title="$1"; shift
  printf '\n%s (%d)\n' "${title}" "$#"
  local i
  for i in "$@"; do printf '  - %s\n' "$i"; done
  return 0
}
log "Summary"
print_list "Created"   ${CREATED[@]+"${CREATED[@]}"}
print_list "Modified"  ${MODIFIED[@]+"${MODIFIED[@]}"}
print_list "Unchanged (already up to date)" ${UNCHANGED[@]+"${UNCHANGED[@]}"}
print_list "Checks that ran and passed" ${PASSED[@]+"${PASSED[@]}"}
print_list "Checks SKIPPED (not run)"   ${SKIPPED[@]+"${SKIPPED[@]}"}
printf '\nBackups of modified files: %s\n' "${BACKUP_DIR}"
printf 'Phase 5 migration: %s/%s\n' "${MIG_DIR}" "${MIG_NAME}"
printf 'Apply to your dev database yourself (never done by this script): pnpm db:migrate:deploy && pnpm db:verify:phase5\n'
printf 'Rollback notes: docs/phase5-data-model.md\n'