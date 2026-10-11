# API Reference

Base URL (production compose): `http://localhost:3000` → nginx proxies
`/api/*` to the backend. All routes below live under the `/api/v1` prefix;
the unauthenticated health check also exists at `/health`.

Interactive docs: `http://localhost:8000/docs` (Swagger UI).

## Auth

- `POST /api/v1/auth/login` — body `{email, password}` → `{"access_token", "token_type": "bearer", "user": {...}}`. The JWT subject is the user id; the tenant is resolved server-side, never trusted from the client.
- `POST /api/v1/auth/logout` — stateless; logout is client-side token discard. Always returns `{"ok": true}`.
- `GET /api/v1/auth/me` — current user (`UserPublic`).
- All other endpoints require `Authorization: Bearer <JWT>`. 401 on missing/invalid/expired token or inactive user.
- Roles: `ADMIN` (full), `MEMBER` (writes to business data), `VIEWER` (read-only — 403 on writes). `require_admin` guards config writes (telephony, model config).

## Pagination envelope

List endpoints accept `?page=1&page_size=20` (page_size capped at 200) and
return:

```json
{"items": [...], "total": 123, "page": 1, "page_size": 20}
```

## Error format

All errors are JSON: `{"detail": "..."}`. Validation failures return 422
with the pydantic error list as `detail`.

## Endpoints

Auth: `A` = any authenticated user; `W` = MEMBER or ADMIN (write); `R` =
read-only ok for VIEWER.

### Health

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health`, `/api/v1/health` | none | `{"status":"ok","version":"0.1.0"}` |

### Auth & users

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/v1/auth/login` | none | `{email,password}` → JWT |
| POST | `/api/v1/auth/logout` | A | always `{"ok":true}` |
| GET | `/api/v1/auth/me` | A | |
| GET/POST | `/api/v1/users` | A / ADMIN | create user (ADMIN only) |
| GET/PUT/DELETE | `/api/v1/users/{user_id}` | A / ADMIN for writes | |

### Businesses & agents

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/v1/businesses` | A / W | paginated |
| GET/PUT/DELETE | `/api/v1/businesses/{business_id}` | A / W | |
| GET | `/api/v1/businesses/{business_id}/agents` | A | agents of a business |
| GET/POST | `/api/v1/agents` | A / W | paginated |
| GET/PUT/DELETE | `/api/v1/agents/{agent_id}` | A / W | |
| POST | `/api/v1/agents/{agent_id}/duplicate` | W | clone |
| POST | `/api/v1/agents/{agent_id}/toggle` | W | enable/disable |
| GET | `/api/v1/agents/{agent_id}/workspace` | A | full editor workspace payload |
| GET | `/api/v1/agents/{agent_id}/versions` | A | config snapshots |
| POST | `/api/v1/agents/{agent_id}/versions/{version_id}/restore` | W | rollback |

### Campaigns, contacts, leads, followups

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/v1/campaigns` | A / W | |
| GET/PUT/DELETE | `/api/v1/campaigns/{campaign_id}` | A / W | |
| POST | `/api/v1/campaigns/{campaign_id}/start\|pause\|resume\|stop` | W | lifecycle |
| POST | `/api/v1/campaigns/{campaign_id}/contacts` | W | attach contacts |
| GET | `/api/v1/campaigns/{campaign_id}/stats` | A | progress counters |
| GET/POST | `/api/v1/contacts` | A / W | |
| POST | `/api/v1/contacts/import` | W | xlsx/csv bulk import |
| GET | `/api/v1/contacts/export` | A | file download |
| POST | `/api/v1/contacts/bulk-delete` | W | |
| GET/PUT/DELETE | `/api/v1/contacts/{contact_id}` | A / W | |
| POST | `/api/v1/contacts/{contact_id}/call` | W | single outbound call |
| PATCH | `/api/v1/contacts/{contact_id}/do-not-call` | W | DNC flag |
| GET/POST | `/api/v1/leads` | A / W | |
| GET/PATCH/DELETE | `/api/v1/leads/{lead_id}` | A / W | |
| GET/POST | `/api/v1/followups` | A / W | |
| GET/PUT/DELETE | `/api/v1/followups/{followup_id}` | A / W | |
| POST | `/api/v1/followups/{followup_id}/complete\|cancel\|reschedule` | W | |

