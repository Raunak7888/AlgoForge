#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================
# AlgoForge FAST Source Code Dumper
# Output: sssss.sh
# Includes: package.json, *.ts, *.tsx, *.prisma
# ==========================================

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

OUT="./sssss.sh"

# ==========================================
# Preflight
# ==========================================

if [[ ! -d "apps" || ! -d "packages" ]]; then
    echo "Error: Run this script from the AlgoForge repository root."
    exit 1
fi

# Generate one high-entropy delimiter for the entire dump.
NONCE=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
DELIMITER="__ALGOFORGE_${NONCE}__"

# ==========================================
# Collect files
# ==========================================

echo "Collecting source files..."

mapfile -d '' -t FILES < <(
    find . \
        -type d \( \
            -name node_modules -o \
            -name .next -o \
            -name dist -o \
            -name build -o \
            -name .git -o \
            -name coverage \
        \) -prune -o \
        -type f \( \
            -name 'package.json' -o \
            -name '*.ts' -o \
            -name '*.tsx' -o \
            -name '*.prisma' \
        \) -print0 |
    sort -z
)

# ==========================================
# Generate restoration script
# ==========================================

echo "Generating restoration script..."

: > "$OUT"

cat >> "$OUT" <<'HEADER'
#!/usr/bin/env bash
set -Eeuo pipefail

echo "Restoring AlgoForge files..."

HEADER

TOTAL=0
PACKAGE_COUNT=0
TS_COUNT=0
TSX_COUNT=0
PRISMA_COUNT=0

for FILE in "${FILES[@]}"; do

    # Exclude generated output.
    [[ "$FILE" == "$OUT" ]] && continue

    # Count file types.
    case "$FILE" in
        */package.json|./package.json)
            ((PACKAGE_COUNT+=1))
            ;;
        *.tsx)
            ((TSX_COUNT+=1))
            ;;
        *.ts)
            ((TS_COUNT+=1))
            ;;
        *.prisma)
            ((PRISMA_COUNT+=1))
            ;;
    esac

    ((TOTAL+=1))

    # Generate restoration commands.
    {
        printf 'mkdir -p %q\n' "$(dirname "$FILE")"

        printf 'cat > %q <<'\''%s'\''\n' "$FILE" "$DELIMITER"

        cat -- "$FILE"

        printf '\n%s\n\n' "$DELIMITER"

    } >> "$OUT"

done

# ==========================================
# Restoration footer
# ==========================================

cat >> "$OUT" <<'FOOTER'
echo "All AlgoForge files restored successfully."
FOOTER

chmod +x "$OUT"

# ==========================================
# Display results
# ==========================================

echo ""
echo "================================================"
echo "          ALGOFORGE SOURCE CODE DUMP"
echo "================================================"

echo ""
echo "[package.json]"
echo "  Total: $PACKAGE_COUNT"

echo ""
echo "[*.ts]"
echo "  Total: $TS_COUNT"

echo ""
echo "[*.tsx]"
echo "  Total: $TSX_COUNT"

echo ""
echo "[*.prisma]"
echo "  Total: $PRISMA_COUNT"

echo ""
echo "================================================"
echo "Total files included : $TOTAL"
echo "Generated file       : $OUT"
echo "================================================"

echo ""
echo "Run the generated script with:"
echo "  bash $OUT"
