-- Phase 1: separate visualization quota, drop unused context columns, add workspace drafts.

ALTER TYPE "AiFeature" ADD VALUE IF NOT EXISTS 'visualize';

ALTER TABLE "explanation_sessions" DROP COLUMN IF EXISTS "context_type";
ALTER TABLE "explanation_sessions" DROP COLUMN IF EXISTS "context_id";
DROP TYPE IF EXISTS "ExplanationContextType";

CREATE TABLE IF NOT EXISTS "workspace_drafts" (
    "user_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "codes" JSONB NOT NULL,
    "client_updated_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_drafts_pkey" PRIMARY KEY ("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'workspace_drafts_user_id_fkey'
  ) THEN
    ALTER TABLE "workspace_drafts"
      ADD CONSTRAINT "workspace_drafts_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;