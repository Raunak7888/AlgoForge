#!/usr/bin/env bash
# AlgoForge Phase 6: visualizer backend, algorithms catalog, saved work.
# Run from the repo root:  bash phase6.sh   (--skip-checks | --rollback)
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
BACKUP_DIR="$ROOT/.phase6-backup"
FILES_DIR="$BACKUP_DIR/files"
CREATED_LOG="$BACKUP_DIR/created.txt"
VIZ_REL="apps/web/src/components/visualizers"
PKG_REL="packages/visualizer-core"
SKIP_CHECKS=0
MODE="apply"
for arg in "$@"; do
  case "$arg" in
    --skip-checks) SKIP_CHECKS=1 ;;
    --rollback) MODE="rollback" ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
trap 'printf "\nFailed near line %s. Nothing was undone automatically. Run: bash phase6.sh --rollback\n" "$LINENO" >&2' ERR

# ───────────────────────── backup helpers ─────────────────────────
guard_path() {
  case "$1" in
    .env|*/.env|*/.env.*|.env.*) die "Refusing to touch an env file: $1" ;;
    */migrations/*|*/prisma/migrations*) die "Refusing to touch migrations: $1" ;;
    /*|*..*) die "Bad path: $1" ;;
  esac
}
record_created() {
  mkdir -p "$BACKUP_DIR"; touch "$CREATED_LOG"
  grep -qxF "$1" "$CREATED_LOG" || printf '%s\n' "$1" >> "$CREATED_LOG"
}
backup_file() {
  local rel="$1"
  mkdir -p "$BACKUP_DIR"; touch "$CREATED_LOG"
  if grep -qxF "$rel" "$CREATED_LOG"; then return 0; fi
  if [[ -e "$FILES_DIR/$rel" ]]; then return 0; fi
  if [[ -f "$ROOT/$rel" ]]; then
    mkdir -p "$(dirname "$FILES_DIR/$rel")"; cp -p "$ROOT/$rel" "$FILES_DIR/$rel"
  else
    record_created "$rel"
  fi
}
write_file() {
  local rel="$1"; guard_path "$rel"; backup_file "$rel"
  mkdir -p "$(dirname "$ROOT/$rel")"; cat > "$ROOT/$rel"
}
remove_tree() {
  local rel="$1"
  [[ -d "$ROOT/$rel" ]] || return 0
  while IFS= read -r -d '' f; do backup_file "${f#"$ROOT"/}"; done \
    < <(find "$ROOT/$rel" -type f -not -path '*/node_modules/*' -print0)
  rm -rf "$ROOT/$rel"
}

rollback() {
  [[ -d "$BACKUP_DIR" ]] || die "No backup at $BACKUP_DIR"
  log "Rolling back Phase 6"
  if [[ -f "$CREATED_LOG" ]]; then
    while IFS= read -r rel; do [[ -n "$rel" ]] && rm -f "$ROOT/$rel"; done < "$CREATED_LOG"
  fi
  if [[ -d "$FILES_DIR" ]]; then
    while IFS= read -r -d '' f; do
      rel="${f#"$FILES_DIR"/}"
      mkdir -p "$(dirname "$ROOT/$rel")"; cp -p "$f" "$ROOT/$rel"
    done < <(find "$FILES_DIR" -type f -print0)
  fi
  rm -rf "$ROOT/$PKG_REL"
  find "$ROOT/apps" "$ROOT/packages" -type d -empty -not -path '*/node_modules/*' -delete 2>/dev/null || true
  echo "Restored. Run 'pnpm install' to rebuild node_modules and the lockfile link state."
}
if [[ "$MODE" == "rollback" ]]; then rollback; exit 0; fi

# ───────────────────────── preflight ─────────────────────────
log "Preflight"
command -v node >/dev/null || die "node is required"
command -v pnpm >/dev/null || die "pnpm is required"
for f in pnpm-workspace.yaml apps/api/package.json apps/web/package.json packages/contracts/src/limits.ts \
         packages/db/prisma/schema.prisma apps/api/src/utils/capabilities.ts apps/api/src/app.ts; do
  [[ -f "$f" ]] || die "Missing $f (are Phases 1-5 applied?)"
done
grep -q "model Visualization" packages/db/prisma/schema.prisma || die "Phase 5 schema (Visualization) not found"
grep -Eq "packages/\*" pnpm-workspace.yaml || die "pnpm-workspace.yaml does not include packages/*"
if command -v git >/dev/null && [[ -d .git ]] && [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo "WARNING: git working tree is not clean. Backups go to .phase6-backup/ anyway."
fi

MOVE_LIST=(
  core/ids core/index core/opMeta.generated core/registry core/types core/validate
  core/adapters/array core/adapters/graph core/adapters/hash core/adapters/linear
  core/adapters/linkedlist core/adapters/make core/adapters/tree
  script/compile script/normalize script/parse script/schema script/suggest
  array/arrayEngine array/complexity array/types array/validate
  linear/complexity linear/engine linear/model linear/types linear/validate
  linkedlist/complexity linkedlist/engine linkedlist/model linkedlist/steps linkedlist/types linkedlist/validate
  tree/bst tree/complexity tree/engine tree/model tree/steps tree/types tree/validate
  hash/complexity hash/hashEngine hash/hashing hash/tableModel hash/types hash/validate
  graph/complexity graph/engine graph/layout graph/model graph/types graph/validate
  shared/edges shared/ids shared/stage/geometry shared/stage/tokens
)
for rel in "${MOVE_LIST[@]}"; do
  [[ -f "$VIZ_REL/$rel.ts" ]] || die "Missing $VIZ_REL/$rel.ts"
done

# ───────────────────────── 1. shared package ─────────────────────────
log "Creating $PKG_REL"

write_file "$PKG_REL/package.json" <<'__P6_FILE__'
{
  "name": "@algoforge/visualizer-core",
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
    "@algoforge/contracts": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^5.0.5"
  }
}
__P6_FILE__

write_file "$PKG_REL/tsconfig.json" <<'__P6_FILE__'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
__P6_FILE__

write_file "$PKG_REL/vitest.config.ts" <<'__P6_FILE__'
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { environment: "node", include: ["src/**/*.test.ts"] } });
__P6_FILE__

write_file "$PKG_REL/src/index.ts" <<'__P6_FILE__'
/**
 * The one visualizer compiler. Pure TypeScript: no DOM, no React, no Node APIs.
 * The browser (editor, canvas) and the API (validation on save) both import it,
 * so a script that compiles in one place compiles identically in the other.
 */
export { compileScript, compileValue, LIMITS as COMPILER_LIMITS } from "./script/compile";
export type { Beat, Compiled, Frame, InstanceMeta } from "./script/compile";
export { buildScriptSchema } from "./script/schema";
export { DS_NAMES, DS_TYPES, findDsType, opsOf } from "./core/registry";
export type { Diagnostic } from "./core/types";
export { analyzeScript, MAX_SCRIPT_CHARS, SCRIPT_SCHEMA_VERSION } from "./analyze";
export type { ScriptAnalysis, ScriptStructure } from "./analyze";
export { CATALOG_SCRIPTS, CATALOG_SLUGS } from "./catalog-scripts";
__P6_FILE__

write_file "$PKG_REL/src/analyze.ts" <<'__P6_FILE__'
import { LIMITS as CONTRACT_LIMITS } from "@algoforge/contracts/src/limits";
import type { Diagnostic } from "./core/types";
import { compileScript } from "./script/compile";

/** Bump when the script format changes in a way old stored scripts cannot be read. */
export const SCRIPT_SCHEMA_VERSION = 1;
/** Same number the API validators and the capabilities endpoint use. */
export const MAX_SCRIPT_CHARS: number = CONTRACT_LIMITS.script.maxChars;

export interface ScriptStructure {
  id: string;
  ds: string;
  label: string;
}

export interface ScriptAnalysis {
  /** False when there is at least one error. A rejected operation is only a warning. */
  ok: boolean;
  stepCount: number;
  structures: ScriptStructure[];
  diagnostics: Diagnostic[];
}

/** Compile a script and summarize it. A script with no steps is not storable, so it is an error here. */
export function analyzeScript(text: string): ScriptAnalysis {
  const compiled = compileScript(text);
  const diagnostics: Diagnostic[] = [...compiled.diagnostics];
  if (compiled.ok && compiled.frames.length === 0) {
    diagnostics.push({
      severity: "error",
      message: "The script has no steps. Add at least one operation.",
      line: 1,
      column: 1,
      endLine: 1,
      endColumn: 2,
    });
  }
  return {
    ok: !diagnostics.some((d) => d.severity === "error"),
    stepCount: compiled.frames.length,
    structures: compiled.instances.map((i) => ({ id: i.id, ds: i.ds, label: i.label })),
    diagnostics,
  };
}
__P6_FILE__

write_file "$PKG_REL/src/catalog-scripts.ts" <<'__P6_FILE__'
type Entry = Readonly<Record<string, unknown>>;
const json = (entries: readonly Entry[]): string => JSON.stringify(entries, null, 2);

const ORANGE = "#FF430F";
const GREEN = "#17A34A";

const bubbleSort = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 3, 8, 1] },
  { step: 1, message: "Bubble sort compares neighbours and swaps them when they are in the wrong order." },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 2, message: "5 > 3, so swap them." },
  { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
  { step: 3, message: "8 > 1, so swap them." },
  { step: 4, id: "A", op: "swap", indexA: 1, indexB: 2 },
  { step: 4, message: "5 > 1, so swap them." },
  { step: 5, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 5, message: "3 > 1, so swap them. The array is sorted." },
]);

const mergeSort = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [5, 2, 4, 1] },
  { step: 1, message: "Merge sort splits the array, sorts the halves and merges them." },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
  { step: 2, message: "Merge [5] and [2]: 2 comes first." },
  { step: 3, id: "A", op: "swap", indexA: 2, indexB: 3 },
  { step: 3, message: "Merge [4] and [1]: 1 comes first." },
  { step: 4, id: "B", ds: "array", op: "append", value: 1 },
  { step: 4, message: "Merge [2, 5] and [1, 4] into B. Compare 2 and 1: take 1." },
  { step: 5, id: "B", op: "append", value: 2 },
  { step: 5, message: "Compare 2 and 4: take 2." },
  { step: 6, id: "B", op: "append", value: 4 },
  { step: 6, message: "Compare 5 and 4: take 4." },
  { step: 7, id: "B", op: "append", value: 5 },
  { step: 7, message: "Only 5 is left. B is sorted." },
]);

const linearSearch = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [4, 8, 15, 16] },
  { step: 1, message: "Find 15. Check each element in turn." },
  { step: 2, id: "A", op: "highlight", index: 0, color: ORANGE },
  { step: 2, message: "4 is not 15." },
  { step: 3, id: "A", op: "highlight", index: 1, color: ORANGE },
  { step: 3, message: "8 is not 15." },
  { step: 4, id: "A", op: "highlight", index: 2, color: GREEN },
  { step: 4, message: "15 found at index 2." },
]);

const binarySearch = json([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 3, 5, 7, 9, 11] },
  { step: 1, id: "A", op: "createMark", name: "lo", index: 0 },
  { step: 1, id: "A", op: "createMark", name: "hi", index: 5 },
  { step: 1, message: "Find 9. lo and hi mark the part of the array still in play." },
  { step: 2, id: "A", op: "highlight", index: 2, color: ORANGE },
  { step: 2, message: "mid = 2 holds 5. 5 < 9, so move lo to mid + 1." },
  { step: 3, id: "A", op: "moveMarkTo", index: 3, name: "lo" },
  { step: 3, id: "A", op: "clearHighlight" },
  { step: 3, message: "lo is now 3, so mid = 4." },
  { step: 4, id: "A", op: "highlight", index: 4, color: GREEN },
  { step: 4, message: "mid = 4 holds 9. Found." },
]);

const graphSetup: Entry[] = [
  { step: 1, id: "G", ds: "graph", op: "addVertex", value: ["A", "B", "C", "D", "E"] },
  { step: 1, message: "A graph with five vertices: A, B, C, D, E." },
  { step: 2, id: "G", op: "addEdge", sourceId: "v1", targetId: "v2" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v1", targetId: "v3" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v2", targetId: "v4" },
  { step: 2, id: "G", op: "addEdge", sourceId: "v3", targetId: "v5" },
  { step: 2, message: "A is joined to B and C. B is joined to D. C is joined to E." },
];

const bfs = json([
  ...graphSetup,
  { step: 3, id: "Q", ds: "queue", op: "enqueue", value: "A" },
  { step: 3, id: "G", op: "highlight", color: ORANGE, vertexId: "v1" },
  { step: 3, message: "Start at A. Put it in the queue." },
  { step: 4, id: "Q", op: "dequeue" },
  { step: 4, id: "G", op: "highlight", color: GREEN, vertexId: "v1" },
  { step: 4, id: "Q", op: "enqueue", value: ["B", "C"] },
  { step: 4, message: "Visit A. Queue its neighbours B and C." },
  { step: 5, id: "Q", op: "dequeue" },
  { step: 5, id: "G", op: "highlight", color: GREEN, vertexId: "v2" },
  { step: 5, id: "Q", op: "enqueue", value: "D" },
  { step: 5, message: "Visit B. Queue D." },
  { step: 6, id: "Q", op: "dequeue" },
  { step: 6, id: "G", op: "highlight", color: GREEN, vertexId: "v3" },
  { step: 6, id: "Q", op: "enqueue", value: "E" },
  { step: 6, message: "Visit C. Queue E." },
  { step: 7, id: "Q", op: "dequeue" },
  { step: 7, id: "G", op: "highlight", color: GREEN, vertexId: "v4" },
  { step: 7, message: "Visit D." },
  { step: 8, id: "Q", op: "dequeue" },
  { step: 8, id: "G", op: "highlight", color: GREEN, vertexId: "v5" },
  { step: 8, message: "Visit E. The queue is empty, so the search is done." },
]);

const dfs = json([
  ...graphSetup,
  { step: 3, id: "S", ds: "stack", op: "push", value: "A" },
  { step: 3, id: "G", op: "highlight", color: ORANGE, vertexId: "v1" },
  { step: 3, message: "Start at A. Push it on the stack." },
  { step: 4, id: "S", op: "pop" },
  { step: 4, id: "G", op: "highlight", color: GREEN, vertexId: "v1" },
  { step: 4, id: "S", op: "push", value: ["C", "B"] },
  { step: 4, message: "Visit A. Push C, then B, so B is on top." },
  { step: 5, id: "S", op: "pop" },
  { step: 5, id: "G", op: "highlight", color: GREEN, vertexId: "v2" },
  { step: 5, id: "S", op: "push", value: "D" },
  { step: 5, message: "Visit B. Push D. Go deep first." },
  { step: 6, id: "S", op: "pop" },
  { step: 6, id: "G", op: "highlight", color: GREEN, vertexId: "v4" },
  { step: 6, message: "Visit D. It has no new neighbours, so back up." },
  { step: 7, id: "S", op: "pop" },
  { step: 7, id: "G", op: "highlight", color: GREEN, vertexId: "v3" },
  { step: 7, id: "S", op: "push", value: "E" },
  { step: 7, message: "Visit C. Push E." },
  { step: 8, id: "S", op: "pop" },
  { step: 8, id: "G", op: "highlight", color: GREEN, vertexId: "v5" },
  { step: 8, message: "Visit E. The stack is empty, so the search is done." },
]);

/** Visualizer scripts of the seeded catalog, keyed by algorithm slug. */
export const CATALOG_SCRIPTS: Readonly<Record<string, string>> = {
  "bubble-sort": bubbleSort,
  "merge-sort": mergeSort,
  "linear-search": linearSearch,
  "binary-search": binarySearch,
  "breadth-first-search": bfs,
  "depth-first-search": dfs,
};

export const CATALOG_SLUGS: readonly string[] = Object.keys(CATALOG_SCRIPTS);
__P6_FILE__

