#!/usr/bin/env bash
set -Eeuo pipefail

# Collect the AI-related source files listed in the AlgoForge project inventory.
# Run this script from the repository root, or place it in the repository root
# and execute it from anywhere.

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
OUTPUT_FILE="${1:-$ROOT_DIR/ai-code-collection.txt}"

# Resolve relative output paths against the repository root.
if [[ "$OUTPUT_FILE" != /* ]]; then
  OUTPUT_FILE="$ROOT_DIR/$OUTPUT_FILE"
fi

mkdir -p -- "$(dirname -- "$OUTPUT_FILE")"
TMP_FILE="$(mktemp "${OUTPUT_FILE}.tmp.XXXXXX")"
trap 'rm -f -- "$TMP_FILE"' EXIT

FILES=(
  # AI core and providers
  "apps/api/src/ai/context-builder.ts"
  "apps/api/src/prompts/analysis.prompt.ts"
  "apps/api/src/prompts/assistant.prompt.ts"
  "apps/api/src/services/ai.service.ts"
  "apps/api/src/services/ai-usage.service.ts"
  "apps/api/src/services/providers/ai-provider.ts"
  "apps/api/src/services/providers/gemini.provider.ts"
  "apps/api/src/services/providers/gemini-messages.ts"
  "apps/api/src/services/providers/openrouter.provider.ts"
  "apps/api/src/services/providers/provider-factory.ts"
  "apps/api/src/services/lib/ai-output.ts"
  "apps/api/src/utils/ai-cache-keys.ts"
  "apps/api/src/services/quota.service.ts"

  # AI analysis and chat backend
  "apps/api/src/services/analysis.service.ts"
  "apps/api/src/services/explanation-session.service.ts"
  "apps/api/src/services/script.service.ts"
  "apps/api/src/repositories/ai-usage.repository.ts"
  "apps/api/src/controllers/analysis.controller.ts"
  "apps/api/src/controllers/explanation-session.controller.ts"
  "apps/api/src/routes/analysis.ts"
  "apps/api/src/routes/explanation-session.ts"
  "apps/api/src/serializers/analysis.ts"
  "apps/api/src/serializers/explain.ts"
  "apps/api/src/validation/analysis.ts"
  "apps/api/src/validation/explanation-session.ts"

  # Frontend AI
  "apps/web/src/components/DashBoard/AiChatDrawer.tsx"
  "apps/web/src/components/DashBoard/Analysis.tsx"
  "apps/web/src/components/DashBoard/AnalysisFeature.tsx"
  "apps/web/src/components/DashBoard/analysis-history.tsx"
  "apps/web/src/components/DashBoard/AnalysisHistoryFeature.tsx"
  "apps/web/src/components/DashBoard/Markdown.tsx"
  "apps/web/src/lib/assistant/algorithmContext.ts"
  "apps/web/src/lib/assistant/context.ts"
  "apps/web/src/lib/assistant/context-core.ts"
  "apps/web/src/lib/assistant/suggestions.ts"
  "apps/web/src/lib/analysisStatus.ts"
  "apps/web/src/lib/workspace/analysis-run.ts"
  "apps/web/src/lib/workspace/failure.ts"
  "apps/web/src/data/samples/analysisHistory.ts"

  # Shared packages and contracts
  "packages/analysis/package.json"
  "packages/analysis/src/index.ts"
  "packages/analysis/src/schema.ts"
  "packages/contracts/src/analysis.ts"
  "packages/contracts/src/explain.ts"
  "packages/contracts/src/limits.ts"
)

FOUND=0
MISSING=0

{
  printf '%s\n' "============================================================"
  printf '%s\n' "ALGOFORGE AI CODE COLLECTION"
  printf 'Generated: %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"
  printf 'Project root: %s\n' "$ROOT_DIR"
  printf '%s\n' "============================================================"
  printf '\nIncluded files: %s\n' "${#FILES[@]}"
  printf '%s\n\n' "============================================================"

  for relative_path in "${FILES[@]}"; do
    absolute_path="$ROOT_DIR/$relative_path"

    if [[ -f "$absolute_path" ]]; then
      FOUND=$((FOUND + 1))
      printf '\n\n%s\n' "################################################################"
      printf 'FILE: %s\n' "$relative_path"
      printf '%s\n\n' "################################################################"
      cat -- "$absolute_path"
      printf '\n'
    else
      MISSING=$((MISSING + 1))
      printf '\n[ MISSING FILE: %s ]\n' "$relative_path"
    fi
  done

  printf '\n\n%s\n' "============================================================"
  printf '%s\n' "COLLECTION SUMMARY"
  printf 'Found: %s\n' "$FOUND"
  printf 'Missing: %s\n' "$MISSING"
  printf '%s\n' "============================================================"
} > "$TMP_FILE"

mv -- "$TMP_FILE" "$OUTPUT_FILE"
trap - EXIT

printf 'AI code collection created: %s\n' "$OUTPUT_FILE"
printf 'Found: %s | Missing: %s | Total listed: %s\n' "$FOUND" "$MISSING" "${#FILES[@]}"
