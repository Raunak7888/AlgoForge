#!/usr/bin/env bash
# Phase 1: remove OpenRouter. Gemini becomes the only AI provider.
#
# Usage (run from the repo root):
#   bash phase1.sh --dry-run        show what would change, touch nothing
#   bash phase1.sh                  apply, install, verify
#   bash phase1.sh --skip-install   do not run pnpm install
#   bash phase1.sh --skip-verify    do not run typecheck / lint / test / build
#
# Safe to run twice. Every changed file is copied to .phase-backups/ first.
set -Eeuo pipefail
trap 'echo "[phase1] FAILED at line $LINENO" >&2' ERR

DRY_RUN=0
SKIP_INSTALL=0
SKIP_VERIFY=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --skip-install) SKIP_INSTALL=1 ;;
    --skip-verify) SKIP_VERIFY=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

log()  { printf '[phase1] %s\n' "$*"; }
warn() { printf '[phase1] WARN: %s\n' "$*" >&2; }
die()  { printf '[phase1] ERROR: %s\n' "$*" >&2; exit 1; }

SELF="$(basename "$0")"

# ---------- preflight ----------
if ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then cd "$ROOT"; fi
[ -f package.json ] || die "Run this from the repo root (package.json not found)."
[ -d apps/api/src ] || die "apps/api/src not found. Is this the AlgoForge repo?"
[ -f apps/api/src/config/env.ts ] || die "apps/api/src/config/env.ts not found."
command -v node >/dev/null 2>&1 || die "node is required."
if [ "$SKIP_INSTALL" = 0 ] || [ "$SKIP_VERIFY" = 0 ]; then
  [ "$DRY_RUN" = 1 ] || command -v pnpm >/dev/null 2>&1 || die "pnpm is required (or pass --skip-install --skip-verify)."
fi

BACKUP_DIR=".phase-backups/phase1-$(date +%Y%m%d-%H%M%S)"
export DRY="$DRY_RUN" BACKUP_DIR

if [ "$DRY_RUN" = 1 ]; then log "DRY RUN: nothing will be changed."; else log "Backups go to $BACKUP_DIR"; fi

backup() {
  local f="$1"
  [ -f "$f" ] || return 0
  mkdir -p "$BACKUP_DIR/$(dirname "$f")"
  cp "$f" "$BACKUP_DIR/$f"
}

write_file() {
  local f="$1" tmp
  tmp="$(mktemp)"
  cat >"$tmp"
  if [ -f "$f" ] && cmp -s "$tmp" "$f"; then
    log "unchanged: $f"; rm -f "$tmp"; return 0
  fi
  if [ "$DRY_RUN" = 1 ]; then
    log "would write: $f"; rm -f "$tmp"; return 0
  fi
  backup "$f"
  mkdir -p "$(dirname "$f")"
  mv "$tmp" "$f"
  chmod 644 "$f"
  log "wrote: $f"
}

# ---------- node helper (edits that need parsing) ----------
TOOL="$(mktemp "${TMPDIR:-/tmp}/phase1-tool.XXXXXX")"
trap 'rm -f "$TOOL"' EXIT
cat >"$TOOL" <<'JS'
const fs = require("fs");
const path = require("path");

const [cmd, file, ...rest] = process.argv.slice(2);
const dry = process.env.DRY === "1";
const backupRoot = process.env.BACKUP_DIR;

