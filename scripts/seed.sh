#!/usr/bin/env bash
# Seed the Voxora database with idempotent demo data.
# Prefers the running docker compose backend; falls back to a local backend
# venv (with DATABASE_URL from .env or the default sqlite fallback).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

if command -v docker >/dev/null 2>&1 && docker compose ps backend --status running >/dev/null 2>&1; then
  echo "==> Seeding via docker compose backend"
  docker compose exec backend python seed.py
  exit 0
fi

echo "==> docker backend not running; seeding with local venv"
load_env() {
  local f="$1"
  [ -f "$f" ] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

PY=""
for cand in backend/.venv/bin/python .venv/bin/python python3 python; do
  if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
done
[ -n "$PY" ] || { echo "ERROR: no python found" >&2; exit 1; }

load_env "$ROOT/.env"
(cd backend && "$PY" seed.py)
echo "Seed complete."
