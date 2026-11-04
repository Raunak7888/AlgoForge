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
    expect(backfill.match(/^\s*ON CONFLICT DO NOTHING\s*;/gm)?.length).toBe(3);
    expect(backfill).toMatch(
  /NOT EXISTS\s*\(\s*SELECT 1\s+FROM\s+"explanation_messages"/
);
    expect(backfill).toMatch(/"code_hash" IS NULL/);
    expect(backfill).toMatch(/"published_at" IS NULL/);
  });
  it("never deletes or updates legacy columns", () => {
    expect(backfill).not.toMatch(/\bDELETE\b/i);
    expect(backfill).not.toMatch(/UPDATE "explanation_sessions"|UPDATE "analyses" SET "share_id"|"is_public" =/i);
  });
});

describe("seed", () => {
  it("refuses to run in production", () => {
    const seed = readFileSync(path.join(prismaDir, "seed.ts"), "utf8");
    expect(seed).toMatch(/NODE_ENV === "production"/);
  });
});
