#!/usr/bin/env bash
# =============================================================================
# AlgoForge - Phase 3 validation only
# Run from the project root:  bash validate-phase3.sh
# Does not write or modify any project files.
# =============================================================================
set -Eeuo pipefail

ROOT="$(pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
trap 'echo "ERROR: validate-phase3.sh failed near line $LINENO" >&2' ERR

VALIDATION=()
REQUIRED_FAILED=0

die()  { echo "ERROR: $*" >&2; exit 1; }
info() { echo "==> $*"; }

[[ -f apps/api/package.json && -f packages/db/package.json && -d apps/web ]] || die "Run this from the AlgoForge project root."
[[ -f packages/contracts/package.json ]] || die "packages/contracts is missing. Run phase3.sh first."

# TypeScript files that phase3.sh writes (used for the banned-escapes scan)
shopt -s nullglob
WRITTEN_TS=(
  packages/contracts/src/*.ts
  apps/api/src/contracts/*.ts
  apps/api/src/serializers/*.ts
  apps/api/src/utils/app-error.ts
  apps/api/src/utils/pagination.ts
  apps/api/src/validation/common.ts
  apps/api/src/validation/analysis.ts
  apps/api/src/validation/explanation-session.ts
  apps/api/src/middleware/error-handler.ts
  apps/api/src/middleware/request-id.ts
  apps/api/src/routes/openapi.ts
  apps/web/src/lib/api/*.ts
  apps/web/src/lib/query/*.ts
  apps/web/src/lib/query/*.tsx
)
shopt -u nullglob

run_check() {
  local name="$1" required="$2"; shift 2
  local log="$WORK/check-$(printf '%s' "$name" | tr -c 'A-Za-z0-9' '_').log"
  if "$@" >"$log" 2>&1; then
    VALIDATION+=("PASS  $name")
  else
    if [[ "$required" == "required" ]]; then
      VALIDATION+=("FAIL  $name (required)"); REQUIRED_FAILED=1
    else
      VALIDATION+=("FAIL  $name (advisory)")
    fi
    echo "---- $name: last 25 lines ----"; tail -n 25 "$log"; echo "------------------------------"
  fi
}

# =============================================================================
info "1/2 Install dependencies (lockfile updates are allowed)"
# =============================================================================
if command -v pnpm >/dev/null 2>&1; then
  run_check "pnpm install" required pnpm install --no-frozen-lockfile
else
  VALIDATION+=("FAIL  pnpm not found (required)"); REQUIRED_FAILED=1
fi

# =============================================================================
info "2/2 Validate"
# =============================================================================
if command -v pnpm >/dev/null 2>&1; then
  run_check "db generate"                           required pnpm --filter @algoforge/db generate
  run_check "contracts typecheck"                   required pnpm --filter @algoforge/contracts typecheck
  run_check "contracts tests"                       required pnpm --filter @algoforge/contracts test
  run_check "api typecheck"                         required pnpm --filter api typecheck
  run_check "api tests (incl. response validation)" required pnpm --filter api test
  run_check "api lint"                              advisory pnpm --filter api lint
  run_check "api build (tsup bundle)"               required pnpm --filter api build
  run_check "web typecheck"                         required pnpm --filter @algoforge/web typecheck
  run_check "web tests"                             required pnpm --filter @algoforge/web test
  run_check "web lint"                              advisory pnpm --filter @algoforge/web lint
fi

if [[ ${#WRITTEN_TS[@]} -gt 0 ]]; then
  if grep -nE ': any\b|as any\b|<any>|@ts-ignore|@ts-nocheck|@ts-expect-error' "${WRITTEN_TS[@]}" >"$WORK/banned.log" 2>&1; then
    VALIDATION+=("FAIL  banned TypeScript escapes found (required)"); REQUIRED_FAILED=1; cat "$WORK/banned.log"
  else
    VALIDATION+=("PASS  no any / @ts-ignore in Phase 3 files")
  fi
fi

if git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if git -C "$ROOT" ls-files --error-unmatch -- '*.env' '.env' '.env.*' >/dev/null 2>&1; then
    VALIDATION+=("WARN  an environment file is tracked by git (remove it from tracking yourself)")
  else
    VALIDATION+=("PASS  no tracked environment files")
  fi
fi

# ---- report -------------------------------------------------------------------
echo
echo "============== PHASE 3 VALIDATION =============="
printf '  %s\n' "${VALIDATION[@]}"
echo "================================================"

if [[ "$REQUIRED_FAILED" -ne 0 ]]; then
  echo "Validation finished with FAILED required checks. See the output above." >&2
  exit 2
fi
echo "Validation passed."