function save(next, prev) {
  if (next === prev) { console.log(`[phase1] unchanged: ${file}`); return; }
  if (dry) { console.log(`[phase1] would change: ${file}`); return; }
  const dest = path.join(backupRoot, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
  fs.writeFileSync(file, next);
  console.log(`[phase1] changed: ${file}`);
}

if (cmd === "env-ts") {
  const prev = fs.readFileSync(file, "utf8");
  const crlf = prev.includes("\r\n");
  let s = crlf ? prev.replace(/\r\n/g, "\n") : prev;

  const steps = [
    [/^const AI_PROVIDERS = .*\n/m, ""],
    [/^type AIProvider = .*\n\n?/m, ""],
    [/^function parseStringEnum[\s\S]*?^}\n\n?/m, ""],
    [/^function parseList[\s\S]*?^}\n\n?/m, ""],
    [/^const aiProvider = .*\n/m, ""],
    [/^\/\/ Provider-specific validation[\s\S]*?^if \(aiProvider === "openrouter"\) \{[\s\S]*?^\}\n/m, ""],
    [/^const geminiApiKey =[\s\S]*?;\n/m, 'const geminiApiKey = requireEnv("GEMINI_API_KEY");\n'],
    [/^\/\/ No hard-coded model.*\n/m, "// No hard-coded model: it must be chosen explicitly.\n"],
    [/^const aiModel = .*\n/m, 'const aiModel = requireEnv("AI_MODEL");\n'],
    [/^ {4}provider: aiProvider as AIProvider,\n/m, ""],
    [/^ {2}openRouter: \{[\s\S]*?^ {2}\},\n/m, ""],
  ];
  for (const [re, to] of steps) s = s.replace(re, to);
  s = s.replace(/\n{3,}/g, "\n\n");

  if (/openrouter|aiProvider|AI_PROVIDERS/i.test(s)) {
    console.error(`[phase1] ERROR: ${file} still mentions OpenRouter after patching. It differs from what this script expects. Edit it by hand.`);
    process.exit(1);
  }
  save(crlf ? s.replace(/\n/g, "\r\n") : s, prev);
} else if (cmd === "package-json") {
  const prev = fs.readFileSync(file, "utf8");
  const json = JSON.parse(prev);
  const removed = [];
  for (const sec of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
    if (!json[sec]) continue;
    for (const name of rest) {
      if (name in json[sec]) { delete json[sec][name]; removed.push(`${name} (${sec})`); }
    }
  }
  if (removed.length) console.log(`[phase1] ${file}: removing ${removed.join(", ")}`);
  const indent = /^([ \t]+)"/m.exec(prev)?.[1] ?? "  ";
  const next = JSON.stringify(json, null, indent) + (prev.endsWith("\n") ? "\n" : "");
  save(removed.length ? next : prev, prev);
} else if (cmd === "strip-lines") {
  const prev = fs.readFileSync(file, "utf8");
  const re = new RegExp(rest[0], "i");
  const lines = prev.split(/(?<=\n)/);
  const kept = lines.filter((l) => !re.test(l));
  save(kept.join(""), prev);
} else {
  console.error(`[phase1] unknown tool command: ${cmd}`);
  process.exit(1);
}
JS

# directories never scanned or touched
FIND_PRUNE=( \( -name node_modules -o -name .git -o -name dist -o -name .next -o -name .turbo -o -name .phase-backups \) -prune -o )

# ---------- 1. delete OpenRouter files ----------
log "Step 1/9: delete OpenRouter files"
found=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  found=1
  if [ "$DRY_RUN" = 1 ]; then log "would delete: $f"; else backup "$f"; rm -f "$f"; log "deleted: $f"; fi
done < <(find . "${FIND_PRUNE[@]}" -type f -iname '*openrouter*' -print)
[ "$found" = 1 ] || log "no OpenRouter files found (already removed)"

# ---------- 2. provider factory: Gemini only ----------
log "Step 2/9: provider factory"
write_file apps/api/src/services/providers/provider-factory.ts <<'EOF'
import { env } from "../../config/env";
import type { AIProvider } from "./ai-provider";
import { GeminiProvider } from "./gemini.provider";

let _instance: AIProvider | null = null;

/** Gemini is the only AI provider. */
export function getAIProvider(): AIProvider {
  _instance ??= new GeminiProvider({
    apiKey: env.geminiApiKey,
    model: env.ai.model,
  });
  return _instance;
}
EOF

# ---------- 3. provider contract without OpenRouter-only fields ----------
log "Step 3/9: provider contract"
write_file apps/api/src/services/providers/ai-provider.ts <<'EOF'
export type AIMessageRole = "system" | "user" | "assistant";

export type AIMessage = {
  role: AIMessageRole;
  content: string;
};

export type AIGenerateRequest = {
  messages: AIMessage[];
  responseFormat?: "json" | "text";
  /** Upper bound for the length of the answer. */
  maxOutputTokens?: number;
  /** Per-attempt budget in ms. Gemini makes one attempt, so the overall timeout applies. */
  attemptTimeoutMs?: number;
  /** Aborts the underlying HTTP request when it fires. */
  signal?: AbortSignal;
};

export type AIGenerateResponse = {
  model: string;
  message: AIMessage;
  history: AIMessage[];
};

export interface AIProvider {
  readonly name: string;
  generate(request: AIGenerateRequest): Promise<AIGenerateResponse>;
}
EOF

# ---------- 4. capabilities ----------
log "Step 4/9: capabilities service"
write_file apps/api/src/services/capabilities.service.ts <<'EOF'
import type { CapabilitiesResponse } from "@algoforge/contracts";
import { env } from "../config/env";
import { buildCapabilities } from "../utils/capabilities";

function isAiConfigured(): boolean {
  return env.geminiApiKey.length > 0 && env.ai.model.length > 0;
}

