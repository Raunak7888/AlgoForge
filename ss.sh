#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================
# AlgoForge Lint Source Code Dumper
# Git Bash / Windows compatible
#
# Output:
#   lint-files-dump.sh
#   ss-debug.log
# ==========================================

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

OUT="lint-files-dump.sh"
DEBUG_LOG="ss-debug.log"

# ==========================================
# DEBUG SYSTEM
# ==========================================

exec > >(tee -a "$DEBUG_LOG") 2>&1

PS4='+ [${BASH_SOURCE##*/}:${LINENO}] '

debug() {
    echo "[DEBUG $(date '+%H:%M:%S')] $*"
}

debug "=========================================="
debug "AlgoForge Lint Source Dumper started"
debug "=========================================="

debug "Current directory: $(pwd)"
debug "Bash version: $BASH_VERSION"
debug "Output file: $OUT"
debug "Debug log: $DEBUG_LOG"

# ==========================================
# REPOSITORY CHECK
# ==========================================

debug "Checking repository directories..."

if [[ ! -d "apps/web/src" || ! -d "packages" ]]; then
    echo "[ERROR] Run this script from the AlgoForge repository root."
    exit 1
fi

debug "Repository structure verified."

# ==========================================
# TARGET FILES
# Exact paths prevent duplicate filename issues.
# ==========================================

TARGETS=(
    "apps/web/src/components/CodeEditor/EditorToolbar.tsx"
    "apps/web/src/components/DashBoard/DashBoard.tsx"
    "apps/web/src/components/DashBoard/DashboardGate.tsx"
    "apps/web/src/components/DashBoard/DesktopOnlyScreen.tsx"
    "apps/web/src/components/DashBoard/Setting.tsx"
    "apps/web/src/components/DashBoard/ShareModal.tsx"
    "apps/web/src/components/DashBoard/TitleBar.tsx"
    "apps/web/src/components/DashBoard/analysis-history.tsx"
    "apps/web/src/components/LandingPage/WhatYouGet.tsx"
    "apps/web/src/components/LandingPage/shared.tsx"
    "apps/web/src/components/auth/GoogleLoginModal.tsx"
    "apps/web/src/components/ui/FeaturePanel.tsx"
    "apps/web/src/components/ui/card-hover-effect.tsx"
    "apps/web/src/components/ui/glowing-effect.tsx"
    "apps/web/src/components/ui/hover-border-gradient.tsx"
    "apps/web/src/components/ui/resizable-navbar.tsx"
    "apps/web/src/components/visualizers/canvas/CanvasViewport.tsx"
    "apps/web/src/components/visualizers/canvas/Group.tsx"
    "apps/web/src/components/visualizers/canvas/VisualizerCanvas.tsx"
    "apps/web/src/components/visualizers/graph/GraphStage.tsx"
    "apps/web/src/components/visualizers/graph/model.ts"
    "apps/web/src/components/visualizers/linear/engine.ts"
    "apps/web/src/components/visualizers/linkedlist/engine.ts"
    "apps/web/src/components/visualizers/shared/animationSettings.ts"
    "apps/web/src/components/visualizers/shared/stage/StageFrame.tsx"
    "apps/web/src/components/visualizers/tree/TreeStage.tsx"
    "apps/web/src/components/visualizers/tree/model.ts"
    "apps/web/src/components/visualizers/ui/ScriptDrawer.tsx"
    "apps/web/src/components/visualizers/ui/ScriptEditor.tsx"
)

# ==========================================
# FILE DISCOVERY
# ==========================================

debug "Starting file discovery..."

FILTERED=()
MISSING=()

for FILE in "${TARGETS[@]}"; do

    debug "Checking: $FILE"

    if [[ -f "$FILE" ]]; then
        FILTERED+=("$FILE")
        debug "FOUND: $FILE"
    else
        MISSING+=("$FILE")
        debug "MISSING: $FILE"
    fi

done

debug "File discovery completed."
debug "Found: ${#FILTERED[@]}"
debug "Missing: ${#MISSING[@]}"

# ==========================================
# GENERATE RESTORATION SCRIPT
# ==========================================

debug "Starting restoration script generation..."

: > "$OUT"

cat >> "$OUT" <<'HEADER'
#!/usr/bin/env bash
set -Eeuo pipefail

echo "Restoring AlgoForge lint files..."

HEADER

for FILE in "${FILTERED[@]}"; do

    debug "Processing: $FILE"

    DELIMITER="__ALGOFORGE_FILE_$(printf '%s' "$FILE" | sha256sum | cut -c1-16)__"

    while grep -Fqx "$DELIMITER" "$FILE"; do
        DELIMITER="${DELIMITER}_X"
    done

    {
        printf 'mkdir -p %q\n' "$(dirname "$FILE")"
        printf 'cat > %q <<'\''%s'\''\n' "$FILE" "$DELIMITER"
        cat "$FILE"
        printf '\n%s\n\n' "$DELIMITER"
    } >> "$OUT"

    debug "Added to output: $FILE"

done

cat >> "$OUT" <<'FOOTER'
echo "All AlgoForge lint files restored successfully."
FOOTER

chmod +x "$OUT"

debug "Restoration script generated successfully."

# ==========================================
# DISPLAY RESULTS
# ==========================================

echo ""
echo "================================================"
echo "          ALGOFORGE LINT SOURCE DUMP"
echo "================================================"

echo ""
echo "[INCLUDED FILES]"

for FILE in "${FILTERED[@]}"; do
    printf "  %s\n" "$FILE"
done

echo ""
echo "[MISSING FILES]"

if [[ ${#MISSING[@]} -eq 0 ]]; then
    echo "  None"
else
    for FILE in "${MISSING[@]}"; do
        printf "  %s\n" "$FILE"
    done
fi

echo ""
echo "================================================"
echo "Target files       : ${#TARGETS[@]}"
echo "Files included     : ${#FILTERED[@]}"
echo "Files missing      : ${#MISSING[@]}"
echo "Generated file     : $OUT"
echo "Debug log          : $DEBUG_LOG"
echo "================================================"

echo ""
echo "To restore the collected files:"
echo "  bash $OUT"

debug "Script completed successfully."