-- Phase 4: auth and sessions.
-- Rollback (manual): DROP INDEX "sessions_expires_at_idx"; DROP INDEX "sessions_rotated_from_id_idx";
--                    ALTER TABLE "sessions" DROP COLUMN "created_at"; ALTER TABLE "users" DROP COLUMN "last_login_at";

-- AlterTable
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "sessions_rotated_from_id_idx" ON "sessions"("rotated_from_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");