write_file "$PKG_REL/src/analyze.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { LIMITS as CONTRACT } from "@algoforge/contracts/src/limits";
import { analyzeScript, CATALOG_SCRIPTS, CATALOG_SLUGS, COMPILER_LIMITS, MAX_SCRIPT_CHARS } from "./index";

const good = JSON.stringify([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [3, 1, 2] },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("analyzeScript", () => {
  it("accepts a valid script and reports its shape", () => {
    const a = analyzeScript(good);
    expect(a.ok).toBe(true);
    expect(a.stepCount).toBe(2);
    expect(a.structures).toEqual([{ id: "A", ds: "array", label: "Array" }]);
  });

  it("reports errors with a position and a suggestion", () => {
    const a = analyzeScript(JSON.stringify([{ step: 1, id: "A", ds: "array", op: "apend", value: 1 }]));
    expect(a.ok).toBe(false);
    const err = a.diagnostics.find((d) => d.severity === "error");
    expect(err?.line).toBeGreaterThan(0);
    expect(err?.message).toContain("append");
  });

  it("treats a rejected operation as a warning, not an error", () => {
    const a = analyzeScript(
      JSON.stringify([
        { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] },
        { step: 2, id: "A", op: "swap", indexA: 0, indexB: 9 },
      ]),
    );
    expect(a.ok).toBe(true);
    expect(a.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("rejects invalid JSON and an empty script", () => {
    expect(analyzeScript("{ nope").ok).toBe(false);
    expect(analyzeScript("[]").ok).toBe(false);
  });

  it("uses the size limit from the contracts package", () => {
    expect(COMPILER_LIMITS.chars).toBe(CONTRACT.script.maxChars);
    expect(MAX_SCRIPT_CHARS).toBe(CONTRACT.script.maxChars);
    expect(analyzeScript(" ".repeat(MAX_SCRIPT_CHARS + 1)).ok).toBe(false);
  });
});

describe("catalog scripts", () => {
  it("covers the six seeded algorithms", () => {
    expect([...CATALOG_SLUGS].sort()).toEqual(
      ["binary-search", "breadth-first-search", "bubble-sort", "depth-first-search", "linear-search", "merge-sort"],
    );
  });
  for (const slug of CATALOG_SLUGS) {
    it(`${slug} compiles with no errors or warnings`, () => {
      const a = analyzeScript(CATALOG_SCRIPTS[slug]);
      expect(a.diagnostics).toEqual([]);
      expect(a.ok).toBe(true);
      expect(a.stepCount).toBeGreaterThan(0);
    });
  }
});
__P6_FILE__

# Move the pure visualizer files into the package. Old paths become one-line re-exports,
# so every existing import and test in the web app keeps working.
log "Moving pure visualizer code into the package"
for rel in "${MOVE_LIST[@]}"; do
  srcrel="$VIZ_REL/$rel.ts"
  dstrel="$PKG_REL/src/$rel.ts"
  shim="export * from \"@algoforge/visualizer-core/src/$rel\";"
  if [[ -f "$srcrel" && "$(cat "$srcrel")" == "$shim" ]]; then continue; fi
  [[ ! -f "$dstrel" ]] || die "$dstrel exists but $srcrel is not a shim"
  backup_file "$srcrel"
  mkdir -p "$(dirname "$dstrel")"
  cp "$srcrel" "$dstrel"; record_created "$dstrel"
  printf '%s\n' "$shim" > "$srcrel"
done

# ───────────────────────── 2. contracts ─────────────────────────
log "Contracts"

write_file "packages/contracts/src/algorithms.ts" <<'__P6_FILE__'
import { z } from "zod";
import { CursorSchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ComplexitySummarySchema = z.object({
  timeBest: z.string().nullable(),
  timeAverage: z.string().nullable(),
  timeWorst: z.string().nullable(),
  space: z.string().nullable(),
});

export const TagSchema = z.object({ id: z.string(), label: z.string() });
export const DisplayCodeSchema = z.object({ language: z.string(), code: z.string() });

export const AlgorithmSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  categoryId: z.string(),
  categoryLabel: z.string(),
  difficulty: DifficultySchema,
  complexity: ComplexitySummarySchema.nullable(),
  tags: z.array(TagSchema),
});

/** `script` is the visualizer script (JSON text). It replaces the old executable `forge` config. */
export const AlgorithmDetailResponseSchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  difficulty: DifficultySchema,
  categoryId: z.string(),
  categoryLabel: z.string(),
  isPublished: z.boolean(),
  complexity: ComplexitySummarySchema.nullable(),
  displayCode: DisplayCodeSchema.nullable(),
  displayCodes: z.array(DisplayCodeSchema),
  tags: z.array(TagSchema),
  script: z.string().nullable(),
  scriptVersion: z.number().int().min(1),
});

export const AlgorithmListResponseSchema = paginatedResponse(AlgorithmSummarySchema);

export const AlgorithmExecutionResponseSchema = z.object({
  algorithmId: z.string(),
  name: z.string(),
  script: z.string(),
  scriptVersion: z.number().int().min(1),
});

export const AlgorithmListQuerySchema = z.object({
  q: z.string().max(LIMITS.search.maxQueryChars).optional().describe("Search name, description and tags."),
  search: z.string().max(LIMITS.search.maxQueryChars).optional().describe("Deprecated alias of q."),
  categoryId: z.string().optional(),
  difficulty: DifficultySchema.optional(),
  tag: z.string().max(50).optional(),
  isPublished: z.enum(["true", "false"]).optional().describe("Honoured for admins only; everyone else sees published algorithms."),
  limit: z.number().int().min(1).max(LIMITS.pagination.algorithms.maxSize).optional().describe(`Page size. Default ${LIMITS.pagination.algorithms.defaultSize}.`),
  cursor: CursorSchema.optional().describe("Opaque cursor: meta.nextCursor of the previous page."),
});
export const AlgorithmLangQuerySchema = z.object({ lang: z.string().optional() });

const ComplexityInputSchema = z.object({
  time: z.object({ best: z.string().min(1), average: z.string().min(1), worst: z.string().min(1) }),
  space: z.string().min(1),
});
const ScriptSchema = z.string().min(1).max(LIMITS.script.maxChars);
const SlugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/);

export const CreateAlgorithmRequestSchema = z.object({
  slug: SlugSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  categoryId: z.string().min(1),
  difficulty: DifficultySchema.optional(),
  isPublished: z.boolean().optional(),
  complexity: ComplexityInputSchema,
  displayCodes: z.array(DisplayCodeSchema).min(1),
  script: ScriptSchema.optional().describe("Visualizer script. Required before an algorithm can be published."),
  tags: z.array(z.string().min(1)).optional(),
});

export const UpdateAlgorithmRequestSchema = z.object({
  slug: SlugSchema.optional(),
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
  script: ScriptSchema.nullable().optional(),
  tags: z.array(z.string().min(1)).optional(),
});

export type AlgorithmSummary = z.infer<typeof AlgorithmSummarySchema>;
export type AlgorithmDetailResponse = z.infer<typeof AlgorithmDetailResponseSchema>;
export type AlgorithmListResponse = z.infer<typeof AlgorithmListResponseSchema>;
export type AlgorithmExecutionResponse = z.infer<typeof AlgorithmExecutionResponseSchema>;
export type AlgorithmListQuery = z.input<typeof AlgorithmListQuerySchema>;
export type CreateAlgorithmRequest = z.infer<typeof CreateAlgorithmRequestSchema>;
export type UpdateAlgorithmRequest = z.infer<typeof UpdateAlgorithmRequestSchema>;
__P6_FILE__

write_file "packages/contracts/src/visualizations.ts" <<'__P6_FILE__'
import { z } from "zod";
import { AnalysisLanguageSchema } from "@algoforge/analysis";
import { IsoDateTimeSchema, pageQuerySchema, paginatedResponse } from "./common";
import { LIMITS } from "./limits";

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
export const VisualizationListQuerySchema = pageQuerySchema(LIMITS.pagination.visualizations);

const ScriptSchema = z.string().min(1).max(LIMITS.script.maxChars);

export const CreateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars),
  description: z.string().max(2000).optional(),
  script: ScriptSchema,
  code: z.string().max(LIMITS.code.maxChars).optional(),
  language: AnalysisLanguageSchema.optional(),
});
/** Every field is optional; null clears description, code or language. */
export const UpdateVisualizationRequestSchema = z.object({
  title: z.string().trim().min(1).max(LIMITS.title.maxChars).optional(),
  description: z.string().max(2000).nullable().optional(),
  script: ScriptSchema.optional(),
  code: z.string().max(LIMITS.code.maxChars).nullable().optional(),
  language: AnalysisLanguageSchema.nullable().optional(),
});
export const ValidateScriptRequestSchema = z.object({ script: ScriptSchema });
export const ValidateScriptResponseSchema = z.object({
  ok: z.boolean(),
  stepCount: z.number().int().min(0),
  structures: z.array(VisualizationStructureSchema),
  diagnostics: z.array(DiagnosticSchema),
});

export type Visualization = z.infer<typeof VisualizationSchema>;
export type VisualizationSummary = z.infer<typeof VisualizationSummarySchema>;
export type VisualizationListResponse = z.infer<typeof VisualizationListResponseSchema>;
export type CreateVisualizationRequest = z.infer<typeof CreateVisualizationRequestSchema>;
export type UpdateVisualizationRequest = z.infer<typeof UpdateVisualizationRequestSchema>;
export type ValidateScriptResponse = z.infer<typeof ValidateScriptResponseSchema>;
__P6_FILE__

write_file "packages/contracts/src/search.ts" <<'__P6_FILE__'
import { z } from "zod";
import { LIMITS } from "./limits";

export const SearchResultSchema = z.object({
  type: z.enum(["algorithm", "visualization"]),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  href: z.string(),
});
export const SearchResponseSchema = z.object({ data: z.array(SearchResultSchema) });
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(LIMITS.search.maxQueryChars).describe("Search text."),
});

export type SearchResult = z.infer<typeof SearchResultSchema>;
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
__P6_FILE__

write_file "packages/contracts/src/phase6.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import {
  AlgorithmListQuerySchema,
  CreateAlgorithmRequestSchema,
  CreateVisualizationRequestSchema,
  LIMITS,
  SearchQuerySchema,
  UpdateAlgorithmRequestSchema,
  UpdateVisualizationRequestSchema,
  routes,
} from "./index";

const algorithm = {
  slug: "bubble-sort",
  name: "Bubble Sort",
  description: "Swaps neighbours.",
  categoryId: "sorting",
  complexity: { time: { best: "O(n)", average: "O(n^2)", worst: "O(n^2)" }, space: "O(1)" },
  displayCodes: [{ language: "javascript", code: "x" }],
};

describe("phase 6 contracts", () => {
  it("keeps the JSON body limit large enough for the biggest script", () => {
    expect(LIMITS.body.jsonMaxBytes).toBeGreaterThanOrEqual(LIMITS.script.maxChars * 4);
  });

  it("accepts a script at the limit and rejects one above it", () => {
    const base = { title: "t" };
    expect(CreateVisualizationRequestSchema.safeParse({ ...base, script: "x".repeat(LIMITS.script.maxChars) }).success).toBe(true);
    expect(CreateVisualizationRequestSchema.safeParse({ ...base, script: "x".repeat(LIMITS.script.maxChars + 1) }).success).toBe(false);
  });

  it("lets an update clear description, code and language", () => {
    expect(UpdateVisualizationRequestSchema.safeParse({ description: null, code: null, language: null }).success).toBe(true);
  });

  it("creates and updates algorithms with a script and no forge", () => {
    expect(CreateAlgorithmRequestSchema.safeParse({ ...algorithm, script: "[]" }).success).toBe(true);
    expect(CreateAlgorithmRequestSchema.safeParse(algorithm).success).toBe(true);
    expect(UpdateAlgorithmRequestSchema.safeParse({ script: null }).success).toBe(true);
    expect("forge" in CreateAlgorithmRequestSchema.shape).toBe(false);
  });

  it("limits catalog page size", () => {
    expect(AlgorithmListQuerySchema.safeParse({ limit: LIMITS.pagination.algorithms.maxSize + 1 }).success).toBe(false);
    expect(AlgorithmListQuerySchema.safeParse({ q: "sort", limit: 10 }).success).toBe(true);
  });

  it("requires a search term", () => {
    expect(SearchQuerySchema.safeParse({ q: "   " }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: "bfs" }).success).toBe(true);
  });

  it("documents the new endpoints", () => {
    const keys = new Set(routes.map((r) => `${r.method} ${r.path}`));
    for (const k of [
      "get /api/visualizations",
      "post /api/visualizations",
      "post /api/visualizations/validate",
      "get /api/visualizations/{id}",
      "patch /api/visualizations/{id}",
      "delete /api/visualizations/{id}",
      "get /api/search",
    ]) expect(keys.has(k)).toBe(true);
  });
});
__P6_FILE__

# ───────────────────────── 3. API ─────────────────────────
log "API files"

write_file "apps/api/src/types/algorithm.types.ts" <<'__P6_FILE__'
// Shared types for the algorithm service modules.

export type AlgorithmQuery = {
  categoryId?: string;
  difficulty?: string;
  isPublished?: boolean;
  /** Matches name, description and tag labels. */
  search?: string;
  tag?: string;
  limit: number;
  /** Id of the last row of the previous page. */
  cursor?: string;
};

/** Who is asking. Non-admins can only ever see published algorithms. */
export type AlgorithmVisibility = {
  isAdmin: boolean;
};
__P6_FILE__

write_file "apps/api/src/repositories/algorithm.repository.ts" <<'__P6_FILE__'
//# filename: apps/api/src/repositories/algorithm.repository.ts

import { prisma, Prisma } from "@algoforge/db";
import type { Difficulty } from "@algoforge/db";

const listSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  categoryId: true,
  category: { select: { label: true } },
  difficulty: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
  tags: { select: { tag: { select: { id: true, label: true } } } },
} as const;

const detailSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  difficulty: true,
  categoryId: true,
  category: { select: { label: true } },
  isPublished: true,
  publishedAt: true,
  timeBest: true,
  timeAverage: true,
  timeWorst: true,
  spaceComplexity: true,
  script: true,
  scriptVersion: true,
  displayCodes: { select: { language: true, code: true } },
  tags: { select: { tag: { select: { id: true, label: true } } } },
} as const;

export type AlgorithmListRow = Awaited<ReturnType<typeof algorithmRepository.findPage>>[number];
export type AlgorithmDetailRow = Awaited<ReturnType<typeof algorithmRepository.findById>>;

