"""Tests: call initiate (mock dograh), hangup, transcript, events, live, demo-event, recording."""
from __future__ import annotations


def _start_call(client, admin_headers, agent_id, **kw):
    resp = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent_id, **kw})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_initiate_call_mock_dograh(client, admin_headers, make_agent):
    agent = make_agent(name="Call Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507001")
    assert call["status"] == "IN_PROGRESS"
    assert call["dograh_run_id"].startswith("mock-run-")
    assert call["direction"] == "outbound"


def test_initiate_call_validates_agent(client, admin_headers):
    resp = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": 999999, "phone": "+911234507002"})
    assert resp.status_code == 404


def test_initiate_call_disabled_agent(client, admin_headers, make_agent):
    agent = make_agent(name="Disabled Call Agent")
    client.post(f"/api/v1/agents/{agent['id']}/toggle", headers=admin_headers)
    resp = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent["id"], "phone": "+911234507003"})
    assert resp.status_code == 400


def test_live_calls(client, admin_headers, make_agent):
    agent = make_agent(name="Live Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507004")
    live = client.get("/api/v1/calls/live", headers=admin_headers).json()
    assert any(c["id"] == call["id"] for c in live)
    client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    live = client.get("/api/v1/calls/live", headers=admin_headers).json()
    assert all(c["id"] != call["id"] for c in live)


def test_hangup(client, admin_headers, make_agent):
    agent = make_agent(name="Hangup Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507005")
    resp = client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "COMPLETED"
    assert body["duration_sec"] is not None
    # second hangup -> 400
    again = client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    assert again.status_code == 400


def test_call_events(client, admin_headers, make_agent):
    agent = make_agent(name="Events Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507006")
    events = client.get(f"/api/v1/calls/{call['id']}/events", headers=admin_headers).json()
    types = [e["type"] for e in events]
    assert "call.initiating" in types
    assert "call.in_progress" in types
    client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    events = client.get(f"/api/v1/calls/{call['id']}/events", headers=admin_headers).json()
    assert "call.ended" in [e["type"] for e in events]


def test_transcript_and_demo_event(client, admin_headers, make_agent):
    agent = make_agent(name="Transcript Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507007")
    # empty transcript
    tr = client.get(f"/api/v1/calls/{call['id']}/transcript", headers=admin_headers).json()
    assert tr["segments"] == []
    # demo event (ADMIN + DEMO_MODE=true)
    seg = client.post(f"/api/v1/calls/{call['id']}/demo-event", headers=admin_headers,
                      json={"speaker": "ai", "text": "Hello there"})
    assert seg.status_code == 201, seg.text
    seg2 = client.post(f"/api/v1/calls/{call['id']}/demo-event", headers=admin_headers,
                       json={"speaker": "customer", "text": "Hi!"})
    assert seg2.status_code == 201
    tr = client.get(f"/api/v1/calls/{call['id']}/transcript", headers=admin_headers).json()
    assert len(tr["segments"]) == 2
    assert tr["segments"][0]["speaker"] == "ai"
    assert "Hello there" in tr["full_text"]


def test_demo_event_forbidden_for_member(client, member_headers, admin_headers, make_agent):
    agent = make_agent(name="Demo Member Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507008")
    resp = client.post(f"/api/v1/calls/{call['id']}/demo-event", headers=member_headers,
                       json={"speaker": "ai", "text": "Hi"})
    assert resp.status_code == 403


def test_recording_honest_404(client, admin_headers, make_agent):
    agent = make_agent(name="Recording Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507009")
    resp = client.get(f"/api/v1/calls/{call['id']}/recording", headers=admin_headers)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "No recording available"}


def test_call_list_filters(client, admin_headers, make_agent):
    agent = make_agent(name="Filter Call Agent")
    call = _start_call(client, admin_headers, agent["id"], phone="+911234507010")
    resp = client.get(f"/api/v1/calls?status=IN_PROGRESS&agent_id={agent['id']}",
                      headers=admin_headers).json()
    assert any(c["id"] == call["id"] for c in resp["items"])
    resp = client.get("/api/v1/calls?search=507010", headers=admin_headers).json()
    assert any(c["id"] == call["id"] for c in resp["items"])
