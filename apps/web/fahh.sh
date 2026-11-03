#!/usr/bin/env bash
# Run from your project root.
# Generates a Bash script containing every file under src\components\LandingPage.
set -euo pipefail

export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"

V="src"
OUT="sssss.sh"

if [[ ! -d "$V" ]]; then
  echo "Error: Directory '$V' not found. Run this script from your project root." >&2
  exit 1
fi

# Avoid including the generated script in the collected source files.
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"

mapfile -d '' FILES < <(find "$V" -type f -print0 | sort -z)

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "Error: No files found under '$V'." >&2
  exit 1
fi

{
  cat <<'HEADER_EOF'
#!/usr/bin/env bash
# Run from your project root.
# Restores all files under src.
set -euo pipefail

export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"

V="src"
mkdir -p "$V"

HEADER_EOF

  i=0

  for FILE in "${FILES[@]}"; do
    # Relative path inside the visualizers directory.
    REL="${FILE#"$V"/}"
    

    # Skip the output script if it is inside the source directory.
    FILE_ABS="$(cd "$(dirname "$FILE")" && pwd)/$(basename "$FILE")"
    [[ "$FILE_ABS" == "$OUT_ABS" ]] && continue

    # Generate a unique heredoc delimiter that cannot collide with
    # a complete line in the source file.
    while :; do
      DELIM="__VISUALIZER_FILE_${i}_EOF__"
      if ! grep -Fxq "$DELIM" "$FILE"; then
        break
      fi
      ((i += 1))
    done

    # Preserve spaces and shell-special characters in file paths.
    printf 'FILE=%q\n' "$REL"
    printf 'mkdir -p "$(dirname "$V/$FILE")"\n'
    printf 'cat > "$V/$FILE" <<'\''%s'\''\n' "$DELIM"
    cat "$FILE"
    printf '\n%s\n\n' "$DELIM"

    ((i += 1))
  done

  cat <<'FOOTER_EOF'
echo "All visualizer files restored successfully."
FOOTER_EOF

} > "$OUT"

echo "Generated: $OUT"
echo "Files included: ${#FILES[@]}"
echo "Run it with: bash $OUT"