export const algorithmRepository = {
  /** Stable order (sortOrder, name, id). `take` should be limit + 1 to detect a next page. */
  findPage(where: Prisma.AlgorithmWhereInput, opts: { take: number; cursor?: string }) {
    return prisma.algorithm.findMany({
      where,
      select: listSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: opts.take,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
  },

  /** Published algorithms matching a search term (name, description or tag). Used by GET /api/search. */
  searchPublished(term: string, take: number) {
    const mode = Prisma.QueryMode.insensitive;
    return prisma.algorithm.findMany({
      where: {
        isPublished: true,
        OR: [
          { name: { contains: term, mode } },
          { description: { contains: term, mode } },
          { tags: { some: { tag: { label: { contains: term, mode } } } } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take,
      select: { id: true, slug: true, name: true, description: true },
    });
  },

  findById(id: string) {
    return prisma.algorithm.findUnique({ where: { id }, select: detailSelect });
  },

  findBySlug(slug: string) {
    return prisma.algorithm.findUnique({ where: { slug }, select: detailSelect });
  },

  findBySlugExists(slug: string) {
    return prisma.algorithm.findUnique({ where: { slug }, select: { id: true } });
  },

  create(data: {
    slug: string;
    name: string;
    description: string;
    categoryId: string;
    difficulty: Difficulty;
    isPublished: boolean;
    publishedAt?: Date | null;
    createdById?: string | null;
    timeBest: string | null;
    timeAverage: string | null;
    timeWorst: string | null;
    spaceComplexity: string | null;
    displayCodes: { language: string; code: string }[];
    script: string | null;
    scriptVersion: number;
    tags: string[];
  }) {
    return prisma.algorithm.create({
      data: {
        slug: data.slug,
        publishedAt: data.publishedAt ?? null,
        createdById: data.createdById ?? null,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        difficulty: data.difficulty,
        isPublished: data.isPublished,
        timeBest: data.timeBest,
        timeAverage: data.timeAverage,
        timeWorst: data.timeWorst,
        spaceComplexity: data.spaceComplexity,
        script: data.script,
        scriptVersion: data.scriptVersion,
        displayCodes: { create: data.displayCodes },
        tags: {
          create: data.tags.map((label) => ({
            tag: { connectOrCreate: { where: { label }, create: { label } } },
          })),
        },
      },
      select: detailSelect,
    });
  },

  update(
    id: string,
    data: Prisma.AlgorithmUpdateInput & {
      displayCodes?: { language: string; code: string }[];
      tags?: string[];
    },
  ) {
    const { displayCodes, tags, ...rest } = data;

    return prisma.$transaction(async (tx) => {
      if (displayCodes) {
        await tx.displayCode.deleteMany({ where: { algorithmId: id } });
        await tx.displayCode.createMany({
          data: displayCodes.map((dc) => ({ ...dc, algorithmId: id })),
        });
      }

      if (tags) {
        await tx.algorithmTag.deleteMany({ where: { algorithmId: id } });
        for (const label of tags) {
          const tag = await tx.tag.upsert({ where: { label }, create: { label }, update: {} });
          await tx.algorithmTag.create({ data: { algorithmId: id, tagId: tag.id } });
        }
      }

      return tx.algorithm.update({ where: { id }, data: rest, select: detailSelect });
    });
  },

  delete(id: string) {
    return prisma.algorithm.delete({ where: { id } });
  },
};
__P6_FILE__

write_file "apps/api/src/serializers/algorithm.ts" <<'__P6_FILE__'
import {
  AlgorithmDetailResponseSchema,
  AlgorithmSummarySchema,
  type AlgorithmDetailResponse,
  type AlgorithmSummary,
} from "@algoforge/contracts";
import type { AlgorithmDetailRow, AlgorithmListRow } from "../repositories/algorithm.repository";

interface ComplexityFields {
  timeBest: string | null;
  timeAverage: string | null;
  timeWorst: string | null;
  spaceComplexity: string | null;
}

function complexityOf(row: ComplexityFields) {
  return row.timeBest || row.timeAverage || row.timeWorst || row.spaceComplexity
    ? { timeBest: row.timeBest, timeAverage: row.timeAverage, timeWorst: row.timeWorst, space: row.spaceComplexity }
    : null;
}

export function serializeAlgorithmSummary(row: AlgorithmListRow): AlgorithmSummary {
  return AlgorithmSummarySchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryId: row.categoryId,
    categoryLabel: row.category.label,
    difficulty: row.difficulty,
    complexity: complexityOf(row),
    tags: row.tags.map((t) => t.tag),
  });
}

/**
 * Display code priority: requested language, then javascript, then the first one.
 * `displayCodes` always lists every language so the page can offer a switch.
 */
function pickDisplayCode(codes: { language: string; code: string }[], lang?: string) {
  if (!codes.length) return null;
  const preferred = lang ?? "javascript";
  return codes.find((c) => c.language === preferred) ?? codes.find((c) => c.language === "javascript") ?? codes[0];
}

export function serializeAlgorithmDetail(row: NonNullable<AlgorithmDetailRow>, lang?: string): AlgorithmDetailResponse {
  return AlgorithmDetailResponseSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    difficulty: row.difficulty,
    categoryId: row.categoryId,
    categoryLabel: row.category.label,
    isPublished: row.isPublished,
    complexity: complexityOf(row),
    displayCode: pickDisplayCode(row.displayCodes, lang),
    displayCodes: row.displayCodes,
    tags: row.tags.map((t) => t.tag),
    script: row.script,
    scriptVersion: row.scriptVersion,
  });
}
__P6_FILE__

write_file "apps/api/src/services/algorithm/query.service.ts" <<'__P6_FILE__'
/**
 * Lists and searches algorithms (cursor pagination).
 * Non-admins only ever see published algorithms, whatever filters they send.
 * Results are cached per visibility scope; any mutation bumps the namespace version.
 */
import { Prisma, Difficulty } from "@algoforge/db";
import type { AlgorithmSummary, PageMeta } from "@algoforge/contracts";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { serializeAlgorithmSummary } from "../../serializers/algorithm";
import { paginate } from "../../utils/pagination";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmQuery, AlgorithmVisibility } from "../../types/algorithm.types";

export interface AlgorithmPage {
  items: AlgorithmSummary[];
  meta: PageMeta;
}

export async function listAlgorithms(query: AlgorithmQuery, visibility: AlgorithmVisibility): Promise<AlgorithmPage> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const effective: AlgorithmQuery = visibility.isAdmin ? query : { ...query, isPublished: true };

  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.list(version, scope, effective);
  const cached = await layeredCache.get<AlgorithmPage>(key);
  if (cached) return cached;

  const rows = await algorithmRepository.findPage(buildWhere(effective), {
    take: effective.limit + 1,
    ...(effective.cursor ? { cursor: effective.cursor } : {}),
  });
  const { items, meta } = paginate(rows, effective.limit, (row) => row.id);
  const page: AlgorithmPage = { items: items.map(serializeAlgorithmSummary), meta };

  await layeredCache.set(key, page);
  return page;
}

function buildWhere(query: AlgorithmQuery): Prisma.AlgorithmWhereInput {
  const mode = Prisma.QueryMode.insensitive;
  const term = query.search?.trim();
  return {
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.difficulty ? { difficulty: query.difficulty as Difficulty } : {}),
    ...(query.isPublished !== undefined ? { isPublished: query.isPublished } : {}),
    ...(query.tag ? { tags: { some: { tag: { label: { equals: query.tag, mode } } } } } : {}),
    ...(term
      ? {
          OR: [
            { name: { contains: term, mode } },
            { description: { contains: term, mode } },
            { tags: { some: { tag: { label: { contains: term, mode } } } } },
          ],
        }
      : {}),
  };
}
__P6_FILE__

write_file "apps/api/src/services/algorithm/detail.service.ts" <<'__P6_FILE__'
/**
 * Fetches a single algorithm by id or slug.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 * Each (scope + id/slug + language) combination gets its own cache entry.
 */
import type { AlgorithmDetailResponse } from "@algoforge/contracts";
import { algorithmRepository, type AlgorithmDetailRow } from "../../repositories/algorithm.repository";
import { serializeAlgorithmDetail } from "../../serializers/algorithm";
import { layeredCache } from "../lib/layered-cache";
import { getCacheVersion } from "../lib/cache-version";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import type { AlgorithmVisibility } from "../../types/algorithm.types";

function visibleTo(row: AlgorithmDetailRow, visibility: AlgorithmVisibility): row is NonNullable<AlgorithmDetailRow> {
  return row !== null && (visibility.isAdmin || row.isPublished);
}

export async function getAlgorithmById(
  id: string,
  lang: string | undefined,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmDetailResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.byId(version, scope, id, lang);
  const cached = await layeredCache.get<AlgorithmDetailResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

  const result = serializeAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}

export async function getAlgorithmBySlug(
  slug: string,
  lang: string | undefined,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmDetailResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.bySlug(version, scope, slug, lang);
  const cached = await layeredCache.get<AlgorithmDetailResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findBySlug(slug);
  if (!visibleTo(row, visibility)) throw AppError.notFound("Algorithm not found.");

  const result = serializeAlgorithmDetail(row, lang);
  await layeredCache.set(key, result);
  return result;
}
__P6_FILE__

write_file "apps/api/src/services/algorithm/viz.service.ts" <<'__P6_FILE__'
/**
 * Returns the visualizer script of an algorithm.
 * Unpublished algorithms are invisible (404) to everyone but admins.
 */
import { AlgorithmExecutionResponseSchema, type AlgorithmExecutionResponse } from "@algoforge/contracts";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { ALGO_CACHE_NAMESPACE, algorithmCacheKeys } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { getCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import type { AlgorithmVisibility } from "../../types/algorithm.types";

export async function getAlgorithmVisualization(
  id: string,
  visibility: AlgorithmVisibility,
): Promise<AlgorithmExecutionResponse> {
  const scope = visibility.isAdmin ? "admin" : "public";
  const version = await getCacheVersion(ALGO_CACHE_NAMESPACE);
  const key = algorithmCacheKeys.viz(version, scope, id);
  const cached = await layeredCache.get<AlgorithmExecutionResponse>(key);
  if (cached) return cached;

  const row = await algorithmRepository.findById(id);
  if (!row || (!visibility.isAdmin && !row.isPublished)) {
    throw AppError.notFound("Algorithm not found.");
  }
  if (!row.script) throw AppError.notFound("This algorithm has no visualizer script.");

  const result = AlgorithmExecutionResponseSchema.parse({
    algorithmId: row.id,
    name: row.name,
    script: row.script,
    scriptVersion: row.scriptVersion,
  });

  await layeredCache.set(key, result);
  return result;
}
__P6_FILE__

write_file "apps/api/src/services/algorithm/mutation.service.ts" <<'__P6_FILE__'
import { Prisma, Difficulty } from "@algoforge/db";
import type { AlgorithmDetailResponse, CreateAlgorithmRequest, UpdateAlgorithmRequest } from "@algoforge/contracts";
import { SCRIPT_SCHEMA_VERSION } from "@algoforge/visualizer-core";
import { algorithmRepository } from "../../repositories/algorithm.repository";
import { categoryRepository } from "../../repositories/category.repository";
import { serializeAlgorithmDetail } from "../../serializers/algorithm";
import { ALGO_CACHE_NAMESPACE } from "./cache-keys";
import { AppError } from "../../utils/app-error";
import { bumpCacheVersion } from "../lib/cache-version";
import { layeredCache } from "../lib/layered-cache";
import { assertValidScript } from "../script.service";

const NEEDS_SCRIPT = "A published algorithm needs a visualizer script.";

export async function createAlgorithm(input: CreateAlgorithmRequest, actorId?: string): Promise<AlgorithmDetailResponse> {
  const script = input.script ?? null;
  if (script !== null) assertValidScript(script);
  const isPublished = input.isPublished ?? false;
  if (isPublished && script === null) throw AppError.badRequest(NEEDS_SCRIPT);

  const category = await resolveCategory(input.categoryId);
  const created = await algorithmRepository.create({
    ...toCreateData(input, category.id, script),
    publishedAt: isPublished ? new Date() : null,
    createdById: actorId ?? null,
  });
  await bustCache();
  return serializeAlgorithmDetail(created);
}

export async function updateAlgorithm(id: string, input: UpdateAlgorithmRequest): Promise<AlgorithmDetailResponse> {
  const existing = await algorithmRepository.findById(id);
  if (!existing) throw AppError.notFound("Algorithm not found.");

  if (typeof input.script === "string") assertValidScript(input.script);
  const script = input.script !== undefined ? input.script : existing.script;
  const willBePublished = input.isPublished ?? existing.isPublished;
  if (willBePublished && !script) throw AppError.badRequest(NEEDS_SCRIPT);

  const categoryId = input.categoryId ? (await resolveCategory(input.categoryId)).id : undefined;

  const updated = await algorithmRepository.update(id, {
    ...toUpdateData(input, null, categoryId),
    // First publication time: set when a draft becomes published, never rewritten afterwards.
    ...(input.isPublished === true && !existing.isPublished ? { publishedAt: new Date() } : {}),
  });
  await bustCache();
  return serializeAlgorithmDetail(updated);
}

export async function deleteAlgorithm(id: string): Promise<void> {
  const existing = await algorithmRepository.findById(id);
  if (!existing) throw AppError.notFound("Algorithm not found.");

  await algorithmRepository.delete(id);
  await bustCache();
}

/**
 * Invalidates every cached algorithm view on every instance by bumping the namespace version.
 * `meta:slugs` (used by the AI query processor) is a plain key and is deleted explicitly.
 */
async function bustCache(): Promise<void> {
  await bumpCacheVersion(ALGO_CACHE_NAMESPACE);
  await layeredCache.del("meta:slugs");
}

function toCreateData(input: CreateAlgorithmRequest, categoryId: string, script: string | null) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    categoryId,
    difficulty: (input.difficulty ?? "beginner") as Difficulty,
    isPublished: input.isPublished ?? false,
    timeBest: input.complexity.time.best,
    timeAverage: input.complexity.time.average,
    timeWorst: input.complexity.time.worst,
    spaceComplexity: input.complexity.space,
    displayCodes: input.displayCodes,
    script,
    scriptVersion: SCRIPT_SCHEMA_VERSION,
    tags: input.tags ?? [],
  };
}

/**
 * Only fields the caller actually sent are written. A partial `complexity` update
 * (e.g. only time.best) must never null out the other complexity columns.
 */
function complexityPatch(c: NonNullable<UpdateAlgorithmRequest["complexity"]>) {
  return {
    ...(c.time?.best !== undefined ? { timeBest: c.time.best } : {}),
    ...(c.time?.average !== undefined ? { timeAverage: c.time.average } : {}),
    ...(c.time?.worst !== undefined ? { timeWorst: c.time.worst } : {}),
    ...(c.space !== undefined ? { spaceComplexity: c.space } : {}),
  };
}

/** The second argument is kept only so older call sites keep compiling; it is ignored. */
export function toUpdateData(
  input: UpdateAlgorithmRequest,
  _legacy?: unknown,
  categoryId?: string,
): Prisma.AlgorithmUpdateInput & {
  displayCodes?: { language: string; code: string }[];
  tags?: string[];
} {
  return {
    ...(input.slug && { slug: input.slug }),
    ...(input.name && { name: input.name }),
    ...(input.description && { description: input.description }),
    // Relation connect, not the unchecked scalar: Prisma rejects mixing checked
    // (nested relation writes) and unchecked (scalar foreign key) update input.
    ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
    ...(input.difficulty && { difficulty: input.difficulty as Difficulty }),
    ...(input.isPublished !== undefined && { isPublished: input.isPublished }),
    ...(input.complexity ? complexityPatch(input.complexity) : {}),
    ...(input.displayCodes && { displayCodes: input.displayCodes }),
    ...(input.tags && { tags: input.tags }),
    ...(input.script !== undefined ? { script: input.script, scriptVersion: SCRIPT_SCHEMA_VERSION } : {}),
  };
}

async function resolveCategory(categoryIdOrLabel: string) {
  const category = await categoryRepository.findByIdentifier(categoryIdOrLabel);
  if (!category) {
    throw AppError.badRequest(`Category "${categoryIdOrLabel}" does not exist.`);
  }
  return category;
}
__P6_FILE__

write_file "apps/api/src/services/script.service.ts" <<'__P6_FILE__'
import type { ErrorDetail } from "@algoforge/contracts";
import { analyzeScript, type ScriptAnalysis } from "@algoforge/visualizer-core";
import { AppError } from "../utils/app-error";

const MAX_DETAILS = 20;

/** Compile a script with the same compiler the browser uses. Never throws. */
export function checkScript(text: string): ScriptAnalysis {
  return analyzeScript(text);
}

/** Throws a 400 with line numbers when the script has errors. Warnings (rejected operations) are allowed. */
export function assertValidScript(text: string): ScriptAnalysis {
  const analysis = analyzeScript(text);
  if (analysis.ok) return analysis;
  const errors = analysis.diagnostics.filter((d) => d.severity === "error");
  const details: ErrorDetail[] = errors.slice(0, MAX_DETAILS).map((d) => ({
    path: `script:${d.line}:${d.column}`,
    message: d.message,
  }));
  const first = errors[0];
  throw AppError.badRequest(first ? `Invalid script: ${first.message}` : "Invalid script.", details);
}
__P6_FILE__

