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
