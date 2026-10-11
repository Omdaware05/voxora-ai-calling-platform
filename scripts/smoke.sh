#!/usr/bin/env bash
# Voxora smoke test. Fails loudly (non-zero exit) on any unexpected response.
#
# Usage:
#   scripts/smoke.sh                        # against localhost:8000
#   BASE_URL=http://backend:8000 scripts/smoke.sh
#
# Requires the backend to be running and seeded (scripts/seed.sh).
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8000}"
EMAIL="${SMOKE_EMAIL:-admin@voxora.demo}"
PASSWORD="${SMOKE_PASSWORD:-demo1234}"

fail() { echo "SMOKE FAIL: $*" >&2; exit 1; }
ok()   { echo "SMOKE OK: $*"; }

code_of() { # $1 = curl output file; prints HTTP status code
  tail -n1 "$1"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "==> base URL: $BASE_URL"

# 1. /health and /api/v1/health
for path in /health /api/v1/health; do
  curl -sS -o "$TMP/out" -w "%{http_code}\n" "$BASE_URL$path" > "$TMP/code" || fail "curl $path"
  code="$(cat "$TMP/code")"
  [ "$code" = "200" ] || fail "GET $path -> HTTP $code"
  grep -q '"status":"ok"\|"status": "ok"' "$TMP/out" || fail "GET $path body missing status=ok"
  ok "GET $path -> 200"
done

# 2. login as demo user
curl -sS -o "$TMP/out" -w "%{http_code}\n" \
  -X POST "$BASE_URL/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" > "$TMP/code" || fail "login curl"
code="$(cat "$TMP/code")"
[ "$code" = "200" ] || fail "POST /api/v1/auth/login -> HTTP $code"
TOKEN="$(python3 -c "import json,sys; print(json.load(open('$TMP/out'))['access_token'])" 2>/dev/null)" \
  || fail "login response has no access_token"
[ -n "$TOKEN" ] || fail "empty access_token"
ok "login as $EMAIL"

# 3. authenticated API calls
api_get() { # $1 = path
  curl -sS -o "$TMP/out" -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" "$BASE_URL$1" > "$TMP/code" || fail "curl $1"
  code="$(cat "$TMP/code")"
  [ "$code" = "200" ] || fail "GET $1 -> HTTP $code (body: $(head -c 300 "$TMP/out"))"
  ok "GET $1 -> 200"
}

api_get /api/v1/agents
api_get /api/v1/analytics/overview

echo "==> ALL SMOKE CHECKS PASSED"
