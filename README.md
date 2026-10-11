# Voxora — Enterprise AI Voice Calling Platform

Voxora is an end-to-end platform for AI-powered voice calling: design voice
agents, run outbound campaigns, watch live transcripts stream in, and track
outcomes — all multi-tenant, with pluggable STT/LLM/TTS and telephony
providers.

## Features

- **Voice agents** — create, version, duplicate, and roll back agent configs
  (persona, language, tone, model bindings) with a full editor workspace.
- **Campaigns** — outbound batches with start/pause/resume/stop lifecycle,
  contact assignment, and per-campaign stats.
- **Live calls** — realtime call feed and per-call transcript streaming over
  WebSocket; hangup, events, and recording playback.
- **CRM-lite** — contacts (CSV/XLSX import/export, bulk delete), leads with a
  qualification funnel, follow-ups with complete/cancel/reschedule, and
  **do-not-call** handling.
- **AI model studio** — per-tenant STT (Whisper), LLM (OpenAI-compatible), and
  TTS (Kokoro) config with encrypted keys and test-connection checks; full
  mock mode when no providers are configured.
- **Telephony** — VoBiz integration with encrypted credentials and
  test-connection; provider abstraction ready for Twilio/Plivo.
- **Dograh orchestration** — voice-pipeline workflows and runs, mock-backed
  when `DOGRAH_BASE_URL` is unset.
- **Analytics & usage** — KPI overview, calls-over-time, outcomes, durations,
  per-agent/per-campaign breakdowns, lead funnel, and cost metering.
- **Enterprise basics** — JWT auth, RBAC (ADMIN/MEMBER/VIEWER), tenant
  isolation on every query, rate limiting, security headers, encrypted
  secrets at rest.

## Architecture

```
┌──────────────┐   /api/* + WS   ┌──────────────┐
│ React / Vite │ ───────────────▶ │   FastAPI    │
│    (nginx)   │                  │   (:8000)    │
└──────────────┘                  └──┬───┬───┬──┘
                                    │   │   │
                              ┌─────▼┐ ┌▼──▼─┐ ┌──────┐
                              │Post- │ │Redis│ │MinIO │
                              │gres  │ │     │ │ (S3) │
                              └──────┘ └──┬──┘ └──────┘
                                          │
                              ┌───────────▼────────────┐
                              │ Dograh (voice pipeline) │
                              │ STT Whisper · LLM ·    │
                              │ TTS Kokoro             │
                              └───────────┬────────────┘
                                          │ SIP / dialing
                                    ┌─────▼─────┐
                                    │   VoBiz   │
                                    └───────────┘
```

See `docs/architecture.md` for component responsibilities and request flows.

## Quickstart (Docker)

```bash
git clone <repo-url>
cd voxora-ai-calling-platform
cp .env.example .env
docker compose up --build
```

Then seed and verify:

```bash
./scripts/seed.sh
./scripts/smoke.sh
```

| URL | What |
|---|---|
| http://localhost:3000 | Frontend |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:9001 | MinIO console |

Demo login: **admin@voxora.demo** / **demo1234**
(also `member@voxora.demo` / `demo1234`).

## Local dev (no Docker)

```bash
cp .env.example .env
./scripts/dev.sh   # venv + sqlite + migrations, then prints both start commands
```

- Backend: `cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000`
- Frontend: `cd frontend && npm install && VITE_API_URL=http://localhost:8000 npm run dev`
- Docker hot-reload alternative:
  `docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build`

Details: `docs/development.md`.

## Testing

```bash
cd backend && .venv/bin/pytest   # API + business logic (externals mocked)
cd frontend && npm test          # vitest + jsdom component tests
./scripts/seed.sh && ./scripts/smoke.sh   # end-to-end smoke of the stack
```

Strategy (what each layer covers): `tests/README.md`.

## Project structure

```
.
├── backend/            # FastAPI app (uvicorn app.main:app, :8000)
│   ├── app/            # config, routes, models, schemas, services
│   ├── alembic/        # migrations (alembic upgrade head on container start)
│   ├── seed.py         # idempotent demo data
│   ├── requirements.txt
│   └── Dockerfile      # python:3.12-slim
├── frontend/           # Vite + React 19 SPA (npm run build → dist/)
│   ├── src/
│   └── Dockerfile      # multi-stage: node:24-alpine → nginx:alpine
├── docker/
│   ├── nginx.conf              # serve dist, proxy /api/ + WS /api/v1/ws/
│   └── backend-entrypoint.sh   # alembic upgrade head, then uvicorn
├── docs/               # architecture, api, database, deployment,
│                       # ai-models, telephony, development
├── scripts/            # seed.sh, dev.sh, smoke.sh
├── tests/              # integration test strategy (README)
├── docker-compose.yml      # prod: postgres, redis, minio, backend, frontend
├── docker-compose.dev.yml  # overrides: hot-reload
├── .env.example        # every env var, placeholders only
└── LICENSE
```

## Environment variables

All configuration is via environment — see `.env.example` for the full list
with placeholder values (never commit a real `.env`). Key ones:

| Var | Purpose |
|---|---|
| `SECRET_KEY` | JWT signing + secrets encryption (generate with `openssl rand -hex 32`) |
| `DATABASE_URL` | Postgres via `postgresql+psycopg2://…` (sqlite fallback for local dev) |
| `REDIS_URL` | Redis (in-memory fallback if unreachable) |
| `STORAGE_BACKEND` | `local` or `minio`; `MINIO_*` for S3-compatible storage |
| `DOGRAH_BASE_URL` | voice orchestration; empty = mock mode |
| `VOBIZ_*` | telephony credentials (or set per-tenant in the UI) |
| `WHISPER_*` / `LLM_*` / `KOKORO_*` | STT/LLM/TTS endpoints (or per-tenant in the UI) |
| `VITE_API_URL` | frontend API base; default `/api` (same-origin) |

Backend reads every var in `backend/app/config.py` — each has a dev default,
so the app imports with zero configuration.

## Docs

- [Architecture](docs/architecture.md) · [API reference](docs/api.md) ·
  [Database](docs/database.md) · [Deployment](docs/deployment.md) ·
  [AI models](docs/ai-models.md) · [Telephony](docs/telephony.md) ·
  [Development](docs/development.md)

## License

MIT — see [LICENSE](LICENSE). © Voxora Labs.
