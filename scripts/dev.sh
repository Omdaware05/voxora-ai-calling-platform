#!/usr/bin/env bash
# Local Voxora dev without docker:
#   - backend:  venv + sqlite, uvicorn --reload on :8000
#   - frontend: npm run dev on :5173 (guidance printed below)
#
# Usage: scripts/dev.sh
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

load_env() {
  local f="$1"
  [ -f "$f" ] || return 0
  set -a
  # shellcheck disable=SC1090
  source "$f"
  set +a
}

echo "==> Loading .env (create it from .env.example first if missing)"
load_env "$ROOT/.env"

export DATABASE_URL="${DATABASE_URL:-sqlite:///./voxora.db}"
export AUTO_CREATE_TABLES="${AUTO_CREATE_TABLES:-false}"

echo "==> Backend env:"
echo "    DATABASE_URL=$DATABASE_URL"
echo "    AUTO_CREATE_TABLES=$AUTO_CREATE_TABLES"

echo "==> Ensuring backend venv deps (pip install -r requirements.txt)"
VENV="$ROOT/backend/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  python3 -m venv "$VENV"
fi
"$VENV/bin/pip" install -q -r "$ROOT/backend/requirements.txt"

if [ "$AUTO_CREATE_TABLES" != "true" ]; then
  echo "==> Running alembic migrations"
  (cd "$ROOT/backend" && "$VENV/bin/alembic" upgrade head)
else
  echo "==> AUTO_CREATE_TABLES=true: skipping alembic (FastAPI will create tables)"
fi

echo ""
echo "==> Start the backend in THIS terminal with:"
echo "    cd $ROOT/backend && $VENV/bin/uvicorn app.main:app --reload --port 8000"
echo ""
echo "==> Then start the frontend in ANOTHER terminal with:"
echo "    cd $ROOT/frontend && npm install && VITE_API_URL=http://localhost:8000 npm run dev"
echo ""
echo "(vite dev server runs on http://localhost:5173)"
