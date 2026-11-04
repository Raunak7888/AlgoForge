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

  INSERT INTO "explanation_messages" ("id", "session_id", "seq", "role", "content", "intent", "created_at")
  SELECT md5(s."id" || ':' || m.ord::text),
         s."id",
         m.ord::integer,
         (m.elem ->> 'role')::"ExplanationMessageRole",
         COALESCE(m.elem ->> 'content', ''),
         m.elem ->> 'intent',
         CASE WHEN (m.elem ->> 'createdAt') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$'
              THEN ((m.elem ->> 'createdAt')::timestamptz AT TIME ZONE 'UTC')
              ELSE s."created_at" END
    FROM "explanation_sessions" s
   CROSS JOIN LATERAL jsonb_array_elements(
          CASE WHEN jsonb_typeof(s."messages") = 'array' THEN s."messages" ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS m(elem, ord)
   WHERE jsonb_typeof(m.elem) = 'object'
     AND (m.elem ->> 'role') IN ('user', 'assistant')
     AND NOT EXISTS (SELECT 1 FROM "explanation_messages" x WHERE x."session_id" = s."id")
  ON CONFLICT DO NOTHING;
END
$phase5$;
