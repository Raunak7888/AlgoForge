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