export const capabilitiesService = {
  get(): CapabilitiesResponse {
    return buildCapabilities({ aiConfigured: isAiConfigured() });
  },
};
EOF

# ---------- 5. env.ts ----------
log "Step 5/9: config/env.ts"
node "$TOOL" env-ts apps/api/src/config/env.ts

# ---------- 6. package manifests ----------
log "Step 6/9: package manifests"
while IFS= read -r pkg; do
  [ -n "$pkg" ] || continue
  node "$TOOL" package-json "$pkg" "@openrouter/ai-sdk-provider" "@openrouter/sdk"
done < <(find . "${FIND_PRUNE[@]}" -type f -name package.json -print)

if grep -RIlE --exclude='*openrouter*' "from ['\"]openai['\"]|require\(['\"]openai['\"]\)" apps/api/src >/dev/null 2>&1; then
  warn "Something in apps/api/src still imports 'openai'. Keeping that dependency."
else
  node "$TOOL" package-json apps/api/package.json openai
fi

# ---------- 7. env example files ----------
log "Step 7/9: .env example files"
while IFS= read -r f; do
  [ -n "$f" ] || continue
  node "$TOOL" strip-lines "$f" '(openrouter|^\s*#?\s*AI_PROVIDER\s*=)'
done < <(find . "${FIND_PRUNE[@]}" -type f \( -name '.env.example' -o -name '.env.*.example' -o -name 'env.example' \) -print)

# ---------- 8. guard test ----------
log "Step 8/9: guard test"
write_file apps/api/src/services/providers/provider-factory.test.ts <<'EOF'
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../config/env", () => ({
  env: { isProduction: false, geminiApiKey: "test-key", ai: { model: "test-model" } },
}));

import { getAIProvider } from "./provider-factory";

// Built from pieces so this file does not match its own search.
const REMOVED = new RegExp("open" + "router", "i");
const REMOVED_SDK = "open" + "ai";

const cwd = process.cwd();
const API_ROOT = existsSync(join(cwd, "src")) ? cwd : join(cwd, "apps", "api");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === "dist") return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe("AI provider", () => {
  it("is Gemini, and only Gemini", () => {
    const provider = getAIProvider();
    expect(provider.name).toBe("gemini");
    expect(getAIProvider()).toBe(provider);
  });

  it("has no removed-provider code in the API source", () => {
    const offenders = walk(join(API_ROOT, "src"))
      .filter((f) => f.endsWith(".ts"))
      .filter((f) => REMOVED.test(f) || REMOVED.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("does not depend on the removed provider or its SDK", () => {
    const pkg = JSON.parse(readFileSync(join(API_ROOT, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})];
    expect(names.filter((n) => REMOVED.test(n) || n === REMOVED_SDK)).toEqual([]);
  });
});
EOF

# ---------- 9. install, scan, verify ----------
log "Step 9/9: install, scan, verify"

if [ "$DRY_RUN" = 1 ]; then
  log "Dry run complete. Nothing was changed."
  exit 0
fi

if [ "$SKIP_INSTALL" = 0 ]; then
  pnpm install --no-frozen-lockfile
else
  warn "Skipped install. pnpm-lock.yaml may still list removed packages. Run: pnpm install"
fi

log "Scanning the repo for leftovers (file:line only, no line contents)"
SCAN_EXCLUDES=( --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=.next --exclude-dir=.turbo --exclude-dir=.phase-backups --exclude="$SELF" )
[ "$SKIP_INSTALL" = 1 ] && SCAN_EXCLUDES+=( --exclude=pnpm-lock.yaml )
HITS="$(grep -RInoiE "${SCAN_EXCLUDES[@]}" 'openrouter|\bAI_PROVIDER\b' . 2>/dev/null || true)"
if [ -n "$HITS" ]; then
  warn "OpenRouter references remain. Remove them by hand (docs, CI, compose, local .env, tests):"
  printf '%s\n' "$HITS" >&2
else
  log "No OpenRouter references found."
fi

if [ "$SKIP_VERIFY" = 0 ]; then
  log "Verify: prisma generate"; pnpm db:generate
  log "Verify: typecheck";       pnpm typecheck
  log "Verify: lint";            pnpm lint
  log "Verify: api tests";       pnpm --filter api test
  log "Verify: api build";       pnpm build:api
else
  warn "Skipped verification."
fi

log "Done. Backups: $BACKUP_DIR (delete it when you are happy)."
log "Reminder: GEMINI_API_KEY and AI_MODEL are now always required."
[ -z "$HITS" ] || { warn "Finish the leftovers above, then re-run: bash $SELF"; exit 2; }