### Calls

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/v1/calls` | A / W | paginated |
| GET | `/api/v1/calls/live` | A | in-progress calls |
| GET | `/api/v1/calls/{call_id}` | A | |
| POST | `/api/v1/calls/{call_id}/hangup` | W | |
| GET | `/api/v1/calls/{call_id}/transcript` | A | full transcript |
| GET | `/api/v1/calls/{call_id}/events` | A | lifecycle events |
| GET | `/api/v1/calls/{call_id}/recording` | A | recording file/stream |
| POST | `/api/v1/calls/{call_id}/demo-event` | W | inject a demo transcript segment (mock pipelines) |

### Questionnaires

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET/POST | `/api/v1/questionnaires` | A / W | |
| POST | `/api/v1/questionnaires/import` | W | import from file |
| GET | `/api/v1/questionnaires/template` | A | blank template download |
| GET/PUT/DELETE | `/api/v1/questionnaires/{qid}` | A / W | |
| POST | `/api/v1/questionnaires/{qid}/duplicate\|publish\|archive` | W | |
| GET | `/api/v1/questionnaires/{qid}/versions` | A | |

### AI model config (tenant)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/model-config` | A | stt/llm/tts configs; API keys never returned, only `has_api_key` |
| PUT | `/api/v1/model-config/{stt\|llm\|tts}` | ADMIN | keys Fernet-encrypted at rest |
| POST | `/api/v1/model-config/{stt\|llm\|tts}/test` | A | test-connection (see ai-models.md) |
| POST | `/api/v1/model-config/reset` | ADMIN | back to defaults |

### Telephony (VoBiz)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/telephony` | A | providers overview; tokens never returned, only `has_credentials` |
| PUT | `/api/v1/telephony/vobiz` | ADMIN | save VoBiz creds (encrypted) |
| POST | `/api/v1/telephony/vobiz/test` | A | test-connection (see telephony.md) |
| POST | `/api/v1/telephony/set-default` | ADMIN | choose default provider |

### Dograh orchestration

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/integrations/dograh/health` | A | mock mode when `DOGRAH_BASE_URL` unset |
| POST | `/api/v1/integrations/dograh/sync` | W | |
| GET/POST | `/api/v1/integrations/dograh/workflows` | A / W | |
| POST | `/api/v1/integrations/dograh/workflows/{workflow_id}/publish` | W | |
| GET/POST | `/api/v1/integrations/dograh/runs` | A / W | |
| GET | `/api/v1/integrations/dograh/runs/{run_id}` | A | |
| POST | `/api/v1/integrations/dograh/runs/{run_id}/stop` | W | |

### Analytics & usage

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/v1/analytics/overview` | A | headline KPIs |
| GET | `/api/v1/analytics/calls-over-time` | A | |
| GET | `/api/v1/analytics/outcomes` | A | |
| GET | `/api/v1/analytics/durations` | A | |
| GET | `/api/v1/analytics/agents` | A | per-agent breakdown |
| GET | `/api/v1/analytics/campaigns` | A | per-campaign breakdown |
| GET | `/api/v1/analytics/lead-funnel` | A | |
| GET | `/api/v1/analytics/usage` | A | |
| GET | `/api/v1/usage` | A | `{"ai_usage_minutes", "est_cost", "calls", "period"}` summary |

## WebSocket protocol

Auth via `?token=<JWT>` query param (browsers can't set headers on WS
handshakes). Events are tenant-scoped; the server sends a `{"type":"ping"}`
heartbeat every ~30s.

| Socket | Event types | Notes |
|---|---|---|
| `/api/v1/ws/calls` | `call.created`, `call.updated`, `call.ended` | tenant-wide feed; `{"type":"error","detail":"Unauthorized"}` and close on bad token |
| `/api/v1/ws/calls/{call_id}` | `transcript.segment` | one call's live transcript; `{"type":"error","detail":"Call not found"}` if the call isn't in the tenant |

In nginx these paths proxy with `Upgrade`/`Connection` headers (see
`docker/nginx.conf`).
