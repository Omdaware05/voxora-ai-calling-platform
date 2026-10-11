# AI Models

The voice pipeline is STT → LLM → TTS. Each stage is pluggable per tenant and
configured either via env vars (global defaults) or in the UI per tenant
(encrypted, overrides env).

## Providers and env vars

| Stage | Env vars | Default provider/model |
|---|---|---|
| **STT** | `WHISPER_STT_URL`, `WHISPER_MODEL` | `speaches` (Whisper-compatible), `whisper-large-v3-turbo` |
| **LLM** | `LLM_BASE_URL`, `LLM_MODEL` | `openai-compatible`, model unset |
| **TTS** | `KOKORO_TTS_URL`, `KOKORO_MODEL`, `KOKORO_VOICE` | `speaches` (Kokoro-compatible), `kokoro` |

Endpoints are expected to be OpenAI/Speaches-compatible HTTP APIs. Any
compliant server (self-hosted Speaches, vLLM, LiteLLM, OpenAI, …) works by
pointing `*_BASE_URL` at it.

## /model-config endpoints

- `GET /api/v1/model-config` — current stt/llm/tts configs for the tenant.
  API keys are **never returned**; the response carries `has_api_key` only.
- `PUT /api/v1/model-config/{stt|llm|tts}` — ADMIN only. Body:
  `{provider, model, base_url, api_key, language, voice, speed, …}`.
  The key is Fernet-encrypted (`app/utils/secrets.py`, keyed by
  `SECRET_KEY`) before storage in `model_configs`.
- `POST /api/v1/model-config/{stt|llm|tts}/test` — test-connection.
- `POST /api/v1/model-config/reset` — ADMIN only; back to defaults.

## Test-connection semantics

`POST /api/v1/model-config/{type}/test` (`app/services/ai_models.py`):

1. Unknown type → `{"ok": false, "message": "Unknown model type", "mode": "error"}`.
2. **No `base_url` configured** → `{"ok": true, "mode": "mock",
   "message": "... not configured — mock mode"}`. This is a *successful*
   mock — the pipeline runs against stubbed models.
3. `base_url` set → GET `{base_url}/health`, then `{base_url}` (6s timeout).
   First response with HTTP < 500 → `{"ok": true, "mode": "live",
   "latency_ms": N}`. All attempts failing → `{"ok": false, "mode": "error",
   "message": <last error>}`.

The check never sends the API key beyond the configured base URL.

## Mock behavior

When no AI endpoints are configured, the backend serves the full product
surface — agents, campaigns, calls, transcripts — with stubbed model
responses:

- Dograh client returns `"mode": "mock"` payloads (see `docs/telephony.md`
  and `app/services/dograh.py`).
- `POST /api/v1/calls/{call_id}/demo-event` injects a transcript segment so
  the live-transcript WebSocket and analytics can be exercised without any
  provider.
- Mock responses are always labeled; no real inference cost is incurred.
- `COST_PER_MIN` (default `0.05`) drives `usage_events.cost_estimate` for
  billing previews.

## Tuning knobs

Per-tenant `model_configs` rows also store `temperature` (default 0.7),
`max_tokens` (default 512), `language`, `voice`, and `speed` — editable via
the same PUT endpoint. Env vars set global fallbacks; the tenant row wins.
