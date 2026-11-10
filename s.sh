#!/usr/bin/env bash
# Phase 0b-2a: insert-size notice, live size badge, and a file collector for Phase 0b-2b.
# Run from the project root, after phase0b.sh.
#   bash phase0b2.sh --dry-run       validate edits, list files to collect, write nothing
#   bash phase0b2.sh                 apply, build the collection file, run checks
#   bash phase0b2.sh --collect-only  only build ALGOFORGE_0B2_COLLECTION.txt
#   bash phase0b2.sh --skip-checks   apply without running the checks
set -euo pipefail

DRY_RUN=0
SKIP_CHECKS=0
COLLECT_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-checks) SKIP_CHECKS=1 ;;
    --collect-only) COLLECT_ONLY=1 ;;
    *) echo "Unknown option: $arg"; exit 2 ;;
  esac
done

if [ ! -d apps/api/src ] || [ ! -d apps/web/src ] || [ ! -d packages/contracts/src ] || [ ! -f package.json ]; then
  echo "Run this from the AlgoForge project root (the folder containing apps/ and packages/)."
  exit 1
fi
command -v node >/dev/null 2>&1 || { echo "node is required."; exit 1; }

STAMP="$(date +%Y%m%d-%H%M%S)"
STAGE=".phase0b2-stage"
BACKUP_DIR=".phase0b2-backup/$STAMP"
OUT="ALGOFORGE_0B2_COLLECTION.txt"
rm -rf "$STAGE"
mkdir -p "$STAGE/new"
trap 'rm -rf "$STAGE"' EXIT

# ---------------------------------------------------------------------------
# Staged new file
# ---------------------------------------------------------------------------

cat > "$STAGE/new/CodeSizeBadge.tsx" <<'__BADGE__'
// Phase 0b-2: live code size indicator
"use client";

import { useCodeLimits } from "@/lib/workspace/code-limits";

/**
 * "12 / 100 lines". Turns red above the limit, with the reason as a tooltip.
 * Mount it next to the editor. Uses the same check as the API.
 */
export function CodeSizeBadge({ className = "" }: { className?: string }) {
    const { check, maxLines, maxChars } = useCodeLimits();
    const over = !check.ok && (check.reason === "too_many_lines" || check.reason === "too_long");
    const showChars = !check.ok && check.reason === "too_long";

    return (
        <span
            data-testid="code-size-badge"
            aria-live="polite"
            title={check.ok ? undefined : check.message}
            className={`font-mono text-[11px] tabular-nums ${over ? "text-red-400" : "text-zinc-500"} ${className}`}
        >
            {check.lines} / {maxLines} lines
            {showChars ? ` · ${check.chars.toLocaleString()} / ${maxChars.toLocaleString()} chars` : ""}
        </span>
    );
}
__BADGE__

# ---------------------------------------------------------------------------
# Edit engine (validate everything first, then write with backups)
# ---------------------------------------------------------------------------

cat > "$STAGE/apply.cjs" <<'__APPLY_JS__'
const fs = require("fs");
const path = require("path");

const STAGE = process.env.STAGE;
const BACKUP_DIR = process.env.BACKUP_DIR;
const DRY = process.env.DRY_RUN === "1";

const files = new Map(); // rel path -> { original (null if new), text, eol }
const problems = [];

function staged(name) {
  return fs.readFileSync(path.join(STAGE, "new", name), "utf8").replace(/\r\n/g, "\n");
}

function load(rel) {
  if (!files.has(rel)) {
    const raw = fs.readFileSync(rel, "utf8");
    const eol = raw.includes("\r\n") ? "\r\n" : "\n";
    const text = raw.replace(/\r\n/g, "\n");
    files.set(rel, { original: text, text, eol });
  }
  return files.get(rel);
}

function exists(rel) {
  if (!fs.existsSync(rel)) {
    problems.push(rel + ": file not found");
    return false;
  }
  return true;
}

function edit(rel, pairs) {
  if (!exists(rel)) return;
  const f = load(rel);
  for (const [oldStr, newStr] of pairs) {
    const count = f.text.split(oldStr).length - 1;
    const applied = f.text.includes(newStr);
    if (applied && (count === 0 || newStr.includes(oldStr))) continue;
    if (count === 1) {
      f.text = f.text.replace(oldStr, () => newStr);
      continue;
    }
    problems.push(rel + ": anchor " + (count === 0 ? "not found" : "found " + count + " times") + ": " + oldStr.trim().slice(0, 90));
  }
}

