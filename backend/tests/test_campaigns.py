"""Tests: campaign lifecycle, invalid transitions, contacts, stats."""
from __future__ import annotations


def _make_campaign(client, admin_headers, agent_id, name="Test Campaign"):
    resp = client.post("/api/v1/campaigns", headers=admin_headers,
                       json={"name": name, "agent_id": agent_id, "concurrency": 2})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_campaign_lifecycle(client, admin_headers, make_agent, make_contact):
    agent = make_agent(name="Lifecycle Agent")
    contact = make_contact(name="Lifecycle Contact", phone="+911234506001")
    camp = _make_campaign(client, admin_headers, agent["id"])
    cid = camp["id"]
    assert camp["status"] == "CREATED"

    # start requires contacts
    bad = client.post(f"/api/v1/campaigns/{cid}/start", headers=admin_headers)
    assert bad.status_code == 400

    # add contacts
    added = client.post(f"/api/v1/campaigns/{cid}/contacts", headers=admin_headers,
                        json={"contact_ids": [contact["id"]]})
    assert added.json()["contact_count"] == 1

    # invalid transition: pause from CREATED
    bad2 = client.post(f"/api/v1/campaigns/{cid}/pause", headers=admin_headers)
    assert bad2.status_code == 400

    started = client.post(f"/api/v1/campaigns/{cid}/start", headers=admin_headers)
    assert started.json()["status"] == "RUNNING"

    paused = client.post(f"/api/v1/campaigns/{cid}/pause", headers=admin_headers)
    assert paused.json()["status"] == "PAUSED"

    resumed = client.post(f"/api/v1/campaigns/{cid}/resume", headers=admin_headers)
    assert resumed.json()["status"] == "RUNNING"

    stopped = client.post(f"/api/v1/campaigns/{cid}/stop", headers=admin_headers)
    assert stopped.json()["status"] == "STOPPED"

    # cannot resume from STOPPED
    bad3 = client.post(f"/api/v1/campaigns/{cid}/resume", headers=admin_headers)
    assert bad3.status_code == 400


def test_campaign_start_requires_active_agent(client, admin_headers, make_agent, make_contact):
    agent = make_agent(name="Disabled Campaign Agent")
    contact = make_contact(name="Camp Contact", phone="+911234506002")
    camp = _make_campaign(client, admin_headers, agent["id"], name="Disabled Agent Campaign")
    client.post(f"/api/v1/campaigns/{camp['id']}/contacts", headers=admin_headers,
                json={"contact_ids": [contact["id"]]})
    client.post(f"/api/v1/agents/{agent['id']}/toggle", headers=admin_headers)
    resp = client.post(f"/api/v1/campaigns/{camp['id']}/start", headers=admin_headers)
    assert resp.status_code == 400
    assert "agent" in resp.json()["detail"].lower()


def test_campaign_stats_empty(client, admin_headers, make_agent):
    agent = make_agent(name="Stats Agent")
    camp = _make_campaign(client, admin_headers, agent["id"], name="Stats Campaign")
    resp = client.get(f"/api/v1/campaigns/{camp['id']}/stats", headers=admin_headers)
    assert resp.status_code == 200
    stats = resp.json()
    assert stats["total"] == 0
    assert stats["avg_duration_sec"] == 0.0
    for key in ("attempted", "answered", "completed", "failed", "busy", "no_answer",
                "interested", "qualified"):
        assert stats[key] == 0


def test_campaign_stats_with_calls(client, admin_headers, make_agent, make_contact):
    agent = make_agent(name="Stats Agent 2")
    c1 = make_contact(name="Stat Contact 1", phone="+911234506011")
    camp = _make_campaign(client, admin_headers, agent["id"], name="Stats Campaign 2")
    client.post(f"/api/v1/campaigns/{camp['id']}/contacts", headers=admin_headers,
                json={"contact_ids": [c1["id"]]})
    call = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent["id"], "contact_id": c1["id"],
                             "campaign_id": camp["id"]}).json()
    client.post(f"/api/v1/calls/{call['id']}/hangup", headers=admin_headers)
    stats = client.get(f"/api/v1/campaigns/{camp['id']}/stats", headers=admin_headers).json()
    assert stats["total"] == 1
    assert stats["completed"] == 1
    assert stats["attempted"] == 1


def test_campaign_update_delete(client, admin_headers, make_agent):
    agent = make_agent(name="Upd Agent")
    camp = _make_campaign(client, admin_headers, agent["id"], name="Upd Campaign")
    upd = client.put(f"/api/v1/campaigns/{camp['id']}", headers=admin_headers,
                     json={"description": "updated"})
    assert upd.json()["description"] == "updated"
    dele = client.delete(f"/api/v1/campaigns/{camp['id']}", headers=admin_headers)
    assert dele.status_code == 204
