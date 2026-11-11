#!/usr/bin/env bash
set -uo pipefail

cd "$(dirname "$0")"

PIDS=()
CLEANED=0
HAS_SETSID=0
command -v setsid >/dev/null 2>&1 && HAS_SETSID=1

kill_tree() {
  local pid=$1 sig=${2:-TERM}
  if [ "$HAS_SETSID" -eq 1 ]; then
    kill -"$sig" -- "-$pid" 2>/dev/null
  elif command -v taskkill >/dev/null 2>&1; then
    local winpid
    winpid=$(cat "/proc/$pid/winpid" 2>/dev/null || echo "$pid")
    taskkill //PID "$winpid" //T //F >/dev/null 2>&1
  else
    kill -"$sig" "$pid" 2>/dev/null
  fi
}

start() {
  local name=$1; shift
  if [ "$HAS_SETSID" -eq 1 ]; then
    setsid "$@" > >(sed -u "s/^/[$name] /") 2>&1 &
  else
    "$@" > >(sed -u "s/^/[$name] /") 2>&1 &
  fi
  PIDS+=($!)
}

cleanup() {
  [ "$CLEANED" -eq 1 ] && return
  CLEANED=1
  trap - INT TERM EXIT
  echo
  echo "==> Stopping backend and frontend..."
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill_tree "$pid" TERM
  done
  sleep 1
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill_tree "$pid" KILL
  done
  echo "==> Stopping Docker services..."
  docker compose down
  echo "==> Clean. Bye."
  exit 0
}
trap cleanup INT TERM EXIT

echo "==> Starting Postgres 17 and Redis 7..."
docker compose up -d --wait || { echo "Docker failed to start."; exit 1; }

echo "==> Running Prisma migrations..."
pnpm --filter ./packages/db exec prisma migrate deploy || echo "Migrate failed. Continuing."

echo "==> Starting backend (port 4000)..."
start api pnpm --filter ./apps/api dev

echo "==> Starting frontend (port 3000)..."
start web pnpm --filter ./apps/web dev

echo "==> Running. Press Ctrl+C to stop everything."
wait