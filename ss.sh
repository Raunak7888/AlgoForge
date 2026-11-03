#!/bin/bash

OUTPUT="project-code.txt"

find . -type f \
  \( -path './apps/api/src/*' \
     -o -path './apps/api/package.json' \
     -o -path './packages/*' \
     -o -path './package.json' \) \
  -not -path '*/node_modules/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -print0 |
sort -z |
while IFS= read -r -d '' file; do
    {
        echo ""
        echo "=================================================="
        echo "FILE: $file"
        echo "=================================================="
        cat "$file"
        echo ""
    } 
done > "$OUTPUT"

echo "Source code exported to $OUTPUT"