write_file "apps/api/src/services/script.service.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { assertValidScript, checkScript } from "./script.service";

const good = JSON.stringify([
  { step: 1, id: "A", ds: "array", op: "initialize", values: [3, 1, 2] },
  { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("assertValidScript", () => {
  it("returns the analysis for a valid script", () => {
    const a = assertValidScript(good);
    expect(a.stepCount).toBe(2);
    expect(a.structures[0]?.id).toBe("A");
  });

  it("rejects with a 400 that carries line and column", () => {
    try {
      assertValidScript(JSON.stringify([{ step: 1, id: "A", ds: "array", op: "apend", value: 1 }]));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      const e = error as AppError;
      expect(e.statusCode).toBe(400);
      expect(e.details?.[0]?.path).toMatch(/^script:\d+:\d+$/);
    }
  });

  it("rejects a script above the shared size limit", () => {
    expect(() => assertValidScript(" ".repeat(LIMITS.script.maxChars + 1))).toThrow(AppError);
  });

  it("allows a rejected operation, which is only a warning", () => {
    const text = JSON.stringify([
      { step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] },
      { step: 2, id: "A", op: "swap", indexA: 0, indexB: 9 },
    ]);
    expect(() => assertValidScript(text)).not.toThrow();
  });

  it("checkScript never throws", () => {
    expect(checkScript("not json").ok).toBe(false);
  });
});
__P6_FILE__

write_file "apps/api/src/services/visualization.service.ts" <<'__P6_FILE__'
import { LIMITS, type CreateVisualizationRequest, type UpdateVisualizationRequest } from "@algoforge/contracts";
import type { Prisma } from "@algoforge/db";
import { SCRIPT_SCHEMA_VERSION } from "@algoforge/visualizer-core";
import { visualizationRepository, type VisualizationWrite } from "../repositories/visualization.repository";
import { AppError } from "../utils/app-error";
import { paginate } from "../utils/pagination";
import { assertValidScript } from "./script.service";

const asJson = (value: unknown) => value as unknown as Prisma.InputJsonValue;

/**
 * Ownership-safe data access for saved visualizations.
 * Every method takes the acting user's id and passes it into the query, so another
 * person's row is simply "not found". Scripts are compiled with the shared compiler before they are stored.
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

  /** Validate the script, enforce the per-user cap, then store it with the derived structures and step count. */
  async createFromRequest(userId: string, input: CreateVisualizationRequest) {
    const analysis = assertValidScript(input.script);
    const count = await visualizationRepository.countByUser(userId);
    if (count >= LIMITS.visualization.maxPerUser) {
      throw AppError.conflict(`You have reached the limit of ${LIMITS.visualization.maxPerUser} saved visualizations. Delete one first.`);
    }
    return this.create(userId, {
      title: input.title,
      description: input.description ?? null,
      script: input.script,
      code: input.code ?? null,
      language: input.language ?? null,
      structures: asJson(analysis.structures),
      stepCount: analysis.stepCount,
      schemaVersion: SCRIPT_SCHEMA_VERSION,
    });
  }

  async updateFromRequest(userId: string, id: string, input: UpdateVisualizationRequest) {
    const patch: Partial<VisualizationWrite> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.code !== undefined) patch.code = input.code;
    if (input.language !== undefined) patch.language = input.language;
    if (input.script !== undefined) {
      const analysis = assertValidScript(input.script);
      patch.script = input.script;
      patch.structures = asJson(analysis.structures);
      patch.stepCount = analysis.stepCount;
      patch.schemaVersion = SCRIPT_SCHEMA_VERSION;
    }
    return this.update(userId, id, patch);
  }
}

export const visualizationService = new VisualizationService();
__P6_FILE__

write_file "apps/api/src/services/search.service.ts" <<'__P6_FILE__'
import { LIMITS, type SearchResult } from "@algoforge/contracts";
import { algorithmRepository } from "../repositories/algorithm.repository";
import { visualizationRepository } from "../repositories/visualization.repository";

/** Published algorithms for everyone, plus the caller's own saved visualizations when signed in. */
class SearchService {
  async search(term: string, userId?: string): Promise<SearchResult[]> {
    const [algorithms, visualizations] = await Promise.all([
      algorithmRepository.searchPublished(term, LIMITS.search.maxAlgorithmHits),
      userId ? visualizationRepository.searchByUser(userId, term, LIMITS.search.maxVisualizationHits) : Promise.resolve([]),
    ]);
    return [
      ...algorithms.map((a) => ({
        type: "algorithm" as const,
        id: a.id,
        title: a.name,
        description: a.description,
        href: `/algorithms/${encodeURIComponent(a.slug)}`,
      })),
      ...visualizations.map((v) => ({
        type: "visualization" as const,
        id: v.id,
        title: v.title,
        description: v.description ?? "Saved visualization",
        href: `/dashboard?tab=visualizer&viz=${encodeURIComponent(v.id)}`,
      })),
    ];
  }
}

export const searchService = new SearchService();
__P6_FILE__

write_file "apps/api/src/serializers/visualization.ts" <<'__P6_FILE__'
import { z } from "zod";
import {
  AnalysisLanguageSchema,
  VisualizationStructureSchema,
  type Visualization,
  type VisualizationSummary,
} from "@algoforge/contracts";
import { toIso } from "./dates";

const StructuresSchema = z.array(VisualizationStructureSchema);

export interface VisualizationSummaryRow {
  id: string;
  title: string;
  description: string | null;
  language: string | null;
  structures: unknown;
  stepCount: number;
  schemaVersion: number;
  forkedFromId: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
export interface VisualizationRow extends VisualizationSummaryRow {
  script: string;
  code: string | null;
}

/** Stored JSON is data, not trusted: anything unreadable degrades to an empty list or null. */
export function serializeVisualizationSummary(row: VisualizationSummaryRow): VisualizationSummary {
  const structures = StructuresSchema.safeParse(row.structures);
  const language = AnalysisLanguageSchema.safeParse(row.language);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    language: language.success ? language.data : null,
    structures: structures.success ? structures.data : [],
    stepCount: row.stepCount,
    schemaVersion: row.schemaVersion,
    forkedFromId: row.forkedFromId,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

/** Never includes userId. */
export function serializeVisualization(row: VisualizationRow): Visualization {
  return { ...serializeVisualizationSummary(row), script: row.script, code: row.code };
}
__P6_FILE__

write_file "apps/api/src/serializers/visualization.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { serializeVisualization, serializeVisualizationSummary } from "./visualization";

const row = {
  id: "v1",
  title: "Demo",
  description: null,
  language: "javascript",
  structures: [{ id: "A", ds: "array", label: "Array" }],
  stepCount: 2,
  schemaVersion: 1,
  forkedFromId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: "2026-01-02T00:00:00.000Z",
  script: "[]",
  code: null,
  userId: "someone-else",
};

describe("visualization serializers", () => {
  it("maps a row and never leaks the owner", () => {
    const out = serializeVisualization(row);
    expect(out.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(out.structures).toHaveLength(1);
    expect("userId" in out).toBe(false);
  });

  it("degrades unreadable stored JSON instead of throwing", () => {
    const out = serializeVisualizationSummary({ ...row, structures: "garbage", language: "cobol" });
    expect(out.structures).toEqual([]);
    expect(out.language).toBeNull();
  });
});
__P6_FILE__

write_file "apps/api/src/validation/algorithm.ts" <<'__P6_FILE__'
import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  CreateAlgorithmRequestSchema,
  DifficultySchema,
  LIMITS,
  UpdateAlgorithmRequestSchema,
  type CreateAlgorithmRequest,
  type UpdateAlgorithmRequest,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import type { AlgorithmQuery } from "../types/algorithm.types";
import { badRequestFromZod } from "./common";

export function parseCreateAlgorithm(value: unknown): CreateAlgorithmRequest {
  const result = CreateAlgorithmRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid algorithm data.");
  return result.data;
}

export function parseUpdateAlgorithm(value: unknown): UpdateAlgorithmRequest {
  const result = UpdateAlgorithmRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid algorithm data.");
  return result.data;
}

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CUID_REGEX = /^c[a-z0-9]{24}$/;
const SLUG_REGEX = /^[a-z0-9-]+$/;

const { defaultSize, maxSize } = LIMITS.pagination.algorithms;

const QuerySchema = z.object({
  q: z.string().max(LIMITS.search.maxQueryChars).optional(),
  search: z.string().max(LIMITS.search.maxQueryChars).optional(),
  categoryId: z.string().min(1).max(50).optional(),
  difficulty: DifficultySchema.optional(),
  tag: z.string().min(1).max(50).optional(),
  isPublished: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().regex(UUID_REGEX, "Invalid cursor.").optional(),
});

/** Blank values are ignored; a bad value is a 400 (it used to reach the database as a 500). */
export function parseAlgorithmQuery(value: unknown): AlgorithmQuery {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== ""))
      : {};
  const parsed = QuerySchema.safeParse(raw);
  if (!parsed.success) throw badRequestFromZod(parsed.error, "Invalid query.");
  const d = parsed.data;
  const search = (d.q ?? d.search)?.trim();
  return {
    limit: d.limit,
    ...(d.categoryId ? { categoryId: d.categoryId } : {}),
    ...(d.difficulty ? { difficulty: d.difficulty } : {}),
    ...(d.tag ? { tag: d.tag } : {}),
    ...(d.isPublished ? { isPublished: d.isPublished === "true" } : {}),
    ...(search ? { search } : {}),
    ...(d.cursor ? { cursor: d.cursor } : {}),
  };
}

export function validateIdParam(req: Request, _res: Response, next: NextFunction): void {
  const id = req.params.id;
  if (!id || (!UUID_REGEX.test(id) && !CUID_REGEX.test(id))) {
    return next(AppError.badRequest("Invalid algorithm ID format. Expected UUID or cuid."));
  }
  next();
}

export function validateSlugParam(req: Request, _res: Response, next: NextFunction): void {
  const slug = req.params.slug;
  if (!slug || !SLUG_REGEX.test(slug)) {
    return next(AppError.badRequest("Invalid slug format. Expected kebab-case string."));
  }
  next();
}
__P6_FILE__

write_file "apps/api/src/validation/algorithm.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { parseAlgorithmQuery, parseCreateAlgorithm } from "./algorithm";

describe("parseAlgorithmQuery", () => {
  it("applies the default page size", () => {
    expect(parseAlgorithmQuery({}).limit).toBe(LIMITS.pagination.algorithms.defaultSize);
  });

  it("reads q, and still accepts the old search name", () => {
    expect(parseAlgorithmQuery({ q: " sort " }).search).toBe("sort");
    expect(parseAlgorithmQuery({ search: "graph" }).search).toBe("graph");
  });

  it("ignores blank values", () => {
    const q = parseAlgorithmQuery({ q: "", categoryId: "", difficulty: "" });
    expect(q.search).toBeUndefined();
    expect(q.categoryId).toBeUndefined();
  });

  it("rejects an unknown difficulty, a huge page and a bad cursor with a 400", () => {
    for (const bad of [{ difficulty: "easy" }, { limit: "9999" }, { cursor: "nope" }]) {
      expect(() => parseAlgorithmQuery(bad)).toThrow(AppError);
    }
  });

  it("parses isPublished as a boolean", () => {
    expect(parseAlgorithmQuery({ isPublished: "false" }).isPublished).toBe(false);
  });
});

describe("parseCreateAlgorithm", () => {
  it("accepts a script and no forge", () => {
    const out = parseCreateAlgorithm({
      slug: "x",
      name: "X",
      description: "d",
      categoryId: "c",
      complexity: { time: { best: "a", average: "b", worst: "c" }, space: "d" },
      displayCodes: [{ language: "javascript", code: "1" }],
      script: "[]",
    });
    expect(out.script).toBe("[]");
  });
});
__P6_FILE__

write_file "apps/api/src/validation/visualization.ts" <<'__P6_FILE__'
import { z } from "zod";
import {
  CreateVisualizationRequestSchema,
  LIMITS,
  UpdateVisualizationRequestSchema,
  ValidateScriptRequestSchema,
  type CreateVisualizationRequest,
  type UpdateVisualizationRequest,
} from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import { badRequestFromZod, ensureString } from "./common";

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function parseVisualizationId(value: unknown): string {
  const id = ensureString(value, "Visualization id is required.");
  if (!ID_RE.test(id)) throw AppError.badRequest("Invalid visualization id.");
  return id;
}

export function parseCreateVisualization(value: unknown): CreateVisualizationRequest {
  const r = CreateVisualizationRequestSchema.safeParse(value);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid visualization.");
  return r.data;
}

export function parseUpdateVisualization(value: unknown): UpdateVisualizationRequest {
  const r = UpdateVisualizationRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid visualization.");
  if (Object.values(r.data).every((v) => v === undefined)) {
    throw AppError.badRequest("Provide at least one field to update.");
  }
  return r.data;
}

export function parseValidateScript(value: unknown): string {
  const r = ValidateScriptRequestSchema.safeParse(value ?? {});
  if (!r.success) throw badRequestFromZod(r.error, "Invalid script.");
  return r.data.script;
}

const { defaultSize, maxSize } = LIMITS.pagination.visualizations;
const ListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(maxSize).default(defaultSize),
  cursor: z.string().regex(ID_RE, "Invalid cursor.").optional(),
});

export interface VisualizationListQuery {
  limit: number;
  cursor?: string;
}

export function parseListVisualizationsQuery(value: unknown): VisualizationListQuery {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== ""))
      : {};
  const r = ListQuerySchema.safeParse(raw);
  if (!r.success) throw badRequestFromZod(r.error, "Invalid query.");
  return { limit: r.data.limit, ...(r.data.cursor ? { cursor: r.data.cursor } : {}) };
}
__P6_FILE__

write_file "apps/api/src/validation/visualization.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";
import {
  parseCreateVisualization,
  parseListVisualizationsQuery,
  parseUpdateVisualization,
  parseVisualizationId,
} from "./visualization";

describe("visualization validation", () => {
  it("accepts a create body at the size limit and rejects one above it", () => {
    expect(parseCreateVisualization({ title: "t", script: "x".repeat(LIMITS.script.maxChars) }).title).toBe("t");
    expect(() => parseCreateVisualization({ title: "t", script: "x".repeat(LIMITS.script.maxChars + 1) })).toThrow(AppError);
  });

  it("requires at least one field to update, and lets null clear one", () => {
    expect(() => parseUpdateVisualization({})).toThrow(AppError);
    expect(parseUpdateVisualization({ description: null }).description).toBeNull();
  });

  it("validates ids and list queries", () => {
    expect(parseVisualizationId("seed_viz_1")).toBe("seed_viz_1");
    expect(() => parseVisualizationId("../etc")).toThrow(AppError);
    expect(parseListVisualizationsQuery({}).limit).toBe(LIMITS.pagination.visualizations.defaultSize);
    expect(() => parseListVisualizationsQuery({ limit: "1000" })).toThrow(AppError);
  });
});
__P6_FILE__

write_file "apps/api/src/controllers/algorithm.controller.ts" <<'__P6_FILE__'
import { Request, Response } from "express";
import { Role } from "@algoforge/db";
import type { AlgorithmListResponse } from "@algoforge/contracts";
import { algorithmService } from "../services/algorithm/index";
import { AUDIT_ACTIONS, auditService } from "../services/audit.service";
import type { AlgorithmVisibility } from "../types/algorithm.types";
import { asyncHandler } from "../utils/async-handler";
import { ensureString } from "../validation/common";
import { parseCreateAlgorithm, parseUpdateAlgorithm, parseAlgorithmQuery } from "../validation/algorithm";

