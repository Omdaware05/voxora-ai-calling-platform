# Development

## Local dev without docker

Prereqs: Python 3.12+, Node 24+.

```bash
cp .env.example .env        # optional; sqlite + mock providers are the defaults
./scripts/dev.sh            # creates backend/.venv, installs deps, runs migrations
```

Then in two terminals:

```bash
# terminal 1 — backend (http://localhost:8000)
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# terminal 2 — frontend (http://localhost:5173)
cd frontend && npm install && VITE_API_URL=http://localhost:8000 npm run dev
```

`scripts/dev.sh` sets `DATABASE_URL=sqlite:///./voxora.db` unless your `.env`
says otherwise, and runs `alembic upgrade head` unless
`AUTO_CREATE_TABLES=true` (a dev-only shortcut that has FastAPI create tables
on startup instead of using alembic).

Seed demo data, then smoke-test:

```bash
./scripts/seed.sh     # idempotent; docker backend preferred, local venv fallback
./scripts/smoke.sh    # BASE_URL defaults to http://localhost:8000
```

Demo login: `admin@voxora.demo` / `demo1234` (ADMIN),
`member@voxora.demo` / `demo1234` (MEMBER).

## Docker dev (hot-reload)

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- backend: `./backend` mounted at `/code`, `uvicorn --reload`
- frontend: Vite dev server on http://localhost:5173 with
  `VITE_API_URL=http://localhost:8000`

## Running tests

```bash
cd backend && .venv/bin/pytest          # API + business logic (mocked externals)
cd frontend && npm test                 # vitest, jsdom
./scripts/smoke.sh                      # end-to-end against a running stack
```

See `tests/README.md` for the full strategy (what each layer covers).

## Seed

`cd backend && python seed.py` — idempotent get-or-create. Creates the
"Acme Demo Corp" tenant, both demo users, demo agents/campaigns/contacts,
all flagged `is_demo=true`. Safe to run repeatedly. `scripts/seed.sh` picks
the docker backend when it's up, otherwise the local venv.

## Code conventions

- **Backend**: FastAPI routers in `app/api/routes/<domain>.py`, one file per
  domain, each with its own `APIRouter(prefix=...)`. Pydantic schemas in
  `app/schemas/`, SQLAlchemy models in `app/models/core.py`, external clients
  in `app/services/`. Tenant scoping via `app/deps.py` (`get_current_user`,
  `tenant_id`) — never trust a client-supplied `tenant_id`.
- **Frontend**: feature pages in `src/pages/`, shared UI in `src/components/`,
  API access through `src/api/` (axios client, base URL from
  `VITE_API_URL ?? '/api'`). Forms: react-hook-form + zod; server state:
  react-query.
- **Errors**: backend always returns JSON `{"detail": ...}`; frontend
  surfaces `detail` strings to the user.
- **Migrations**: `alembic revision --autogenerate -m "..."` after model
  changes; review the diff before committing. Never hand-edit a migration
  that's already run somewhere shared.
- **Secrets**: never commit `.env` or real credentials; `.env.example` holds
  placeholders only. Provider keys/tokens are encrypted at rest via
  `app/utils/secrets.py`.
