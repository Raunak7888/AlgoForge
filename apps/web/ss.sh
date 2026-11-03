  #!/bin/bash
  
  # --- Strict Mode ---
  set -euo pipefail
  IFS=$'\n\t'
  
  # Configuration
  OUTPUT_FILE="sourcecode.txt"
  
  # Target Directory (defaults to current directory if not provided)
  TARGET_DIR="${1:-.}"
  
  # Validate Directory
  if [[ ! -d "$TARGET_DIR" ]]; then
      echo "Error: '$TARGET_DIR' is not a valid directory." >&2
      exit 1
  fi
  
  # Clear or initialize the output file
  : > "$OUTPUT_FILE"
  
  echo "Collecting all frontend and backend source code into $OUTPUT_FILE..."
  
  # Find and process files
  # Pruning common backend (Java/Spring/Maven/Gradle) and frontend (Node/Next/Build) directories
  find "$TARGET_DIR" \
      -path "$TARGET_DIR/.gradle" -prune -o \
      -path "$TARGET_DIR/.mvn" -prune -o \
      -path "$TARGET_DIR/.idea" -prune -o \
      -path "$TARGET_DIR/build" -prune -o \
      -path "$TARGET_DIR/target" -prune -o \
      -path "$TARGET_DIR/.git" -prune -o \
      -path "$TARGET_DIR/src/components/auth" -prune -o \
      -path "$TARGET_DIR/src/components/LandingPage" -prune -o \
      -path "$TARGET_DIR/src/components/DashBoard" -prune -o \
      -path "$TARGET_DIR/src/components/ui" -prune -o \
      -path "*/node_modules/*" -prune -o \
      -path "*/.next/*" -prune -o \
      -path "*/dist/*" -prune -o \
      \( \
          -name "*.tsx" -o \
          -name "*.ts" -o \
          -name "*.jsx" -o \
          -name "*.js" -o \
          -name "*.css" \
      \) -type f -print | while read -r file; do
          
          # Clean path formatting
          CLEAN_PATH="${file#./}"
          
          {
              echo "================================================================================"
              echo " FILE: $CLEAN_PATH"
              echo "================================================================================"
              cat "$file"
              echo -e "\n\n"
          } >> "$OUTPUT_FILE"
  done
  
  echo "Finished extraction. Combined contents saved to: $OUTPUT_FILE"