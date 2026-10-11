# Deployment

## Production quickstart (Docker Compose)

Prereqs: Docker Engine 24+ with the Compose plugin.

```bash
git clone <repo-url>
cd voxora-ai-calling-platform
cp .env.example .env
# edit .env: at minimum set SECRET_KEY and the Postgres/MinIO passwords
docker compose up --build -d
./scripts/seed.sh        # demo tenant + admin@voxora.demo / demo1234
./scripts/smoke.sh       # health → login → /api/v1/agents → /api/v1/analytics/overview
```

`docker compose up --build` works from a clean clone with only `.env`
copied: compose variables fall back to sane defaults, the backend entrypoint
runs `alembic upgrade head` before starting uvicorn, and named volumes
(`pgdata`, `redisdata`, `miniodata`) persist state.

| URL | Service |
|---|---|
| http://localhost:3000 | Frontend (nginx) |
| http://localhost:8000 | Backend API |
| http://localhost:8000/docs | Swagger UI |
| http://localhost:9001 | MinIO console |
| localhost:5432 (internal) | Postgres — not published; reach via the `postgres` service |

## Environment config

Copy `.env.example` → `.env`. Production checklist:

- `SECRET_KEY` — `openssl rand -hex 32`. This key encrypts provider API keys
  and telephony tokens at rest; rotating it invalidates stored secrets.
- `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD` — strong, unique.
- `DATABASE_URL` — the compose file already overrides it to point at the
  `postgres` service; change only for external/managed Postgres.
- `CORS_ORIGINS` — restrict to your real frontend origin(s).
- `DEMO_MODE` — leave `false` in prod. (Demo data comes from `seed.py`, not
  this flag.)
- `STORAGE_BACKEND=minio` + MinIO creds for durable recordings; `local`
  writes to the `./backend/data` volume mount instead.
- `VOBIZ_*` / `DOGRAH_*` / `WHISPER_*` / `LLM_*` / `KOKORO_*` — provider
  endpoints and keys; can also be set per-tenant in the UI (encrypted),
  which overrides env.

## Scaling notes

- **Backend**: stateless (JWT, no server sessions). Scale horizontally with
  `docker compose up --scale backend=3`; put a load balancer in front.
  Realtime fan-out goes through Redis pub/sub, so all replicas see call
  events.
- **Postgres**: single instance via the compose volume is fine for pilot.
  For growth, move to managed Postgres and point `DATABASE_URL` at it;
  run `alembic upgrade head` once per deploy (the entrypoint already does).
- **MinIO**: switch to S3 by pointing the storage service at real S3
  credentials/bucket (same boto3 interface).
- **Workers**: voice-pipeline load is driven by the Dograh service and AI
  endpoints, which scale independently of this compose file.

## Backup notes

- **Postgres**: `docker compose exec postgres pg_dump -U voxora voxora >
  backup.sql` (nightly cron recommended); restore with `psql`. Or back up
  the `pgdata` volume at the filesystem level.
- **MinIO**: replicate or version the `miniodata` volume / bucket —
  recordings are irreplaceable.
- **Secrets**: `.env` holds `SECRET_KEY`; back it up in a vault, never in
  git. Without it, encrypted provider credentials in the DB are unrecoverable.
- **Migrations** are code (`backend/alembic/versions/`) and travel with the
  repo; rollbacks via `alembic downgrade -1` (only for migrations that are
  safely reversible).

## Updates

```bash
git pull
docker compose up --build -d   # entrypoint re-runs alembic upgrade head
docker compose ps              # confirm backend is healthy
```
