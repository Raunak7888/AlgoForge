#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

DUMP="env_dump.txt"
API="apps/api/.env"
mkdir -p apps/api

command -v node >/dev/null || { echo "node not found"; exit 1; }

# Back up first. Delete these later. They may hold old secrets.
[ -f "$DUMP" ] && cp "$DUMP" "$DUMP.bak"
[ -f "$API" ]  && cp "$API" "$API.bak"

# Read one key from one file. Strips quotes, comments, CR, stray backticks.
get() {
  local key="$1" file="$2"
  [ -f "$file" ] || return 0
  grep -E "^${key}=" "$file" | tail -n1 | cut -d= -f2- \
    | tr -d '\r' \
    | sed -E 's/[[:space:]]+#.*$//' \
    | sed -E 's/^"//; s/["`]+$//; s/[[:space:]]+$//' || true
}

# A value is good if it is filled, not a placeholder, and not an old key.
good() {
  local v="$1"
  [ -n "$v" ] || return 1
  case "$v" in
    *PASTE*) return 1 ;;
    b412876e*|8f23c31e*|1d201bf1*) return 1 ;;
    GOCSPX-D15v*|AIzaSyDJzpbO*|1095085122784-soh7*) return 1 ;;
  esac
  return 0
}

# Take the first good value. env_dump.txt wins over apps/api/.env.
pick() {
  local key="$1" f v
  for f in "$DUMP" "$API"; do
    v=$(get "$key" "$f")
    if good "$v"; then printf '%s' "$v"; return 0; fi
  done
  return 0
}

hex()  { node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"; }
uuid() { node -e "console.log(require('crypto').randomUUID())"; }

CLIENT_ID=$(pick GOOGLE_CLIENT_ID);         CLIENT_ID=${CLIENT_ID:-PASTE_GOOGLE_CLIENT_ID}
CLIENT_SECRET=$(pick GOOGLE_CLIENT_SECRET); CLIENT_SECRET=${CLIENT_SECRET:-PASTE_GOOGLE_CLIENT_SECRET}
GEMINI=$(pick GEMINI_API_KEY);              GEMINI=${GEMINI:-PASTE_GEMINI_API_KEY}

ACCESS=$(pick JWT_ACCESS_SECRET);           ACCESS=${ACCESS:-$(hex)}
REFRESH=$(pick JWT_REFRESH_SECRET);         REFRESH=${REFRESH:-$(hex)}
ADMIN=$(pick ADMIN_UPGRADE_SECRET);         ADMIN=${ADMIN:-$(uuid)}

cat > "$DUMP" <<ENV
# ===== ENVIRONMENT =====
NODE_ENV=development
PORT=4000
API_BASE_URL=http://localhost:4000
WEB_APP_URL=http://localhost:3000
COOKIE_DOMAIN=localhost

# ===== DATA =====
DATABASE_URL="postgresql://algoforge:algoforge@localhost:5433/algoforge"
REDIS_URL=redis://localhost:6379
REDIS_CACHE_TTL_SECONDS=3600

# ===== GOOGLE LOGIN =====
GOOGLE_CLIENT_ID="$CLIENT_ID"
GOOGLE_CLIENT_SECRET="$CLIENT_SECRET"
GOOGLE_REDIRECT_URI="http://localhost:4000/auth/google/callback"

# ===== AUTH =====
JWT_ACCESS_SECRET=$ACCESS
JWT_REFRESH_SECRET=$REFRESH
ADMIN_UPGRADE_SECRET=$ADMIN
ACCESS_TOKEN_TTL_MINUTES=15
REFRESH_TOKEN_TTL_DAYS=30
AUTH_ISSUER=algoforge-api
AUTH_AUDIENCE=algoforge-web

# ===== AI =====
AI_PROVIDER=gemini
AI_MODEL=gemini-2.5-flash-lite
GEMINI_API_KEY=$GEMINI
AI_TIMEOUT_MS=15000
AI_MAX_RETRIES=1

# ===== RATE LIMITS =====
AI_RATE_LIMIT_PER_HOUR=0
DEFAULT_RATE_LIMIT_PER_MINUTE=10
ENV

# Both files get the same content.
cp "$DUMP" "$API"
chmod 600 "$DUMP" "$API" 2>/dev/null || true

# Keep secrets out of git.
touch .gitignore
for p in ".env" ".env.*" "!.env.example" "env_dump.txt" "*.bak"; do
  grep -qxF "$p" .gitignore || echo "$p" >> .gitignore
done

# Checks
echo
echo "==> Checks"
for f in "$DUMP" "$API"; do
  dup=$(grep -E '^[A-Z_]+=' "$f" | cut -d= -f1 | sort | uniq -d || true)
  [ -z "$dup" ] && echo "ok    $f: no duplicate keys" || echo "FAIL  $f: duplicates: $dup"
  if grep -q PASTE_ "$f"; then
    echo "TODO  $f still has:"
    grep -o 'PASTE_[A-Z_]*' "$f" | sort -u | sed 's/^/        /'
  else
    echo "ok    $f: nothing left to paste"
  fi
done

echo
echo "Next:"
echo "  1. Fill any PASTE_ value in env_dump.txt."
echo "  2. Run: bash fix-env.sh   (it copies the values into apps/api/.env)"
echo "  3. Delete the backups: rm -f env_dump.txt.bak apps/api/.env.bak"
echo "  4. Delete this script: rm fix-env.sh"