function visibilityOf(req: Request): AlgorithmVisibility {
  return { isAdmin: req.auth?.user.role === Role.ADMIN };
}

class AlgorithmController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseAlgorithmQuery(req.query);
    const page = await algorithmService.listAlgorithms(query, visibilityOf(req));
    const body: AlgorithmListResponse = { data: page.items, meta: page.meta };
    res.json(body);
  });

  getById = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    res.json(await algorithmService.getAlgorithmById(id, lang, visibilityOf(req)));
  });

  getBySlug = asyncHandler(async (req: Request, res: Response) => {
    const slug = ensureString(req.params.slug, "Algorithm slug is required.");
    const lang = typeof req.query.lang === "string" ? req.query.lang : undefined;
    res.json(await algorithmService.getAlgorithmBySlug(slug, lang, visibilityOf(req)));
  });

  getVisualize = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    res.json(await algorithmService.getAlgorithmExecution(id, visibilityOf(req)));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateAlgorithm(req.body);
    const created = await algorithmService.createAlgorithm(input, req.auth?.user.id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_CREATE, { type: "algorithm", id: created.id }, { slug: input.slug });
    res.status(201).json(created);
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    const input = parseUpdateAlgorithm(req.body);
    const updated = await algorithmService.updateAlgorithm(id, input);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_UPDATE, { type: "algorithm", id }, { fields: Object.keys(input) });
    res.status(200).json(updated);
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    const id = ensureString(req.params.id, "Algorithm ID is required.");
    await algorithmService.deleteAlgorithm(id);
    await auditService.recordFromRequest(req, AUDIT_ACTIONS.ALGORITHM_DELETE, { type: "algorithm", id });
    res.status(204).send();
  });
}

export const algorithmController = new AlgorithmController();
__P6_FILE__

write_file "apps/api/src/controllers/visualization.controller.ts" <<'__P6_FILE__'
import { Request, Response } from "express";
import type { ValidateScriptResponse, VisualizationListResponse } from "@algoforge/contracts";
import { serializeVisualization, serializeVisualizationSummary } from "../serializers/visualization";
import { checkScript } from "../services/script.service";
import { visualizationService } from "../services/visualization.service";
import { asyncHandler } from "../utils/async-handler";
import {
  parseCreateVisualization,
  parseListVisualizationsQuery,
  parseUpdateVisualization,
  parseValidateScript,
  parseVisualizationId,
} from "../validation/visualization";

/** Every handler passes req.auth.user.id into the service, so ownership is part of every query. */
class VisualizationController {
  list = asyncHandler(async (req: Request, res: Response) => {
    const query = parseListVisualizationsQuery(req.query);
    const { items, meta } = await visualizationService.list(req.auth!.user.id, query);
    const body: VisualizationListResponse = { data: items.map(serializeVisualizationSummary), meta };
    res.json(body);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    res.json(serializeVisualization(await visualizationService.get(req.auth!.user.id, id)));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = parseCreateVisualization(req.body);
    const row = await visualizationService.createFromRequest(req.auth!.user.id, input);
    res.status(201).json(serializeVisualization(row));
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    const input = parseUpdateVisualization(req.body);
    const row = await visualizationService.updateFromRequest(req.auth!.user.id, id, input);
    res.json(serializeVisualization(row));
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    const id = parseVisualizationId(req.params.id);
    await visualizationService.remove(req.auth!.user.id, id);
    res.status(204).send();
  });

  validate = asyncHandler(async (req: Request, res: Response) => {
    const analysis = checkScript(parseValidateScript(req.body));
    const body: ValidateScriptResponse = {
      ok: analysis.ok,
      stepCount: analysis.stepCount,
      structures: analysis.structures,
      diagnostics: analysis.diagnostics,
    };
    res.json(body);
  });
}

export const visualizationController = new VisualizationController();
__P6_FILE__

write_file "apps/api/src/controllers/search.controller.ts" <<'__P6_FILE__'
import { Request, Response } from "express";
import { SearchQuerySchema, type SearchResponse } from "@algoforge/contracts";
import { searchService } from "../services/search.service";
import { asyncHandler } from "../utils/async-handler";
import { badRequestFromZod } from "../validation/common";

class SearchController {
  search = asyncHandler(async (req: Request, res: Response) => {
    const parsed = SearchQuerySchema.safeParse({ q: typeof req.query.q === "string" ? req.query.q : "" });
    if (!parsed.success) throw badRequestFromZod(parsed.error, "Invalid search.");
    const body: SearchResponse = { data: await searchService.search(parsed.data.q, req.auth?.user.id) };
    res.json(body);
  });
}

export const searchController = new SearchController();
__P6_FILE__

write_file "apps/api/src/routes/visualizations.ts" <<'__P6_FILE__'
import { Router } from "express";
import { visualizationController as c } from "../controllers/visualization.controller";
import { env } from "../config/env";
import { requireAuth } from "../middleware/auth";
import { requireCsrf } from "../middleware/csrf";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();
const limit = generalRateLimiter({ scope: "viz", limitPerMinute: env.redis.visualizationRateLimitPerMinute });

// "/validate" is declared before "/:id" so it is never read as an id.
router.get("/", requireAuth, limit, c.list);
router.post("/validate", requireAuth, requireCsrf, limit, c.validate);
router.post("/", requireAuth, requireCsrf, limit, c.create);
router.get("/:id", requireAuth, limit, c.get);
router.patch("/:id", requireAuth, requireCsrf, limit, c.update);
router.delete("/:id", requireAuth, requireCsrf, limit, c.remove);

export default router;
__P6_FILE__

write_file "apps/api/src/routes/search.ts" <<'__P6_FILE__'
import { Router } from "express";
import { searchController } from "../controllers/search.controller";
import { env } from "../config/env";
import { optionalAuth } from "../middleware/auth";
import { generalRateLimiter } from "../middleware/rate-limit";

const router = Router();

router.get(
  "/",
  optionalAuth,
  generalRateLimiter({ scope: "catalog", limitPerMinute: env.redis.catalogRateLimitPerMinute }),
  searchController.search,
);

export default router;
__P6_FILE__

# ───────────────────────── 4. web files ─────────────────────────
log "Web files"
W="apps/web/src"

write_file "$W/hooks/useDebouncedValue.ts" <<'__P6_FILE__'
"use client";

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delayMs);
        return () => clearTimeout(id);
    }, [value, delayMs]);
    return debounced;
}
__P6_FILE__

write_file "$W/lib/search/items.ts" <<'__P6_FILE__'
import type { SearchResponse } from "@algoforge/contracts";

export interface SearchResultItem {
    id: string;
    title: string;
    category: string;
    href: string;
    description: string;
}

/** Server hits to the shape the title bar renders. */
export function toSearchItems(response: SearchResponse): SearchResultItem[] {
    return response.data.map((hit) => ({
        id: `${hit.type}:${hit.id}`,
        title: hit.title,
        description: hit.description,
        href: hit.href,
        category: hit.type === "algorithm" ? "Algorithm" : "Saved visualization",
    }));
}
__P6_FILE__

write_file "$W/lib/search/items.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { toSearchItems } from "./items";

describe("toSearchItems", () => {
    it("labels and namespaces hits", () => {
        const items = toSearchItems({
            data: [
                { type: "algorithm", id: "a1", title: "BFS", description: "d", href: "/algorithms/bfs" },
                { type: "visualization", id: "a1", title: "Mine", description: "d", href: "/dashboard?tab=visualizer&viz=a1" },
            ],
        });
        expect(items.map((i) => i.id)).toEqual(["algorithm:a1", "visualization:a1"]);
        expect(items.map((i) => i.category)).toEqual(["Algorithm", "Saved visualization"]);
    });
});
__P6_FILE__

write_file "$W/lib/search/useSearch.ts" <<'__P6_FILE__'
"use client";

import { useEffect, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { endpoints } from "@/lib/api/endpoints";
import { toSearchItems, type SearchResultItem } from "./items";

const EMPTY: SearchResultItem[] = [];

interface Settled {
    q: string;
    items: SearchResultItem[];
    failed: boolean;
}

/**
 * Live search against GET /api/search (published algorithms, plus your saved visualizations when signed in).
 * Plain fetch with abort, so it needs no provider and an old answer can never replace a newer one.
 */
export function useSearch(query: string, enabled = true) {
    const q = useDebouncedValue(query.trim(), 200);
    const [settled, setSettled] = useState<Settled | null>(null);

    useEffect(() => {
        if (!enabled || q === "") return;
        const ctrl = new AbortController();
        endpoints
            .search(q, ctrl.signal)
            .then((r) => setSettled({ q, items: toSearchItems(r), failed: false }))
            .catch(() => {
                if (!ctrl.signal.aborted) setSettled({ q, items: EMPTY, failed: true });
            });
        return () => ctrl.abort();
    }, [q, enabled]);

    const current = enabled && q !== "" && settled?.q === q ? settled : null;
    return {
        items: current?.items ?? EMPTY,
        loading: enabled && query.trim() !== "" && current === null,
        failed: current?.failed ?? false,
    };
}
__P6_FILE__

write_file "$W/lib/api/endpoints.ts" <<'__P6_FILE__'
import {
  AlgorithmDetailResponseSchema,
  AlgorithmListResponseSchema,
  AnalysisHistoryResponseSchema,
  CapabilitiesResponseSchema,
  CategoryListResponseSchema,
  DeviceSessionListResponseSchema,
  ExplainSessionListResponseSchema,
  MeResponseSchema,
  SearchResponseSchema,
  ValidateScriptResponseSchema,
  VisualizationListResponseSchema,
  VisualizationSchema,
  type AlgorithmDetailResponse,
  type AlgorithmListQuery,
  type AlgorithmListResponse,
  type AnalysisHistoryResponse,
  type CapabilitiesResponse,
  type CategoryListResponse,
  type CreateVisualizationRequest,
  type ExplainSessionListResponse,
  type MeResponse,
  type SearchResponse,
  type UpdateProfileRequest,
  type UpdateVisualizationRequest,
  type ValidateScriptResponse,
  type Visualization,
  type VisualizationListResponse,
} from "@algoforge/contracts";
import { z } from "zod";
import { apiClient, type ApiClient } from "./client";

export interface PageParams {
  limit?: number;
  cursor?: string;
}

export type DeviceSessionListResponse = z.infer<typeof DeviceSessionListResponseSchema>;

const opt = (signal?: AbortSignal) => (signal ? { signal } : {});
const seg = encodeURIComponent;

/** Typed endpoint functions. Every response is validated against the shared schema. */
export function createEndpoints(client: ApiClient) {
  return {
    me: (signal?: AbortSignal): Promise<MeResponse> => client.get("/api/auth/me", MeResponseSchema, opt(signal)),
    capabilities: (signal?: AbortSignal): Promise<CapabilitiesResponse> => client.get("/api/meta/capabilities", CapabilitiesResponseSchema, opt(signal)),
    sessions: (signal?: AbortSignal): Promise<DeviceSessionListResponse> => client.get("/api/auth/sessions", DeviceSessionListResponseSchema, opt(signal)),
    revokeSession: (id: string): Promise<void> => client.delete(`/api/auth/sessions/${seg(id)}`),
    updateProfile: (body: UpdateProfileRequest): Promise<MeResponse> => client.patch("/api/users/me", MeResponseSchema, body),
    deleteAccount: (): Promise<void> => client.delete("/api/users/me"),
    logout: (): Promise<void> => client.postEmpty("/api/auth/logout"),
    logoutAll: (): Promise<void> => client.postEmpty("/api/auth/logout-all"),

    analysisHistory: (params: PageParams = {}, signal?: AbortSignal): Promise<AnalysisHistoryResponse> =>
      client.get("/api/analysis", AnalysisHistoryResponseSchema, { query: { ...params }, ...opt(signal) }),
    categories: (signal?: AbortSignal): Promise<CategoryListResponse> => client.get("/api/categories", CategoryListResponseSchema, opt(signal)),
    explainSessions: (params: PageParams = {}, signal?: AbortSignal): Promise<ExplainSessionListResponse> =>
      client.get("/api/explain-sessions", ExplainSessionListResponseSchema, { query: { ...params }, ...opt(signal) }),

    algorithms: (params: AlgorithmListQuery = {}, signal?: AbortSignal): Promise<AlgorithmListResponse> =>
      client.get("/api/algorithms", AlgorithmListResponseSchema, { query: { ...params }, ...opt(signal) }),
    algorithmBySlug: (slug: string, signal?: AbortSignal): Promise<AlgorithmDetailResponse> =>
      client.get(`/api/algorithms/slug/${seg(slug)}`, AlgorithmDetailResponseSchema, opt(signal)),

    search: (q: string, signal?: AbortSignal): Promise<SearchResponse> => client.get("/api/search", SearchResponseSchema, { query: { q }, ...opt(signal) }),

    visualizations: (params: PageParams = {}, signal?: AbortSignal): Promise<VisualizationListResponse> =>
      client.get("/api/visualizations", VisualizationListResponseSchema, { query: { ...params }, ...opt(signal) }),
    visualization: (id: string, signal?: AbortSignal): Promise<Visualization> => client.get(`/api/visualizations/${seg(id)}`, VisualizationSchema, opt(signal)),
    createVisualization: (body: CreateVisualizationRequest): Promise<Visualization> => client.post("/api/visualizations", VisualizationSchema, body),
    updateVisualization: (id: string, body: UpdateVisualizationRequest): Promise<Visualization> =>
      client.patch(`/api/visualizations/${seg(id)}`, VisualizationSchema, body),
    deleteVisualization: (id: string): Promise<void> => client.delete(`/api/visualizations/${seg(id)}`),
    validateScript: (script: string, signal?: AbortSignal): Promise<ValidateScriptResponse> =>
      client.post("/api/visualizations/validate", ValidateScriptResponseSchema, { script }, opt(signal)),
  };
}

export const endpoints = createEndpoints(apiClient);
__P6_FILE__

write_file "$W/lib/query/keys.ts" <<'__P6_FILE__'
import type { AlgorithmListQuery } from "@algoforge/contracts";

/** One place for every cache key, so invalidation stays predictable. */
export const queryKeys = {
  me: () => ["auth", "me"] as const,
  deviceSessions: () => ["auth", "sessions"] as const,
  capabilities: () => ["meta", "capabilities"] as const,
  analysisHistory: () => ["analysis", "history"] as const,
  algorithms: (params: AlgorithmListQuery = {}) => ["algorithms", "list", params] as const,
  algorithmCatalog: (params: AlgorithmListQuery = {}) => ["algorithms", "catalog", params] as const,
  algorithm: (slug: string) => ["algorithms", "detail", slug] as const,
  categories: () => ["categories", "list"] as const,
  explainSessions: () => ["explain", "sessions"] as const,
  visualizations: () => ["visualizations", "list"] as const,
};
__P6_FILE__

write_file "$W/lib/query/hooks.ts" <<'__P6_FILE__'
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

/** The public catalog: search, filters and "load more" by cursor. */
export function useAlgorithmCatalog(params: Omit<AlgorithmListQuery, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.algorithmCatalog(params),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.algorithms({ ...params, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
  });
}

export function useAlgorithm(slug: string) {
  return useQuery({ queryKey: queryKeys.algorithm(slug), queryFn: ({ signal }) => endpoints.algorithmBySlug(slug, signal), retry: false });
}

export function useCategories() {
  return useQuery({ queryKey: queryKeys.categories(), queryFn: ({ signal }) => endpoints.categories(signal) });
}

export function useVisualizations(options: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.visualizations(),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => endpoints.visualizations({ limit: 20, ...(pageParam ? { cursor: pageParam } : {}) }, signal),
    getNextPageParam: (last) => (last.meta.hasMore ? (last.meta.nextCursor ?? undefined) : undefined),
    enabled: options.enabled ?? true,
  });
}