function create(rel, text, marker) {
  if (fs.existsSync(rel)) {
    const f = load(rel);
    if (!f.text.includes(marker)) {
      problems.push(rel + ": already exists and was not created by this script");
      return;
    }
    f.text = text;
    return;
  }
  files.set(rel, { original: null, text, eol: "\n" });
}

// ---- Preflight: Phase 0b must be applied ------------------------------------

const limitsFile = "packages/contracts/src/limits.ts";
if (!fs.existsSync(limitsFile) || !fs.readFileSync(limitsFile, "utf8").includes("export function checkRunnableCode")) {
  problems.push("Phase 0b is not applied (checkRunnableCode is missing from packages/contracts/src/limits.ts). Run phase0b.sh first.");
}
if (!fs.existsSync("apps/web/src/lib/workspace/code-limits.ts")) {
  problems.push("Phase 0b is not applied (apps/web/src/lib/workspace/code-limits.ts is missing). Run phase0b.sh first.");
}

// ---- 1. Live size badge ------------------------------------------------------

create("apps/web/src/components/DashBoard/CodeSizeBadge.tsx", staged("CodeSizeBadge.tsx"), "// Phase 0b-2: live code size indicator");

// ---- 2. Insert notice: AI code over the limit still inserts, but says so ----

edit("apps/web/src/components/DashBoard/AiChatDrawer.tsx", [
  [
    'import type { ExplainSessionDetail } from "@algoforge/contracts";',
    'import { countLines, LIMITS, type ExplainSessionDetail } from "@algoforge/contracts";',
  ],
  [
    "if (!window.confirm(`Replace the ${lang} code in the editor with this snippet?`)) return;",
    [
      "const lines = countLines(code);",
      "        const oversize =",
      "            lines > LIMITS.code.runMaxLines",
      "                ? ` It is ${lines} lines: code analysis and the visualizer support up to ${LIMITS.code.runMaxLines}, so they will not run on it.`",
      '                : "";',
      "        if (!window.confirm(`Replace the ${lang} code in the editor with this snippet?${oversize}`)) return;",
    ].join("\n"),
  ],
]);

// ---- Write -------------------------------------------------------------------

