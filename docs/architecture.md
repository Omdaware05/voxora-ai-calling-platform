# Architecture

Voxora is a monorepo with a React/Vite SPA frontend, a FastAPI backend, and
managed infrastructure via Docker Compose.

```
┌──────────────────────────┐
│  Frontend (React/Vite)   │  SPA, axios + react-query, served by nginx
└────────────┬─────────────┘
             │  REST /api/*   +   WebSocket /api/v1/ws/*
┌────────────▼─────────────┐
│  Backend (FastAPI)       │  JWT auth, RBAC, tenant scoping, rate limits
│  app.main:app  (:8000)   │
└──┬──────────┬──────────┬─┘
   │          │          │
   ▼          ▼          ▼
┌──────┐  ┌──────┐  ┌─────────┐
│Post- │  │Redis │  │ MinIO   │  recordings, imports/exports
│gres  │  │      │  │ (S3)    │  (local dir fallback: ./data)
└──────┘  └──┬───┘  └─────────┘
             │
   ┌─────────┴─────────────────────┐
   │  Voice pipeline (orchestrated) │
   │  Dograh (Pipecat-style)        │
   │  STT: Whisper · LLM: OpenAI-   │
   │  compatible · TTS: Kokoro      │
   └─────────────┬─────────────────┘
                 │  SIP / outbound dialing
                 ▼
           ┌───────────┐
           │  VoBiz    │  (Twilio/Plivo-ready provider abstraction)
           └───────────┘
```

## Components

| Component | Responsibility |
|---|---|
| **Frontend** (`frontend/`) | Vite + React 19 SPA. All state via axios client (`src/api/client.ts`, base `VITE_API_URL ?? /api`) + react-query. Charts via recharts; forms via react-hook-form + zod. Built to static `dist/`, served by nginx in production. |
| **API backend** (`backend/`) | FastAPI app (`app.main:create_app`). Routers under `app/api/routes/` with a global `/api/v1` prefix. Alembic migrations; pydantic-settings config (`app/config.py`) — every setting has a dev default, so nothing is required to import the app. |
| **Postgres** | System of record. All tables tenant-scoped; every write path derives `tenant_id` from the JWT (`app/deps.tenant_id`), never from the request. |
| **Redis** | Pub/sub fan-out for realtime events (call lifecycle, transcript segments) and future rate-limit/caching use. The backend falls back to in-memory when Redis is unreachable. |
| **MinIO** | S3-compatible object store for call recordings and bulk import/export files. `STORAGE_BACKEND=local` falls back to `./data`. |
| **Dograh** | Voice-agent orchestration client (`app/services/dograh.py`) — workflows, runs, sync, health. **Mock mode when `DOGRAH_BASE_URL` is unset**: every method returns plausible results marked `"mode": "mock"`, so the platform runs fully offline for demo/dev. |
| **AI models** | Pluggable STT (Whisper via speaches-compatible endpoint), LLM (OpenAI-compatible), TTS (Kokoro via speaches-compatible endpoint). Per-tenant config stored encrypted in `model_configs` (see `docs/ai-models.md`). |
| **VoBiz** | Telephony provider (`app/services/vobiz.py`): outbound dialing, test-connection. Credentials per tenant, Fernet-encrypted at rest, write-only over the API (see `docs/telephony.md`). |

## Request flows

### Outbound call (campaign)

1. Operator starts a campaign → `POST /api/v1/campaigns/{id}/start`.
2. Backend enqueues campaign contacts as calls (`POST /api/v1/calls`,
   `POST /api/v1/contacts/{id}/call`) with status `queued`.
3. Call service dials through the tenant's default telephony provider (VoBiz)
   and binds the Dograh voice run (workflow + agent + model config).
4. Call events (`created/updated/ended`) publish to Redis; connected WS
   clients and the analytics layer consume them.
5. Transcript segments stream from the STT pipeline into `transcripts` /
   `transcript_segments`; recording lands in MinIO or `./data`.

### Live transcript WebSocket

1. Client opens `GET /api/v1/ws/calls/{call_id}?token=<JWT>`.
2. Backend validates the JWT (query-param auth — browsers can't set WS
   headers) and checks the call belongs to the user's tenant.
3. Server subscribes to the Redis channel for that call and forwards only
   `transcript.segment` events (30s heartbeat `ping` keeps it alive).
4. A second socket, `/api/v1/ws/calls`, streams `call.created` /
   `call.updated` / `call.ended` across the tenant (operations dashboard).

## Cross-cutting concerns

- **AuthN/Z**: JWT Bearer <redacted> (`app/security.py`, PyJWT), RBAC roles
  `ADMIN` / `MEMBER` / `VIEWER` (`app/deps.py`: `require_admin`,
  `require_member_or_admin` — VIEWER is read-only).
- **Error shape**: all errors are JSON `{"detail": ...}`; validation errors
  are 422 with the pydantic error list.
- **Rate limiting**: `RateLimitMiddleware` (`RATE_LIMIT_PER_MINUTE=120`,
  login `RATE_LIMIT_LOGIN_PER_MINUTE=15`), security headers via
  `SecurityHeadersMiddleware`.
- **Secrets**: `app/utils/secrets.py` Fernet-encrypts provider API keys and
  telephony tokens; encrypted with `SECRET_KEY`.
