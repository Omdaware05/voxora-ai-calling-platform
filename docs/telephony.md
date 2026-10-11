# Telephony

Outbound dialing is provider-backed. The backend ships a VoBiz integration
with a provider abstraction designed for Twilio/Plivo — the
`telephony_configs.provider` column already accepts `vobiz|twilio|plivo`.

## VoBiz setup

1. In the UI (Settings → Telephony) or via API, save credentials — ADMIN
   only:
   `PUT /api/v1/telephony/vobiz` with `{auth_id, auth_token, from_number}`.
2. The auth token is Fernet-encrypted before storage
   (`telephony_configs.auth_token_encrypted`); reads expose only
   `has_credentials: true/false` — tokens are write-only.
3. Set the default provider: `POST /api/v1/telephony/set-default`
   with `{provider: "vobiz"}`.
4. Verify: `POST /api/v1/telephony/vobiz/test`.
5. Place a call: `POST /api/v1/contacts/{contact_id}/call` or start a
   campaign (`POST /api/v1/campaigns/{id}/start`); the call service dials
   through the default provider and binds the Dograh voice run.

Env fallbacks (`VOBIZ_AUTH_ID`, `VOBIZ_AUTH_TOKEN`, `VOBIZ_FROM_NUMBER`,
`VOBIZ_API_URL`) seed the global defaults; per-tenant UI config overrides
them. The "from" number must be a VoBiz-provisioned caller ID.

## Test-connection semantics

`POST /api/v1/telephony/vobiz/test` (`app/services/vobiz.py`):

1. **No credentials stored** → HTTP 400 `{"detail": "VoBiz not configured"}`.
2. `VOBIZ_API_URL` set → attempts a real HTTP check against the provider
   and returns `{"ok": true/false, ...}` with latency/detail.
3. **Otherwise** → returns `{"ok": true, ...}` reporting that credentials
   are present, without hitting the network. Safe to run in dry-run
   environments; it never places a call.

## Provider abstraction

- `app/services/vobiz.py` is the provider client; adding Twilio/Plivo means
  a sibling service module plus a `provider` value — routes, schemas
  (`app/schemas/crm.py`), and the `telephony_configs` table already key on
  `provider` with a unique `(tenant_id, provider)` constraint.
- `GET /api/v1/telephony` returns the overview of all configured providers
  for the tenant (status, `has_credentials`, `is_default`).

## DNC handling

Contacts carry a `do_not_call` flag:

- `PATCH /api/v1/contacts/{contact_id}/do-not-call` — toggles DNC (MEMBER+
  can write).
- DNC contacts are excluded from campaign dialing and direct-call endpoints
  reject them — the platform never dials a flagged number.
- Honor DNC requests immediately; in many jurisdictions calling a DNC number
  is unlawful. The flag is per-tenant and auditable via `updated_at`.