export function useExplainSessions(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: queryKeys.explainSessions(), queryFn: ({ signal }) => endpoints.explainSessions({}, signal), enabled: options.enabled ?? true });
}

/** What the server can do right now. This, not an environment flag, decides "available" versus "not available". */
export function useCapabilities() {
  return useQuery({
    queryKey: queryKeys.capabilities(),
    queryFn: ({ signal }) => endpoints.capabilities(signal),
    staleTime: 5 * 60_000,
  });
}
__P6_FILE__

write_file "$W/lib/query/index.ts" <<'__P6_FILE__'
export { QueryProvider } from "./QueryProvider";
export { QueryBoundary } from "./QueryBoundary";
export type { QueryStateLike } from "./QueryBoundary";
export { createQueryClient, retryDelayMs, shouldRetry } from "./queryClient";
export { queryKeys } from "./keys";
export { useAlgorithm, useAlgorithmCatalog, useAlgorithms, useAnalysisHistory, useCapabilities, useCategories, useExplainSessions, useVisualizations } from "./hooks";
__P6_FILE__

write_file "$W/lib/navEvents.ts" <<'__P6_FILE__'
/** The dashboard reads ?tab and ?viz. Pages that change them without a remount fire NAV_EVENT. */
export const NAV_EVENT = "algoforge:navigate";

export type DashboardTab = "analysis" | "visualizer" | "history";
const TABS: readonly string[] = ["analysis", "visualizer", "history"];

export function readDashboardParams(search?: string): { tab: DashboardTab | null; viz: string | null } {
    const text = search ?? (typeof window === "undefined" ? "" : window.location.search);
    const params = new URLSearchParams(text);
    const tab = params.get("tab");
    const viz = params.get("viz");
    return { tab: tab !== null && TABS.includes(tab) ? (tab as DashboardTab) : null, viz: viz && /^[A-Za-z0-9_-]{1,64}$/.test(viz) ? viz : null };
}

/** Removes query parameters from the address bar without navigating. */
export function dropParams(names: readonly string[]): void {
    const url = new URL(window.location.href);
    names.forEach((n) => url.searchParams.delete(n));
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}
__P6_FILE__

write_file "$W/lib/navEvents.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { readDashboardParams } from "./navEvents";

describe("readDashboardParams", () => {
    it("reads a known tab and a safe id", () => {
        expect(readDashboardParams("?tab=visualizer&viz=abc_123")).toEqual({ tab: "visualizer", viz: "abc_123" });
    });
    it("ignores unknown tabs and unsafe ids", () => {
        expect(readDashboardParams("?tab=admin&viz=../x")).toEqual({ tab: null, viz: null });
        expect(readDashboardParams("")).toEqual({ tab: null, viz: null });
    });
});
__P6_FILE__

write_file "$W/components/visualizers/script/shim.test.ts" <<'__P6_FILE__'
import { describe, expect, it } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { compileScript as fromPackage, COMPILER_LIMITS } from "@algoforge/visualizer-core";
import { compileScript as fromWeb, LIMITS as webLimits } from "./compile";

const script = JSON.stringify([
    { step: 1, id: "A", ds: "array", op: "initialize", values: [2, 1] },
    { step: 2, id: "A", op: "swap", indexA: 0, indexB: 1 },
]);

describe("one compiler for browser and server", () => {
    it("the web import path is the package compiler", () => {
        expect(fromWeb).toBe(fromPackage);
    });
    it("the script size limit is the shared contracts limit", () => {
        expect(webLimits.chars).toBe(LIMITS.script.maxChars);
        expect(COMPILER_LIMITS.chars).toBe(LIMITS.script.maxChars);
    });
    it("compiles to the same frames", () => {
        expect(fromWeb(script).frames.length).toBe(2);
        expect(JSON.stringify(fromWeb(script).diagnostics)).toBe(JSON.stringify(fromPackage(script).diagnostics));
    });
});
__P6_FILE__

write_file "$W/components/site/PageShell.tsx" <<'__P6_FILE__'
import Link from "next/link";
import type { ReactNode } from "react";
import AlgoForgeLogo from "@/components/Logo";