if (problems.length) {
  console.error("\nNothing was written. Fix these first:");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

let changed = 0;
for (const [rel, f] of files) {
  if (f.text === f.original) continue;
  changed++;
  if (DRY) {
    console.log("  would " + (f.original === null ? "create " : "change ") + " " + rel);
    continue;
  }
  if (f.original !== null) {
    const backup = path.join(BACKUP_DIR, rel);
    fs.mkdirSync(path.dirname(backup), { recursive: true });
    fs.copyFileSync(rel, backup);
  }
  fs.mkdirSync(path.dirname(rel), { recursive: true });
  fs.writeFileSync(rel, f.eol === "\r\n" ? f.text.replace(/\n/g, "\r\n") : f.text);
  console.log("  " + (f.original === null ? "created       " : "changed       ") + rel);
}

if (changed === 0) console.log("Nothing to change: Phase 0b-2a is already applied.");
else console.log((DRY ? "Dry run: " : "") + changed + " file(s) " + (DRY ? "would change." : "written. Backups in " + BACKUP_DIR));
__APPLY_JS__

echo "Phase 0b-2a: size badge and insert notice"
if [ "$COLLECT_ONLY" = "0" ]; then
  STAGE="$STAGE" BACKUP_DIR="$BACKUP_DIR" DRY_RUN="$DRY_RUN" node "$STAGE/apply.cjs"
fi

# ---------------------------------------------------------------------------
# Collector: gathers the files Phase 0b-2b needs into one text file
# ---------------------------------------------------------------------------

echo
echo "Collecting files for Phase 0b-2b"
LIST="$STAGE/files.txt"
: > "$LIST"

for f in \
  apps/web/src/lib/workspace/store.ts \
  apps/web/src/lib/api/endpoints.ts \
  apps/web/src/lib/markdown/markdown.ts \
  apps/web/src/components/visualizers/engine/instance.ts \
  apps/web/src/components/visualizers/script/storage.ts \
  packages/contracts/src/errors.ts \
  packages/contracts/src/index.ts; do
  [ -f "$f" ] && echo "$f" >> "$LIST"
done

GREP_OPTS=(-rlE --include='*.ts' --include='*.tsx' --exclude='*.test.*' --exclude='*.spec.*'
           --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=dist --exclude-dir=.turbo --exclude-dir=coverage)

grep "${GREP_OPTS[@]}" '@monaco-editor/react' apps/web/src >> "$LIST" 2>/dev/null || true
grep "${GREP_OPTS[@]}" 'loadScript\(|saveScript\(|engine/instance' apps/web/src >> "$LIST" 2>/dev/null || true
grep "${GREP_OPTS[@]}" 'assertValidScript|checkScript|analyzeScript' apps/api/src >> "$LIST" 2>/dev/null || true
find apps/api/src packages/contracts/src -type f \( -iname '*visualiz*' -o -iname '*capabilit*' \) ! -name '*.test.*' ! -name '*.spec.*' -print >> "$LIST" 2>/dev/null || true

sort -u "$LIST" -o "$LIST"

MAX_FILE_BYTES=80000
MAX_TOTAL_BYTES=700000
TOTAL=0
COUNT=0
INCLUDED="$STAGE/included.txt"
: > "$INCLUDED"
while IFS= read -r f; do
  [ -f "$f" ] || continue
  size="$(wc -c < "$f" | tr -d ' ')"
  if [ "$size" -gt "$MAX_FILE_BYTES" ]; then
    echo "  skipped (over ${MAX_FILE_BYTES} bytes): $f"
    continue
  fi
  if [ $((TOTAL + size)) -gt "$MAX_TOTAL_BYTES" ]; then
    echo "  skipped (collection size cap reached): $f"
    continue
  fi
  TOTAL=$((TOTAL + size))
  COUNT=$((COUNT + 1))
  echo "$f" >> "$INCLUDED"
  echo "  $f"
done < "$LIST"

if [ "$DRY_RUN" = "1" ]; then
  echo "Dry run: would write $OUT with $COUNT file(s). Nothing was written."
  exit 0
fi

{
  echo "============================================================"
  echo "ALGOFORGE PHASE 0b-2 FILE COLLECTION"
  echo "Generated: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "Project root: $(pwd)"
  echo "============================================================"
  echo
  echo "Included files: $COUNT"
  echo "============================================================"
  while IFS= read -r f; do
    echo
    echo
    echo "################################################################"
    echo "FILE: $f"
    echo "################################################################"
    echo
    sed 's/\r$//' "$f"
  done < "$INCLUDED"
  echo
  echo "============================================================"
  echo "END OF COLLECTION"
  echo "============================================================"
} > "$OUT"

echo "Wrote $OUT ($COUNT file(s), $TOTAL bytes)."

if [ -d .git ]; then
  for pat in ".phase0b2-backup/" "$OUT"; do
    grep -qxF "$pat" .git/info/exclude 2>/dev/null || echo "$pat" >> .git/info/exclude
  done
fi

if [ "$COLLECT_ONLY" = "1" ] || [ "$SKIP_CHECKS" = "1" ]; then
  echo "Skipped checks."
  exit 0
fi

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

if [ -f pnpm-lock.yaml ]; then PM=pnpm; elif [ -f yarn.lock ]; then PM=yarn; else PM=npm; fi
SCRIPTS="$(node -e 'const s=require("./package.json").scripts||{};console.log(["typecheck","lint","test","build"].filter(k=>s[k]).join(" "))')"

if [ -z "$SCRIPTS" ]; then
  echo "No typecheck/lint/test/build scripts in the root package.json. Run them per package."
  exit 0
fi

FAILED=""
for s in $SCRIPTS; do
  echo
  echo "==> $PM run $s"
  $PM run "$s" || FAILED="$FAILED $s"
done

echo
if [ -n "$FAILED" ]; then
  echo "Checks failed:$FAILED"
  echo "Backups are in $BACKUP_DIR."
  exit 1
fi
echo "Phase 0b-2a applied and all checks passed. Next: send $OUT."