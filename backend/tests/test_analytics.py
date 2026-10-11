"""Tests: analytics (real queries; empty DB -> zeros/empty arrays), dograh mock, websocket."""
from __future__ import annotations


def test_analytics_overview_shape_empty_db(client, admin_b_headers):
    # Tenant B has no calls/leads -> everything zero/empty, never fabricated
    resp = client.get("/api/v1/analytics/overview", headers=admin_b_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body == {
        "calls_today": 0,
        "completed_calls": 0,
        "active_calls": 0,
        "answer_rate": 0.0,
        "avg_duration_sec": 0.0,
        "interested_leads": 0,
        "qualified_leads": 0,
        "followups_due": 0,
        "ai_usage_minutes": 0.0,
        "est_cost": 0.0,
    }


def test_analytics_endpoints_empty(client, admin_b_headers):
    series = client.get("/api/v1/analytics/calls-over-time?days=7", headers=admin_b_headers).json()
    assert series["days"] == 7
    assert len(series["series"]) == 7
    assert all(s["total"] == 0 and s["completed"] == 0 for s in series["series"])
    assert client.get("/api/v1/analytics/outcomes", headers=admin_b_headers).json() == {"outcomes": []}
    buckets = client.get("/api/v1/analytics/durations", headers=admin_b_headers).json()["buckets"]
    assert len(buckets) == 6 and all(b["count"] == 0 for b in buckets)
    assert client.get("/api/v1/analytics/agents", headers=admin_b_headers).json() == {"agents": []}
    assert client.get("/api/v1/analytics/campaigns", headers=admin_b_headers).json() == {"campaigns": []}
    funnel = client.get("/api/v1/analytics/lead-funnel", headers=admin_b_headers).json()["funnel"]
    assert [f["stage"] for f in funnel] == ["NEW", "INTERESTED", "NOT_INTERESTED", "QUALIFIED", "CLOSED"]
    assert all(f["count"] == 0 for f in funnel)
    assert client.get("/api/v1/usage", headers=admin_b_headers).json() == {
        "ai_usage_minutes": 0,
        "est_cost": 0,
        "calls": 0,
        "period": "All time",
    }


def test_analytics_overview_with_data(client, admin_headers, make_agent):
    agent = make_agent(name="Analytics Agent")
    call = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent["id"], "phone": "+911234509001"}).json()
    client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    client.post("/api/v1/leads", headers=admin_headers,
                json={"name": "An Lead", "phone": "+911234509002", "status": "INTERESTED"})
    overview = client.get("/api/v1/analytics/overview", headers=admin_headers).json()
    assert overview["calls_today"] >= 1
    assert overview["completed_calls"] >= 1
    assert overview["interested_leads"] >= 1
    outcomes = client.get("/api/v1/analytics/outcomes", headers=admin_headers).json()["outcomes"]
    assert any(o["status"] == "COMPLETED" for o in outcomes)
    per_agent = client.get("/api/v1/analytics/agents", headers=admin_headers).json()["agents"]
    assert any(a["agent_id"] == agent["id"] and a["calls"] >= 1 for a in per_agent)


def test_dograh_mock_endpoints(client, admin_headers):
    health = client.get("/api/v1/integrations/dograh/health", headers=admin_headers).json()
    assert health["mode"] == "mock" and health["ok"] is True
    sync = client.post("/api/v1/integrations/dograh/sync", headers=admin_headers).json()
    assert sync["mode"] == "mock"
    wfs = client.get("/api/v1/integrations/dograh/workflows", headers=admin_headers).json()
    assert wfs["workflows"] == []
    wf = client.post("/api/v1/integrations/dograh/workflows", headers=admin_headers,
                     json={"name": "wf1"}).json()
    assert wf["id"].startswith("mock-wf-")
    pub = client.post(f"/api/v1/integrations/dograh/workflows/{wf['id']}/publish",
                      headers=admin_headers).json()
    assert pub["status"] == "published"
    run = client.post("/api/v1/integrations/dograh/runs", headers=admin_headers,
                      json={"agent_id": "1", "phone": "+911234509003"}).json()
    assert run["run_id"].startswith("mock-run-")
    st = client.get(f"/api/v1/integrations/dograh/runs/{run['run_id']}", headers=admin_headers).json()
    assert st["ok"] is True
    stop = client.post(f"/api/v1/integrations/dograh/runs/{run['run_id']}/stop",
                       headers=admin_headers).json()
    assert stop["status"] == "COMPLETED"


def test_websocket_auth_required(client):
    # no token -> 4401 close
    with client.websocket_connect("/api/v1/ws/calls") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "error"
        assert msg["detail"] == "Unauthorized"


def test_websocket_receives_call_events(client, admin_headers, make_agent):
    token = admin_headers["Authorization"].split(" ", 1)[1]
    agent = make_agent(name="WS Agent")
    with client.websocket_connect(f"/api/v1/ws/calls?token={token}") as ws:
        created = client.post("/api/v1/calls", headers=admin_headers,
                              json={"agent_id": agent["id"], "phone": "+911234509004"}).json()
        # expect at least the call.created event for our tenant
        seen = set()
        for _ in range(10):
            msg = ws.receive_json()
            if msg.get("type") == "ping":
                continue
            if msg.get("call_id") == created["id"]:
                seen.add(msg["type"])
            if seen >= {"call.created", "call.updated"}:
                break
        assert "call.created" in seen


def test_websocket_transcript_events(client, admin_headers, make_agent):
    token = admin_headers["Authorization"].split(" ", 1)[1]
    agent = make_agent(name="WS Transcript Agent")
    call = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent["id"], "phone": "+911234509005"}).json()
    with client.websocket_connect(f"/api/v1/ws/calls/{call['id']}?token={token}") as ws:
        client.post(f"/api/v1/calls/{call['id']}/demo-event", headers=admin_headers,
                    json={"speaker": "ai", "text": "ws hello"})
        for _ in range(10):
            msg = ws.receive_json()
            if msg.get("type") == "ping":
                continue
            if msg.get("type") == "transcript.segment":
                assert msg["segment"]["text"] == "ws hello"
                break
        else:
            raise AssertionError("no transcript.segment received")
