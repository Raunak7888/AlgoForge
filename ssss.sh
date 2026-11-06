#!/usr/bin/env bash
set -euo pipefail

SRC="algoforgefrontendprototyping"
DEST="algoforge/apps/web"

# Set to 1 if you also want .next copied (usually not needed, it's regenerated)
INCLUDE_NEXT=0

if [ ! -d "$SRC" ]; then echo "Source not found: $SRC"; exit 1; fi
if [ ! -d "algoforge/apps/api" ]; then echo "Run this from the folder containing both projects"; exit 1; fi
if [ -e "$DEST" ] && [ -n "$(ls -A "$DEST" 2>/dev/null)" ]; then
  echo "$DEST already exists and is not empty. Aborting so nothing gets overwritten."; exit 1
fi

mkdir -p "$DEST"

EXCLUDES=(--exclude 'node_modules' --exclude 'tsconfig.tsbuildinfo'
          --exclude 'pnpm-lock.yaml' --exclude 'pnpm-workspace.yaml')
[ "$INCLUDE_NEXT" -eq 0 ] && EXCLUDES+=(--exclude '.next')

if command -v rsync >/dev/null 2>&1; then
  rsync -a "${EXCLUDES[@]}" "$SRC"/ "$DEST"/
else
  # Fallback without rsync
  TAR_EX=(--exclude=node_modules --exclude=tsconfig.tsbuildinfo
          --exclude=pnpm-lock.yaml --exclude=pnpm-workspace.yaml)
  [ "$INCLUDE_NEXT" -eq 0 ] && TAR_EX+=(--exclude=.next)
  (cd "$SRC" && tar cf - "${TAR_EX[@]}" .) | (cd "$DEST" && tar xf -)
fi

echo "Done. Copied $SRC -> $DEST (original untouched)."
echo "Next: cd algoforge && pnpm install"