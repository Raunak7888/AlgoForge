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
