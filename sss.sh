#!/bin/bash

TARGET_DIR="${1:-.}"
OUTPUT_FILE="folder_structure.txt"

find "$TARGET_DIR" \
\( \
-path "$TARGET_DIR/.gradle" -o \
-path "$TARGET_DIR/.mvn" -o \
-path "$TARGET_DIR/.idea" -o \
-path "$TARGET_DIR/build" -o \
-path "$TARGET_DIR/target" -o \
-path "$TARGET_DIR/.git" -o \
-path "*/node_modules" -o \
-path "*/.next" -o \
-path "*/dist" \
\) -prune -o \
-print | sort | awk -F/ '

BEGIN {
    print "."
}

NR > 1 {
    depth = NF - 1

    for(i=2;i<NF;i++)
        printf "│   "

    printf "├── %s\n",$NF
}
' > "$OUTPUT_FILE"

echo "Saved to $OUTPUT_FILE"