# Database

Postgres 16 in production (sqlite for local dev without docker). All models
live in `backend/app/models/core.py` as SQLAlchemy 2.0 declarative mappings;
migrations live in `backend/alembic/versions/`.

## Entities

Every business table carries `tenant_id` (except `tenants`/`users`, where
users belong to a tenant). Mixins: `TimestampMixin` (`created_at`,
`updated_at`, tz-aware) and `DemoMixin` (`is_demo` flag marking seeded demo
rows).

| Table | Purpose | Key relationships |
|---|---|---|
| `tenants` | Customer workspace | 1→N users, businesses, agents, campaigns, contacts, calls |
| `users` | Login accounts; roles `ADMIN`/`MEMBER`/`VIEWER` | N→1 tenant |
| `businesses` | Client businesses an agency serves | N→1 tenant; 1→N agents |
| `agents` | Voice agent configs (persona, language, tone, model refs) | N→1 tenant, N→1 business; 1→N agent_versions, campaigns, calls |
| `agent_versions` | Config snapshots on every agent update | N→1 agent (restore rolls back) |
| `questionnaires` | Call scripts / qualification forms | N→1 tenant; 1→N questionnaire_versions |
| `questionnaire_versions` | Published snapshots | N→1 questionnaire |
| `contacts` | People to call; `do_not_call` flag | N→1 tenant; join table `campaign_contacts` |
| `campaigns` | Outbound batches: agent + contacts + schedule | N→1 tenant/agent/questionnaire; N→M contacts |
| `campaign_contacts` | Campaign membership + per-contact status | N→1 campaign, contact |
| `calls` | One call; **string PK** (provider/UUID style) | N→1 tenant/agent, N→1 campaign/contact (SET NULL) |
| `call_events` | Lifecycle event log per call | N→1 call |
| `transcripts` | One per call | 1→1 call; 1→N transcript_segments |
| `transcript_segments` | Speaker-turn chunks (agent/user, timestamps) | N→1 transcript |
| `recordings` | 1→1 with call; `storage_key` → MinIO/`./data` | 1→1 call |
| `leads` | Post-call outcomes; status `NEW`→`INTERESTED`→`QUALIFIED`→`CLOSED` | N→1 tenant/agent/campaign/call/contact |
| `followups` | Scheduled callbacks; status `PENDING`/`SCHEDULED`/`COMPLETED`/`CANCELLED` | N→1 contact (+ optional agent/call) |
| `telephony_configs` | Per-tenant provider creds (`vobiz`/`twilio`/`plivo`); **token Fernet-encrypted** | unique (tenant_id, provider); one `is_default` |
| `model_configs` | Per-tenant AI config for `stt`/`llm`/`tts`; **API key Fernet-encrypted** | unique (tenant_id, type) |
| `usage_events` | Metering: `kind` = stt/llm/tts/call, `units`, `cost_estimate` | N→1 tenant (+ optional call) |

Delete behavior: tenant deletion cascades everywhere (`ondelete="CASCADE"`);
agents/campaigns referenced by calls use `RESTRICT`/`SET NULL` so history is
never orphaned.

## Migration workflow

Alembic reads `DATABASE_URL` from the app config — `backend/alembic/env.py`
overrides the `alembic.ini` URL, so the ini's sqlite line is inert.

```bash
cd backend
# new migration after changing models:
.venv/bin/alembic revision --autogenerate -m "describe change"
# review the generated file in alembic/versions/, then:
.venv/bin/alembic upgrade head
```

Rules:

- Never edit `alembic/versions/*` after it has run in a shared environment —
  write a new revision.
- Docker entrypoint (`docker/backend-entrypoint.sh`) runs
  `alembic upgrade head` on every container start, so deploys migrate
  themselves. Keep migrations backward-compatible with the previous app
  release.
- `AUTO_CREATE_TABLES=true` makes FastAPI `create_all` on startup. It is a
  **dev-only** shortcut (local sqlite without docker); in docker/prod,
  alembic owns the schema and this stays `false`.

## Seed data

`cd backend && python seed.py` is idempotent (get-or-create). It creates the
"Acme Demo Corp" tenant, `admin@voxora.demo` / `demo1234` (ADMIN),
`member@voxora.demo` / `demo1234` (MEMBER), plus demo agents, campaigns,
contacts, and calls flagged `is_demo=true`.