/** A simple frame for static and catalog pages. Works in server and client components. */
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
    return (
        <div className="min-h-dvh bg-background text-foreground">
            <header className="border-b border-foreground/10">
                <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
                    <Link href="/" className="flex items-center" aria-label="AlgoForge home">
                        <AlgoForgeLogo size={19} />
                        <span className="font-chango text-lg tracking-tight">
                            lgo<span className="text-accent">Forge</span>
                        </span>
                    </Link>
                    <nav className="flex items-center gap-5 text-sm text-foreground/70">
                        <Link href="/algorithms" className="hover:text-foreground">Algorithms</Link>
                        <Link href="/dashboard" className="hover:text-foreground">Open app</Link>
                    </nav>
                </div>
            </header>
            <main id="main-content" className={`mx-auto px-5 py-10 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
                {children}
            </main>
            <footer className="border-t border-foreground/10 py-6 text-center text-xs text-foreground/50">
                <Link href="/terms" className="hover:text-foreground">Terms</Link>
                <span className="mx-3">·</span>
                <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
            </footer>
        </div>
    );
}
__P6_FILE__

write_file "$W/app/terms/page.tsx" <<'__P6_FILE__'
import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Terms of Use · AlgoForge" };

export default function TermsPage() {
    return (
        <PageShell>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Terms of Use</h1>
            <p className="mb-8 text-sm text-foreground/60">Last updated: 5 November 2026. This is a short plain-language draft. Have it reviewed before you rely on it.</p>
            <div className="space-y-6 text-[15px] leading-relaxed text-foreground/80">
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Using AlgoForge</h2>
                    <p>AlgoForge lets you write short scripts and watch data structures change step by step. The editor and the visualizer work without an account. Analysis, the assistant, history, saved work and sharing need you to sign in with Google.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Your content</h2>
                    <p>You own the scripts and code you write. By saving or sharing something you allow AlgoForge to store it and, if you share it, to show it to people who have the link. You can delete saved work and delete your account at any time.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Acceptable use</h2>
                    <p>Do not abuse the service, try to break or overload it, or use it to attack others. Limits on size and request rate exist to keep it fast for everyone.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">No guarantees</h2>
                    <p>The service is provided as it is. AI output can be wrong. Check results before you depend on them.</p>
                </section>
            </div>
        </PageShell>
    );
}
__P6_FILE__

write_file "$W/app/privacy/page.tsx" <<'__P6_FILE__'
import type { Metadata } from "next";
import { PageShell } from "@/components/site/PageShell";

export const metadata: Metadata = { title: "Privacy Policy · AlgoForge" };

export default function PrivacyPage() {
    return (
        <PageShell>
            <h1 className="mb-2 text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="mb-8 text-sm text-foreground/60">Last updated: 5 November 2026. This is a short plain-language draft. Have it reviewed before you rely on it.</p>
            <div className="space-y-6 text-[15px] leading-relaxed text-foreground/80">
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Without an account</h2>
                    <p>Your script and settings stay in your browser (local storage). Nothing is sent to our servers when you only use the editor and the visualizer.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">With an account</h2>
                    <p>When you sign in with Google we receive your name, email address and profile picture. We store what you create: saved visualizations, analyses and chats. We store basic details about your sign-in sessions (time, IP address and browser) so you can see and end them in Settings.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Cookies</h2>
                    <p>We use cookies only to keep you signed in and to protect requests from forgery. We do not use advertising cookies.</p>
                </section>
                <section>
                    <h2 className="mb-1 text-lg font-semibold text-foreground">Your choices</h2>
                    <p>You can delete any saved item, sign out of any device, and delete your account in Settings. Deleting your account removes what you created, and shared links stop working.</p>
                </section>
            </div>
        </PageShell>
    );
}
__P6_FILE__

write_file "$W/app/algorithms/page.tsx" <<'__P6_FILE__'
"use client";

import Link from "next/link";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { QueryBoundary, useAlgorithmCatalog, useCategories } from "@/lib/query";
import { btn, inputCls } from "@/components/visualizers/shared/styles";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

export default function AlgorithmsPage() {
    const [q, setQ] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [difficulty, setDifficulty] = useState<"" | Difficulty>("");
    const term = useDebouncedValue(q.trim(), 250);
    const categories = useCategories();
    const catalog = useAlgorithmCatalog({
        limit: 12,
        ...(term ? { q: term } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(difficulty ? { difficulty } : {}),
    });
    const items = catalog.data?.pages.flatMap((p) => p.data) ?? [];

    return (
        <PageShell wide>
            <h1 className="mb-1 text-3xl font-bold tracking-tight">Algorithms</h1>
            <p className="mb-6 text-foreground/60">Pick one and watch it run, step by step.</p>

            <div className="mb-6 flex flex-wrap gap-3">
                <label className="sr-only" htmlFor="alg-q">Search algorithms</label>
                <input id="alg-q" className={`${inputCls} max-w-xs`} placeholder="Search by name or topic" value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
                <label className="sr-only" htmlFor="alg-cat">Category</label>
                <select id="alg-cat" className={`${inputCls} w-auto`} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">All categories</option>
                    {(categories.data?.data ?? []).map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                </select>
                <label className="sr-only" htmlFor="alg-diff">Difficulty</label>
                <select id="alg-diff" className={`${inputCls} w-auto`} value={difficulty} onChange={(e) => setDifficulty(e.target.value as "" | Difficulty)}>
                    <option value="">Any difficulty</option>
                    {DIFFICULTIES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                    ))}
                </select>
            </div>

            <QueryBoundary query={catalog} loadingLabel="Loading algorithms…">
                {items.length === 0 ? (
                    <p className="py-10 text-center text-foreground/60">No algorithms match. Try fewer filters.</p>
                ) : (
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {items.map((a) => (
                            <li key={a.id}>
                                <Link href={`/algorithms/${a.slug}`} className="flex h-full flex-col gap-2 rounded-2xl border border-foreground/10 bg-foreground/[.03] p-5 transition hover:border-accent/40">
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-lg font-semibold">{a.name}</h2>
                                        <span className="rounded-full border border-foreground/15 px-2 py-0.5 font-mono text-[11px] uppercase text-foreground/60">{a.difficulty}</span>
                                    </div>
                                    <p className="text-sm text-foreground/60">{a.description}</p>
                                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-foreground/50">
                                        <span>{a.categoryLabel}</span>
                                        {a.complexity?.timeAverage && <span className="font-mono">· {a.complexity.timeAverage}</span>}
                                        {a.tags.slice(0, 3).map((t) => (
                                            <span key={t.id}>#{t.label}</span>
                                        ))}
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
                {catalog.hasNextPage && (
                    <div className="mt-8 text-center">
                        <button type="button" className={btn} onClick={() => void catalog.fetchNextPage()} disabled={catalog.isFetchingNextPage}>
                            {catalog.isFetchingNextPage ? "Loading…" : "Load more"}
                        </button>
                    </div>
                )}
            </QueryBoundary>
        </PageShell>
    );
}
__P6_FILE__

write_file "$W/app/algorithms/[slug]/page.tsx" <<'__P6_FILE__'
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageShell } from "@/components/site/PageShell";
import { visualizer } from "@/components/visualizers/engine/instance";
import { compileScript } from "@/components/visualizers/script/compile";
import { saveScript } from "@/components/visualizers/script/storage";
import { btn, btnPrimary } from "@/components/visualizers/shared/styles";
import { isApiError } from "@/lib/api/errors";
import { QueryBoundary, useAlgorithm } from "@/lib/query";

export default function AlgorithmPage() {
    const params = useParams<{ slug: string }>();
    const slug = typeof params.slug === "string" ? params.slug : "";
    const router = useRouter();
    const query = useAlgorithm(slug);
    const [lang, setLang] = useState<string | null>(null);

    if (query.isError && isApiError(query.error) && query.error.status === 404) {
        return (
            <PageShell>
                <h1 className="mb-2 text-2xl font-bold">Algorithm not found</h1>
                <p className="mb-4 text-foreground/60">It may have been removed, or it is not published.</p>
                <Link href="/algorithms" className={btn}>Back to the catalog</Link>
            </PageShell>
        );
    }

    const a = query.data;
    const code = a ? (a.displayCodes.find((c) => c.language === lang) ?? a.displayCode) : null;

    // The visualizer reads the script saved in this browser; the store is loaded too so the canvas is ready at once.
    const open = () => {
        if (!a?.script) return;
        saveScript(a.script);
        visualizer.getState().load(compileScript(a.script));
        router.push("/dashboard?tab=visualizer");
    };

    return (
        <PageShell wide>
            <Link href="/algorithms" className="mb-4 inline-block text-sm text-foreground/60 hover:text-foreground">← All algorithms</Link>
            <QueryBoundary query={query} loadingLabel="Loading…">
                {a && (
                    <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr]">
                        <div>
                            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-foreground/50">{a.categoryLabel} · {a.difficulty}</p>
                            <h1 className="mb-3 text-3xl font-bold tracking-tight">{a.name}</h1>
                            <p className="mb-5 text-foreground/70">{a.description}</p>
                            {a.complexity && (
                                <dl className="mb-5 grid grid-cols-2 gap-3 text-sm">
                                    {([["Best", a.complexity.timeBest], ["Average", a.complexity.timeAverage], ["Worst", a.complexity.timeWorst], ["Space", a.complexity.space]] as const).map(([k, v]) => (
                                        <div key={k} className="rounded-xl border border-foreground/10 px-3 py-2">
                                            <dt className="text-xs text-foreground/50">{k}</dt>
                                            <dd className="font-mono">{v ?? "–"}</dd>
                                        </div>
                                    ))}
                                </dl>
                            )}
                            <div className="mb-5 flex flex-wrap gap-2 text-xs text-foreground/60">
                                {a.tags.map((t) => (
                                    <span key={t.id} className="rounded-full border border-foreground/15 px-2 py-0.5">#{t.label}</span>
                                ))}
                            </div>
                            {a.script ? (
                                <button type="button" className={btnPrimary} onClick={open}>Open in the visualizer</button>
                            ) : (
                                <p className="text-sm text-foreground/50">This algorithm has no visualization yet.</p>
                            )}
                        </div>
                        <div>
                            {code ? (
                                <div className="overflow-hidden rounded-2xl border border-foreground/10">
                                    <div className="flex items-center gap-2 border-b border-foreground/10 px-3 py-2">
                                        {a.displayCodes.map((c) => (
                                            <button key={c.language} type="button" aria-pressed={c.language === code.language} onClick={() => setLang(c.language)} className={`rounded-md px-2 py-1 font-mono text-xs ${c.language === code.language ? "bg-foreground text-background" : "text-foreground/60 hover:text-foreground"}`}>
                                                {c.language}
                                            </button>
                                        ))}
                                    </div>
                                    <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-6"><code>{code.code}</code></pre>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </QueryBoundary>
        </PageShell>
    );
}
__P6_FILE__

write_file "$W/components/visualizers/ui/SavedWork.tsx" <<'__P6_FILE__'
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { endpoints } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/errors";
import { useAuth, useFeatureState } from "@/lib/auth";
import { dropParams, NAV_EVENT, readDashboardParams } from "@/lib/navEvents";
import { queryKeys } from "@/lib/query/keys";
import { useVisualizations } from "@/lib/query/hooks";
import { btn, inputCls } from "../shared/styles";
import type { ScriptApi } from "./ScriptDrawer";

interface Current {
    id: string;
    title: string;
}

/** Save, open, rename and delete visualizations. Signed-in only; guests keep the browser copy and get a sign-in nudge. */
export function SavedWork({ api }: { api: ScriptApi }) {
    const { openLoginModal } = useAuth();
    const state = useFeatureState("savedWork", { uiReady: true });
    const ready = state === "ready";
    const qc = useQueryClient();
    const apiRef = useRef(api);
    useEffect(() => {
        apiRef.current = api;
    });

    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState<Current | null>(null);
    const [title, setTitle] = useState("");
    const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
    const list = useVisualizations({ enabled: ready && open });
    const rows = list.data?.pages.flatMap((p) => p.data) ?? [];

    const openById = useCallback(async (id: string) => {
        try {
            const v = await endpoints.visualization(id);
            apiRef.current.load(v.script);
            setCurrent({ id: v.id, title: v.title });
            setTitle(v.title);
            setNote({ ok: true, text: `Opened “${v.title}”.` });
        } catch (error) {
            setNote({ ok: false, text: errorMessage(error) });
        }
    }, []);

    // ?viz=<id> (from search results or a link) opens that saved visualization once.
    useEffect(() => {
        if (!ready) return;
        const check = () => {
            const { viz } = readDashboardParams();
            if (!viz) return;
            dropParams(["viz"]);
            void openById(viz);
        };
        check();
        window.addEventListener(NAV_EVENT, check);
        window.addEventListener("popstate", check);
        return () => {
            window.removeEventListener(NAV_EVENT, check);
            window.removeEventListener("popstate", check);
        };
    }, [ready, openById]);

    const save = useMutation({
        mutationFn: async (asNew: boolean) => {
            const name = title.trim() || "Untitled visualization";
            if (current && !asNew) return endpoints.updateVisualization(current.id, { title: name, script: apiRef.current.text });
            return endpoints.createVisualization({ title: name, script: apiRef.current.text });
        },
        onSuccess: (v) => {
            setCurrent({ id: v.id, title: v.title });
            setTitle(v.title);
            setNote({ ok: true, text: "Saved." });
            void qc.invalidateQueries({ queryKey: queryKeys.visualizations() });
        },
        onError: (error: unknown) => setNote({ ok: false, text: errorMessage(error) }),
    });

    const remove = useMutation({
        mutationFn: (id: string) => endpoints.deleteVisualization(id),
        onSuccess: (_data, id) => {
            if (current?.id === id) setCurrent(null);
            setNote({ ok: true, text: "Deleted." });
            void qc.invalidateQueries({ queryKey: queryKeys.visualizations() });
        },
        onError: (error: unknown) => setNote({ ok: false, text: errorMessage(error) }),
    });

    if (state === "needs-account") {
        return (
            <button
                type="button"
                className={btn}
                onClick={() => openLoginModal({ message: "Sign in to save your visualizations to your account. Without an account your script stays in this browser." })}
            >
                Sign in to save
            </button>
        );
    }
    if (!ready) return null;

    return (
        <>
            <label className="sr-only" htmlFor="viz-title">Title</label>
            <input id="viz-title" className={`${inputCls} h-8 w-44 py-0`} placeholder="Title" value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />
            <button type="button" className={btn} disabled={save.isPending} onClick={() => save.mutate(false)}>
                {save.isPending ? "Saving…" : current ? "Save" : "Save to account"}
            </button>
            {current && (
                <button type="button" className={btn} disabled={save.isPending} onClick={() => save.mutate(true)}>
                    Save as new
                </button>
            )}
            <button type="button" className={btn} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                My work {open ? "▾" : "▸"}
            </button>
            {note && (
                <span role="status" className={`text-xs ${note.ok ? "text-muted-foreground" : "text-destructive"}`}>
                    {note.text}
                </span>
            )}
            {open && (
                <div className="basis-full rounded-xl border border-primary-foreground/10 p-2">
                    {list.isPending ? (
                        <p className="p-2 text-xs text-muted-foreground">Loading…</p>
                    ) : rows.length === 0 ? (
                        <p className="p-2 text-xs text-muted-foreground">Nothing saved yet.</p>
                    ) : (
                        <ul className="flex max-h-48 flex-col overflow-y-auto">
                            {rows.map((r) => (
                                <li key={r.id} className="flex items-center gap-2 border-b border-primary-foreground/10 py-1.5 text-xs last:border-0">
                                    <span className="min-w-0 flex-1 truncate">
                                        {r.title} <span className="text-muted-foreground">· {r.stepCount} steps</span>
                                    </span>
                                    <button type="button" className={`${btn} h-6 px-2 text-xs`} onClick={() => void openById(r.id)}>Open</button>
                                    <button
                                        type="button"
                                        className={`${btn} h-6 px-2 text-xs`}
                                        disabled={remove.isPending}
                                        onClick={() => {
                                            if (window.confirm(`Delete “${r.title}”? This cannot be undone.`)) remove.mutate(r.id);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {list.hasNextPage && (
                        <button type="button" className={`${btn} mt-2 h-6 px-2 text-xs`} onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
                            Load more
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
__P6_FILE__

write_file "$W/components/visualizers/ui/VisualizerPanel.tsx" <<'__P6_FILE__'
"use client";
import { useEffect, useState, type ComponentType } from "react";
import type { StoreApi } from "zustand/vanilla";
import { VisualizerCanvas } from "../canvas";
import { visualizer } from "../engine/instance";
import type { VisualizerStore } from "../engine/store";
import { LazyScriptEditor } from "./LazyScriptEditor";
import { PlayerChrome } from "./PlayerChrome";
import { SavedWork } from "./SavedWork";
import { ScriptDrawer } from "./ScriptDrawer";
import type { ScriptEditorProps } from "./ScriptEditor";

interface Props {
    store?: StoreApi<VisualizerStore>;
    /** Tests pass a plain textarea instead of Monaco. */
    editor?: ComponentType<ScriptEditorProps>;
    dark?: boolean;
}

const CANVAS_CLASS =
    "relative min-h-[260px] w-full flex-1 touch-none select-none overflow-hidden rounded-2xl border border-neutral-500/25 bg-neutral-500/5 outline-none focus-visible:ring-2 focus-visible:ring-neutral-500/40";

/**
 * When the panel leaves the screen (another dashboard tab), its stages are destroyed.
 * Drop any half-played frame and rest on the last finished step, so coming back is
 * paused and consistent. The compiled script and cursor stay in the store.
 */
export function parkPlayback(store: StoreApi<VisualizerStore>): void {
    const s = store.getState();
    const t = s.transport;
    if (t.running !== null) s.seek(t.cursor);
}

/** The one component the dashboard mounts: canvas, narration, transport, script and saved work. Sized by its parent. */
export function VisualizerPanel({ store = visualizer, editor = LazyScriptEditor, dark = true }: Props) {
    // First visit (nothing compiled yet): open the script drawer so the empty state and examples are visible.
    const [openDrawer] = useState(() => store.getState().compiled === null);

    useEffect(() => () => parkPlayback(store), [store]);

    return (
        <div data-visualizer-panel className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto p-2">
            <div className="flex min-h-65 flex-1 flex-col">
                <VisualizerCanvas store={store} className={CANVAS_CLASS} />
            </div>
            <PlayerChrome store={store} />
            <ScriptDrawer editor={editor} store={store} dark={dark} defaultOpen={openDrawer} extras={(api) => <SavedWork api={api} />} />
        </div>
    );
}
__P6_FILE__

# ───────────────────────── 5. patches to existing files ─────────────────────────
log "Patching existing files"

patch_apply() { # rel mode old new flags marker soft
  P_REL="$ROOT/$1" P_MODE="$2" P_OLD="$3" P_NEW="$4" P_FLAGS="${5:-}" P_MARK="${6:-}" P_SOFT="${7:-0}" node -e '
const fs=require("fs");const e=process.env;const f=e.P_REL;let s=fs.readFileSync(f,"utf8");
if(e.P_MARK&&s.includes(e.P_MARK)){console.log("  already patched: "+f);process.exit(0);}
let out;
if(e.P_MODE==="lit"){const i=s.indexOf(e.P_OLD);
  if(i<0){if(e.P_SOFT==="1"){console.log("  skipped (not found): "+f);process.exit(0);}console.error("  pattern not found in "+f+": "+e.P_OLD.slice(0,70));process.exit(3);}
  out=s.slice(0,i)+e.P_NEW+s.slice(i+e.P_OLD.length);}
else{const re=new RegExp(e.P_OLD,e.P_FLAGS);
  if(!re.test(s)){if(e.P_SOFT==="1"){console.log("  skipped (not found): "+f);process.exit(0);}console.error("  pattern not found in "+f+": "+e.P_OLD.slice(0,70));process.exit(3);}
  out=s.replace(new RegExp(e.P_OLD,e.P_FLAGS),e.P_NEW);}
fs.writeFileSync(f,out);console.log("  patched: "+f);'
}
patch_lit() { guard_path "$1"; backup_file "$1"; patch_apply "$1" lit "$2" "$3" "" "${4:-}" "${5:-0}"; }
patch_re()  { guard_path "$1"; backup_file "$1"; patch_apply "$1" re "$2" "$3" "${4:-}" "${5:-}" "${6:-0}"; }
json_edit() { guard_path "$1"; backup_file "$1"; J_REL="$ROOT/$1" J_CODE="$2" node -e '
const fs=require("fs");const f=process.env.J_REL;const j=JSON.parse(fs.readFileSync(f,"utf8"));
(new Function("j",process.env.J_CODE))(j);
for(const k of ["dependencies","devDependencies"]) if(j[k]) j[k]=Object.fromEntries(Object.entries(j[k]).sort(([a],[b])=>a<b?-1:1));
fs.writeFileSync(f,JSON.stringify(j,null,2)+"\n");'; echo "  json edited: $1"; }

# Shared limits: one place for script size, catalog paging, search and saved-work caps.
write_file "packages/contracts/src/limits.ts" <<'__P6_FILE__'
/**
 * The single source of truth for every size, length and pagination limit.
 * The API validators, the Express body parser, the shared visualizer compiler and the frontend read these.
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
    algorithms: { defaultSize: 20, maxSize: 50 },
    visualizations: { defaultSize: 20, maxSize: 50 },
  },
  search: { maxQueryChars: 100, maxAlgorithmHits: 8, maxVisualizationHits: 5 },
  visualization: { maxPerUser: 100 },
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
__P6_FILE__

patch_lit packages/contracts/src/index.ts 'export * from "./visualizations";' $'export * from "./visualizations";\nexport * from "./search";' 'export * from "./search";'

patch_lit packages/contracts/src/routes.ts \
  'import { DeviceSessionListResponseSchema, UpdateProfileRequestSchema } from "./users";' \
  $'import { DeviceSessionListResponseSchema, UpdateProfileRequestSchema } from "./users";\nimport { SearchQuerySchema, SearchResponseSchema } from "./search";\nimport { CreateVisualizationRequestSchema, UpdateVisualizationRequestSchema, ValidateScriptRequestSchema, ValidateScriptResponseSchema, VisualizationListQuerySchema, VisualizationListResponseSchema, VisualizationSchema } from "./visualizations";' \
  'VisualizationListQuerySchema'

NEW_ROUTES=$(cat <<'__P6_ROUTES__'
  { id: "visualizationsList", method: "get", path: "/api/visualizations", summary: "List my saved visualizations (cursor pagination)", tag: "Visualizations", auth: "user", csrf: false, rateLimit: "general", query: VisualizationListQuerySchema, responses: { 200: VisualizationListResponseSchema } },
  { id: "visualizationsValidate", method: "post", path: "/api/visualizations/validate", summary: "Compile a script on the server and return diagnostics", tag: "Visualizations", auth: "user", csrf: true, rateLimit: "general", body: ValidateScriptRequestSchema, responses: { 200: ValidateScriptResponseSchema } },
  { id: "visualizationsCreate", method: "post", path: "/api/visualizations", summary: "Save a visualization (the script must compile without errors)", tag: "Visualizations", auth: "user", csrf: true, rateLimit: "general", body: CreateVisualizationRequestSchema, responses: { 201: VisualizationSchema } },
  { id: "visualizationsGet", method: "get", path: "/api/visualizations/{id}", summary: "One of my visualizations", tag: "Visualizations", auth: "user", csrf: false, rateLimit: "general", params: IdParamsSchema, responses: { 200: VisualizationSchema } },
  { id: "visualizationsUpdate", method: "patch", path: "/api/visualizations/{id}", summary: "Update one of my visualizations", tag: "Visualizations", auth: "user", csrf: true, rateLimit: "general", params: IdParamsSchema, body: UpdateVisualizationRequestSchema, responses: { 200: VisualizationSchema } },
  { id: "visualizationsDelete", method: "delete", path: "/api/visualizations/{id}", summary: "Delete one of my visualizations", tag: "Visualizations", auth: "user", csrf: true, rateLimit: "general", params: IdParamsSchema, responses: { 204: "empty" } },

  { id: "search", method: "get", path: "/api/search", summary: "Search published algorithms (and my saved visualizations when signed in)", tag: "Search", auth: "optional", csrf: false, rateLimit: "general", query: SearchQuerySchema, responses: { 200: SearchResponseSchema } },

__P6_ROUTES__
)
patch_lit packages/contracts/src/routes.ts '  { id: "metaCapabilities",' "$NEW_ROUTES"$'\n  { id: "metaCapabilities",' 'id: "visualizationsList"'

# One compiler, one size limit.
patch_lit "$PKG_REL/src/script/compile.ts" 'import { INSTANCE_ID_RE } from "../core/ids";' \
  $'import { LIMITS as CONTRACT_LIMITS } from "@algoforge/contracts/src/limits";\nimport { INSTANCE_ID_RE } from "../core/ids";' 'import { LIMITS as CONTRACT_LIMITS }'
patch_lit "$PKG_REL/src/script/compile.ts" 'chars: 1_000_000,' 'chars: CONTRACT_LIMITS.script.maxChars,' 'chars: CONTRACT_LIMITS.script.maxChars'

# API: env, rate limits, wiring.
patch_lit apps/api/src/config/env.ts \
  'defaultRateLimitPerMinute: parseInteger("DEFAULT_RATE_LIMIT_PER_MINUTE", 10),' \
  $'defaultRateLimitPerMinute: parseInteger("DEFAULT_RATE_LIMIT_PER_MINUTE", 10),\n    /** Catalog and search are cheap, cached reads: a dashboard plus a catalog page must not hit the analysis limit (A-13). */\n    catalogRateLimitPerMinute: parseInteger("CATALOG_RATE_LIMIT_PER_MINUTE", 120),\n    visualizationRateLimitPerMinute: parseInteger("VISUALIZATION_RATE_LIMIT_PER_MINUTE", 60),' \
  'catalogRateLimitPerMinute'

patch_lit apps/api/src/middleware/rate-limit.ts 'export function generalRateLimiter() {' \
  'export function generalRateLimiter(options: { scope?: string; limitPerMinute?: number } = {}) {' 'options: { scope?: string; limitPerMinute?: number }'
patch_lit apps/api/src/middleware/rate-limit.ts 'const limit = env.redis.defaultRateLimitPerMinute;' 'const limit = options.limitPerMinute ?? env.redis.defaultRateLimitPerMinute;' '' 1
patch_lit apps/api/src/middleware/rate-limit.ts 'const key = `rl:general:${ip}`;' 'const key = `rl:${options.scope ?? "general"}:${ip}`;' '' 1

patch_re apps/api/src/app.ts '(import userRouter\s+from "\.\/routes\/users";)' \
  $'$1\nimport visualizationRouter from "./routes/visualizations";\nimport searchRouter from "./routes/search";' '' 'import visualizationRouter'
patch_re apps/api/src/app.ts 'app\.use\("\/api\/algorithms", generalRateLimiter\(\), algorithmRouter\);' \
  'app.use("/api/algorithms", generalRateLimiter({ scope: "catalog", limitPerMinute: env.redis.catalogRateLimitPerMinute }), algorithmRouter);' '' '' 1
patch_lit apps/api/src/app.ts 'app.use("/api/meta", metaRouter);' \
  $'app.use("/api/meta", metaRouter);\napp.use("/api/visualizations", visualizationRouter);\napp.use("/api/search", searchRouter);' 'app.use("/api/visualizations"'

patch_lit apps/api/src/utils/capabilities.ts 'savedWork: false,' 'savedWork: true,' '' 1
patch_lit apps/api/src/utils/capabilities.ts ' * savedWork stays false until the visualization endpoints exist (Phase 6).' ' * savedWork is on: the visualization endpoints exist (Phase 6).' '' 1

# Existing tests that pinned the old savedWork value.
while IFS= read -r t; do
  [[ -n "$t" ]] || continue
  backup_file "$t"
  sed -i.p6bak -e 's/savedWork: false/savedWork: true/g' -e 's/savedWork)\.toBe(false)/savedWork).toBe(true)/g' "$ROOT/$t"
  rm -f "$ROOT/$t.p6bak"; echo "  updated test: $t"
done < <(grep -rIl "savedWork" apps packages --include='*.test.ts' --include='*.test.tsx' 2>/dev/null | grep -v node_modules || true)

patch_lit apps/api/src/repositories/visualization.repository.ts '  countByUser(userId: string) {' \
  $'  /** Title or description contains the term. Scoped to the owner inside the query. */\n  searchByUser(userId: string, term: string, take: number) {\n    const mode = Prisma.QueryMode.insensitive;\n    return prisma.visualization.findMany({\n      where: { userId, OR: [{ title: { contains: term, mode } }, { description: { contains: term, mode } }] },\n      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],\n      take,\n      select: { id: true, title: true, description: true },\n    });\n  },\n\n  countByUser(userId: string) {' 'searchByUser('

# Categories no longer depend on the forge package.
write_file "apps/api/src/validation/category.ts" <<'__P6_FILE__'
import {
  CreateCategoryRequestSchema,
  UpdateCategoryRequestSchema,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from "@algoforge/contracts";
import { badRequestFromZod } from "./common";

export function parseCreateCategory(value: unknown): CreateCategoryRequest {
  const result = CreateCategoryRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid category data.");
  return result.data;
}

export function parseUpdateCategory(value: unknown): UpdateCategoryRequest {
  const result = UpdateCategoryRequestSchema.safeParse(value);
  if (!result.success) throw badRequestFromZod(result.error, "Invalid category data.");
  return result.data;
}
__P6_FILE__

write_file "apps/api/src/services/category.service.ts" <<'__P6_FILE__'
//# filename: apps/api/src/services/category.service.ts

import {
  CategorySchema,
  type CategoryDto,
  type CreateCategoryRequest,
  type UpdateCategoryRequest,
} from "@algoforge/contracts";
import { categoryRepository } from "../repositories/category.repository";
import { AppError } from "../utils/app-error";

function serialize(category: {
  id: string;
  label: string;
  description: string | null;
  iconName: string | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): CategoryDto {
  return CategorySchema.parse({
    id: category.id,
    label: category.label,
    description: category.description,
    iconName: category.iconName,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  });
}

function normalizeCategoryId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

class CategoryService {
  async listCategories(): Promise<CategoryDto[]> {
    return (await categoryRepository.findAll()).map(serialize);
  }

  async getCategoryById(id: string): Promise<CategoryDto> {
    const row = await categoryRepository.findByIdentifier(id);
    if (!row) throw AppError.notFound("Category not found.");
    return serialize(row);
  }

  async createCategory(input: CreateCategoryRequest): Promise<CategoryDto> {
    const normalizedId = normalizeCategoryId(input.id ?? input.label);
    if (!normalizedId) throw AppError.badRequest("Category id cannot be empty.");

    const existing = await categoryRepository.findByIdentifier(normalizedId);
    if (existing) throw AppError.badRequest("Category already exists.");

    const row = await categoryRepository.create({
      id: normalizedId,
      label: input.label,
      description: input.description,
      iconName: input.iconName,
      sortOrder: input.sortOrder ?? 0,
    });
    return serialize(row);
  }

  async updateCategory(id: string, input: UpdateCategoryRequest): Promise<CategoryDto> {
    const existing = await categoryRepository.findByIdentifier(id);
    if (!existing) throw AppError.notFound("Category not found.");

    const row = await categoryRepository.update(existing.id, {
      label: input.label,
      description: input.description,
      iconName: input.iconName,
      sortOrder: input.sortOrder,
    });
    return serialize(row);
  }

  async deleteCategory(id: string): Promise<void> {
    const existing = await categoryRepository.findByIdentifier(id);
    if (!existing) throw AppError.notFound("Category not found.");

    const count = await categoryRepository.countAlgorithmsInCategory(existing.id);
    if (count > 0) throw AppError.badRequest("Cannot delete category with associated algorithms.");
    await categoryRepository.delete(existing.id);
  }
}

export const categoryService = new CategoryService();
__P6_FILE__

write_file "apps/api/src/services/visualization.service.ownership.test.ts" <<'__P6_FILE__'
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "@algoforge/contracts";
import { AppError } from "../utils/app-error";

vi.mock("../repositories/visualization.repository", () => ({
  visualizationRepository: {
    create: vi.fn(),
    findOneByUser: vi.fn(),
    findPageByUser: vi.fn(),
    updateByUser: vi.fn(),
    deleteByUser: vi.fn(),
    countByUser: vi.fn(),
    searchByUser: vi.fn(),
  },
}));

import { visualizationRepository as repo } from "../repositories/visualization.repository";
import { visualizationService } from "./visualization.service";

const good = JSON.stringify([{ step: 1, id: "A", ds: "array", op: "initialize", values: [1, 2] }]);
const m = <T extends (...a: never[]) => unknown>(fn: T) => fn as unknown as ReturnType<typeof vi.fn>;

describe("visualization ownership", () => {
  beforeEach(() => vi.clearAllMocks());

  it("get passes the acting user into the query and hides other people's rows", async () => {
    m(repo.findOneByUser).mockResolvedValue(null);
    await expect(visualizationService.get("me", "v1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.findOneByUser).toHaveBeenCalledWith("v1", "me");
  });

  it("update and delete are 404 when the owner does not match", async () => {
    m(repo.updateByUser).mockResolvedValue({ count: 0 });
    m(repo.deleteByUser).mockResolvedValue({ count: 0 });
    await expect(visualizationService.update("me", "v1", { title: "x" })).rejects.toBeInstanceOf(AppError);
    await expect(visualizationService.remove("me", "v1")).rejects.toMatchObject({ statusCode: 404 });
    expect(repo.updateByUser).toHaveBeenCalledWith("v1", "me", { title: "x" });
    expect(repo.deleteByUser).toHaveBeenCalledWith("v1", "me");
  });

  it("create validates the script, stores derived fields, and respects the per-user cap", async () => {
    m(repo.countByUser).mockResolvedValue(0);
    m(repo.create).mockResolvedValue({ id: "new" });
    await visualizationService.createFromRequest("me", { title: "t", script: good });
    expect(repo.create).toHaveBeenCalledWith("me", expect.objectContaining({ stepCount: 1, structures: [{ id: "A", ds: "array", label: "Array" }] }));

    m(repo.countByUser).mockResolvedValue(LIMITS.visualization.maxPerUser);
    await expect(visualizationService.createFromRequest("me", { title: "t", script: good })).rejects.toMatchObject({ statusCode: 409 });
  });

  it("create refuses a script with errors, before touching the database", async () => {
    await expect(visualizationService.createFromRequest("me", { title: "t", script: "{ bad" })).rejects.toMatchObject({ statusCode: 400 });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("an update with a script recomputes structures and step count", async () => {
    m(repo.updateByUser).mockResolvedValue({ count: 1 });
    m(repo.findOneByUser).mockResolvedValue({ id: "v1" });
    await visualizationService.updateFromRequest("me", "v1", { script: good });
    expect(repo.updateByUser).toHaveBeenCalledWith("v1", "me", expect.objectContaining({ stepCount: 1 }));
  });
});
__P6_FILE__

# Remove the forge package (code only). The forge_configs table stays: dropping it needs a NEW migration, run later.
json_edit apps/api/package.json 'if(j.devDependencies){delete j.devDependencies["@algoforge/forge"]; j.devDependencies["@algoforge/visualizer-core"]="workspace:*";}'
json_edit apps/web/package.json 'j.dependencies["@algoforge/visualizer-core"]="workspace:*";'
json_edit packages/db/package.json 'j.devDependencies=j.devDependencies||{}; j.devDependencies["@algoforge/visualizer-core"]="workspace:*";'
json_edit package.json '
if(!j.scripts.typecheck.includes("visualizer-core")) j.scripts.typecheck += " && pnpm --filter @algoforge/visualizer-core typecheck";
if(!j.scripts.test.includes("visualizer-core")) j.scripts.test += " && pnpm --filter @algoforge/visualizer-core test";
j.scripts["test:visualizer-core"]="pnpm --filter @algoforge/visualizer-core test";'

patch_lit apps/web/next.config.ts '"@algoforge/forge"' '"@algoforge/visualizer-core"' '' 1

refs=$(grep -rIl "@algoforge/forge" apps packages 2>/dev/null | grep -v node_modules | grep -v '^packages/forge/' || true)
if [[ -z "$refs" ]]; then
  log "Removing packages/forge (backed up)"
  remove_tree packages/forge
else
  echo "WARNING: packages/forge kept; still referenced by:"; echo "$refs"
fi

# Seed: the six catalog algorithms get real visualizer scripts from the shared package.
patch_lit packages/db/prisma/seed.ts 'import { prisma, Difficulty, Role, Prisma } from "../src/index";' \
  $'import { prisma, Difficulty, Role, Prisma } from "../src/index";\nimport { CATALOG_SCRIPTS } from "@algoforge/visualizer-core/src/catalog-scripts";' 'catalog-scripts'
patch_lit packages/db/prisma/seed.ts 'const script = scripts[a.slug] ?? null;' 'const script = CATALOG_SCRIPTS[a.slug] ?? scripts[a.slug] ?? null;' '' 1

# Web: search, tabs, saved work, privacy on sign-out.
patch_lit apps/web/src/components/DashBoard/TitleBar.tsx 'import { useRouter } from "next/navigation";' \
  $'import { useRouter } from "next/navigation";\nimport { NAV_EVENT } from "@/lib/navEvents";\nimport { useSearch } from "@/lib/search/useSearch";\nimport type { SearchResultItem } from "@/lib/search/items";' '@/lib/search/useSearch'
patch_re apps/web/src/components/DashBoard/TitleBar.tsx 'export interface SearchResultItem \{[\s\S]*?\n\}\n' $'export type { SearchResultItem };\n' '' '' 1
patch_re apps/web/src/components/DashBoard/TitleBar.tsx 'export const searchData: SearchResultItem\[\] = \[[\s\S]*?\n\];\n' '' '' '' 1
patch_lit apps/web/src/components/DashBoard/TitleBar.tsx 'items = searchData,' 'items,' '' 1
patch_re apps/web/src/components/DashBoard/TitleBar.tsx 'const results = useMemo\(\(\) => \{[\s\S]*?\}, \[items, query\]\);' \
  'const remote = useSearch(query, items === undefined); const results = useMemo(() => (items ?? remote.items).slice(0, MAX_RESULTS), [items, remote.items]);' '' '' 1
patch_re apps/web/src/components/DashBoard/TitleBar.tsx 'No results for [“"]\{query\}[”"]' \
  '{query ? (remote.loading ? "Searching…" : "No results for “" + query + "”") : "Type to search algorithms"}' '' '' 1
patch_lit apps/web/src/components/DashBoard/TitleBar.tsx 'router.push(item.href);' \
  'if (item.href.startsWith("/dashboard") && window.location.pathname === "/dashboard") { window.history.pushState(null, "", item.href); window.dispatchEvent(new Event(NAV_EVENT)); } else router.push(item.href);' \
  'window.dispatchEvent(new Event(NAV_EVENT))'

patch_lit apps/web/src/components/DashBoard/DashBoard.tsx 'import { SPLIT, loadSplit, saveSplit } from "@/lib/split";' \
  $'import { SPLIT, loadSplit, saveSplit } from "@/lib/split";\nimport { NAV_EVENT, readDashboardParams } from "@/lib/navEvents";' '@/lib/navEvents'
patch_lit apps/web/src/components/DashBoard/DashBoard.tsx 'const containerRef = useRef<HTMLElement | null>(null);' \
  $'const containerRef = useRef<HTMLElement | null>(null);\n\n    // ?tab=visualizer opens that tool; search results and the catalog use it.\n    useEffect(() => {\n        const sync = () => {\n            const { tab } = readDashboardParams();\n            if (tab) setActiveFeature(tab);\n        };\n        // eslint-disable-next-line react-hooks/set-state-in-effect -- the address only exists in the browser\n        sync();\n        window.addEventListener(NAV_EVENT, sync);\n        window.addEventListener("popstate", sync);\n        return () => {\n            window.removeEventListener(NAV_EVENT, sync);\n            window.removeEventListener("popstate", sync);\n        };\n    }, []);' 'window.addEventListener(NAV_EVENT, sync)'

SD=apps/web/src/components/visualizers/ui/ScriptDrawer.tsx
patch_lit $SD 'import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";' \
  'import { useCallback, useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";' '' 1
patch_re $SD '(interface Props \{)' \
  $'export interface ScriptApi {\n    /** The script text in the editor right now. */\n    text: string;\n    /** Replace the editor text and run it. */\n    load: (text: string) => void;\n}\n\ninterface Props {\n    /** Extra controls rendered in the header, for example saved work. */\n    extras?: (api: ScriptApi) => ReactNode;' '' 'export interface ScriptApi'
patch_lit $SD '{ editor: Editor, store = visualizer, dark = true, defaultOpen = false }: Props' \
  '{ editor: Editor, store = visualizer, dark = true, defaultOpen = false, extras }: Props' '' 1
patch_lit $SD '    const { errors, warnings } = countBySeverity(diagnostics);' \
  $'    const loadText = (t: string) => {\n        setText(t);\n        runText(t);\n    };\n    const { errors, warnings } = countBySeverity(diagnostics);' 'const loadText'
patch_re $SD '(\n\s*<span role="status" aria-live="polite" className=\{cn\("ml-auto)' \
  $'\n                {extras?.({ text, load: loadText })}$1' '' 'extras?.({ text'

patch_lit apps/web/src/lib/auth/AuthProvider.tsx 'queryClient.removeQueries({ queryKey: ["explain"] });' \
  $'queryClient.removeQueries({ queryKey: ["explain"] });\n  queryClient.removeQueries({ queryKey: ["visualizations"] });' 'queryKey: ["visualizations"]'

if ! grep -qxF ".phase6-backup/" .gitignore 2>/dev/null; then
  backup_file .gitignore; printf '\n.phase6-backup/\n' >> .gitignore
fi

# ───────────────────────── 6. install and checks ─────────────────────────
if [[ "$SKIP_CHECKS" == "1" ]]; then
  log "Changes applied. Checks skipped (--skip-checks)."
  echo "Next: pnpm install --no-frozen-lockfile && pnpm ci && pnpm test && pnpm build"
  exit 0
fi

backup_file pnpm-lock.yaml
log "pnpm install"
pnpm install --no-frozen-lockfile

FAILED=()
run_check() {
  local name="$1"; shift
  log "Check: $name"
  if "$@"; then echo "PASS: $name"; else echo "FAIL: $name"; FAILED+=("$name"); fi
}
run_check "prisma generate"      pnpm db:generate
run_check "typecheck (api, db, contracts, visualizer-core)" pnpm typecheck
run_check "typecheck web"        pnpm typecheck:web
run_check "lint api"             pnpm lint
run_check "lint web"             pnpm lint:web
run_check "tests"                pnpm test
run_check "build (api + web)"    pnpm build

echo
if ((${#FAILED[@]})); then
  echo "Phase 6 applied, but these checks FAILED:"; printf '  - %s\n' "${FAILED[@]}"
  echo "Backups are in .phase6-backup/. Undo everything with: bash phase6.sh --rollback"
  exit 1
fi
echo "Phase 6 applied and every check passed."