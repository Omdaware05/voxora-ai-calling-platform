# Tests

Integration test strategy for the Voxora monorepo: three layers, each with a
clear owner and scope. Nothing here replaces the others — the layers overlap
deliberately so that a regression has to slip past all three.

## 1. Backend: pytest (`backend/tests/`)

- Framework: pytest + FastAPI TestClient.
- Scope: API contract and business logic — auth/JWT, RBAC roles, tenant
  scoping, CRUD for agents/campaigns/contacts/calls, pagination envelope,
  error shapes (422/401/403 JSON `{"detail": ...}`).
- External services (Dograh, VoBiz, Whisper/LLM/Kokoro, S3/MinIO) are mocked
  (`respx` for HTTP, fakes for storage) — pytest never places a real call or
  spends money.
- DB: sqlite in-memory/file for speed; migrations are tested separately by
  running `alembic upgrade head` against a throwaway Postgres in CI.
- Run: `cd backend && .venv/bin/pytest`

## 2. Frontend: vitest (`frontend/src/__tests__/`)

- Framework: vitest + @testing-library/react + jsdom.
- Scope: component behavior and data-flow — pages rendering lists from the
  API client, forms (zod/react-hook-form validation), auth redirects,
  dashboard charts with fixture data.
- The HTTP layer is mocked (MSW-style handlers / mocked axios) so frontend
  tests don't need a live backend.
- Run: `cd frontend && npm test`

## 3. Integration: smoke script (`scripts/smoke.sh`)

- Scope: the deployed stack end-to-end — real HTTP through nginx →
  backend → Postgres. It checks:
  1. `GET /health` and `GET /api/v1/health`
  2. `POST /api/v1/auth/login` as the seeded demo user
     (`admin@voxora.demo` / `demo1234`) — proves JWT issuance
  3. `GET /api/v1/agents` and `GET /api/v1/analytics/overview` with the
     token — proves auth middleware, tenant scoping, and DB wiring
- This is the script CI runs after `docker compose up --build` (+ seed) on
  every PR. It fails loudly (non-zero exit) on the first unexpected status.
- Run: `./scripts/seed.sh && ./scripts/smoke.sh`

## What each layer does NOT cover

| Layer        | Not covered                                       |
|--------------|---------------------------------------------------|
| pytest       | Real browser rendering, CSS, Vite build           |
| vitest       | Backend logic, real API responses, migrations     |
| smoke.sh     | Full business-logic matrix (by design — fast)     |

Longer scenarios (outbound campaign flow, WS transcript streaming, VoBiz
test-connection with sandboxed credentials) are exercised manually or in
staging; see `docs/telephony.md` for provider test semantics.
