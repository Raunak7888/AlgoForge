
#!/usr/bin/env bash
set -Eeuo pipefail

# ==========================================
# AlgoForge Source Code Dumper
# Output: sssss.sh
# Includes: package.json, *.ts, *.tsx, *.prisma
# ==========================================

export MSYS_NO_PATHCONV=1
export MSYS2_ARG_CONV_EXCL="*"

OUT="sssss.sh"

# Ensure script runs from repository root.
if [[ ! -d "apps" || ! -d "packages" ]]; then
    echo "Error: Run fahh.sh from the AlgoForge repository root."
    exit 1
fi

# Resolve output path.
OUT="./${OUT#./}"

# Collect eligible files, excluding generated/dependency directories.
mapfile -d '' FILES < <(
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

# Exclude the generated output itself.
FILTERED=()

for FILE in "${FILES[@]}"; do
    [[ "$FILE" == "$OUT" ]] && continue
    FILTERED+=("$FILE")
done

# ==========================================
# Generate restoration script
# ==========================================

cat > "$OUT" <<'HEADER'
#!/usr/bin/env bash
set -Eeuo pipefail

echo "Restoring AlgoForge files..."

HEADER

for FILE in "${FILTERED[@]}"; do

    # Generate a unique heredoc delimiter for each file.
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

done

cat >> "$OUT" <<'FOOTER'
echo "All AlgoForge files restored successfully."
FOOTER

chmod +x "$OUT"

# ==========================================
# Display included files
# ==========================================

echo ""
echo "================================================"
echo "          ALGOFORGE SOURCE CODE DUMP"
echo "================================================"

for TYPE in package.json "*.ts" "*.tsx" "*.prisma"; do

    echo ""
    echo "[$TYPE]"

    COUNT=0

    for FILE in "${FILTERED[@]}"; do

        case "$TYPE" in
            package.json)
                [[ "$(basename "$FILE")" == "package.json" ]] || continue
                ;;
            "*.ts")
                [[ "$FILE" == *.ts && "$FILE" != *.tsx ]] || continue
                ;;
            "*.tsx")
                [[ "$FILE" == *.tsx ]] || continue
                ;;
            "*.prisma")
                [[ "$FILE" == *.prisma ]] || continue
                ;;
        esac

        printf "  %s\n" "$FILE"
        COUNT=$((COUNT + 1))

    done

    echo "  Total: $COUNT"

done

echo ""
echo "================================================"
echo "Total files included : ${#FILTERED[@]}"
echo "Generated file       : $OUT"
echo "================================================"
echo ""
echo "Run the generated script with:"
echo "  bash $OUT"
