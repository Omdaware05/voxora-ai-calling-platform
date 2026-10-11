"""Tests: telephony config — save/test/secrets hygiene, model-config."""
from __future__ import annotations


def test_telephony_overview_empty(client, admin_headers):
    resp = client.get("/api/v1/telephony", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["configs"] == []
    assert body["default_provider"] is None


def test_telephony_test_not_configured(client, admin_headers):
    resp = client.post("/api/v1/telephony/vobiz/test", headers=admin_headers)
    assert resp.status_code == 400
    assert resp.json() == {"detail": "VoBiz not configured"}


def test_telephony_save_and_secrets_not_returned(client, admin_headers):
    resp = client.put("/api/v1/telephony/vobiz", headers=admin_headers,
                      json={"auth_id": "test-auth-id", "auth_token": "super-secret-token",
                            "from_number": "+911800111222"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["has_credentials"] is True
    assert body["from_number"] == "+911800111222"
    assert "auth_token" not in body
    assert "auth_token_encrypted" not in body
    assert "super-secret-token" not in resp.text

    # overview also hides secrets
    overview = client.get("/api/v1/telephony", headers=admin_headers).json()
    assert overview["configs"][0]["has_credentials"] is True
    assert "super-secret-token" not in str(overview)

    # test with credentials present but no VOBIZ_API_URL -> credentials-present mode
    tested = client.post("/api/v1/telephony/vobiz/test", headers=admin_headers)
    assert tested.status_code == 200
    assert tested.json()["ok"] is True
    assert tested.json()["mode"] == "credentials-present"


def test_telephony_member_cannot_write(client, member_headers):
    resp = client.put("/api/v1/telephony/vobiz", headers=member_headers,
                      json={"auth_id": "x"})
    assert resp.status_code == 403


def test_telephony_set_default(client, admin_headers):
    resp = client.post("/api/v1/telephony/set-default", headers=admin_headers,
                       json={"provider": "vobiz"})
    assert resp.status_code == 200
    assert resp.json()["default_provider"] == "vobiz"


def test_model_config_defaults(client, admin_headers):
    resp = client.get("/api/v1/model-config", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"stt", "llm", "tts"}
    assert body["stt"]["has_api_key"] is False
    assert "api_key" not in body["stt"]


def test_model_config_save_and_test_mock(client, admin_headers):
    resp = client.put("/api/v1/model-config/llm", headers=admin_headers,
                      json={"provider": "openai-compatible", "model": "qwen3.5-9b",
                            "base_url": "", "api_key": "sk-test-key"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["has_api_key"] is True
    assert "api_key" not in body
    assert "sk-test-key" not in resp.text

    # test with no base_url -> mock mode
    tested = client.post("/api/v1/model-config/llm/test", headers=admin_headers)
    assert tested.status_code == 200
    assert tested.json()["mode"] == "mock"

    # get again: key still hidden
    again = client.get("/api/v1/model-config", headers=admin_headers).json()
    assert again["llm"]["has_api_key"] is True
    assert "sk-test-key" not in str(again)


def test_model_config_test_unconfigured(client, admin_headers):
    resp = client.post("/api/v1/model-config/stt/test", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["mode"] == "mock"


def test_model_config_invalid_type(client, admin_headers):
    resp = client.put("/api/v1/model-config/nope", headers=admin_headers, json={})
    assert resp.status_code == 400


def test_model_config_reset(client, admin_headers):
    client.put("/api/v1/model-config/tts", headers=admin_headers,
               json={"provider": "speaches", "model": "kokoro", "api_key": "k"})
    resp = client.post("/api/v1/model-config/reset", headers=admin_headers)
    assert resp.json() == {"ok": True}
    body = client.get("/api/v1/model-config", headers=admin_headers).json()
    assert body["tts"]["has_api_key"] is False


def test_model_config_member_cannot_write(client, member_headers):
    resp = client.put("/api/v1/model-config/llm", headers=member_headers, json={"model": "x"})
    assert resp.status_code == 403
