"""Tests: agents CRUD, duplicate, toggle, workspace, versions + businesses."""
from __future__ import annotations


def test_agent_crud(client, admin_headers, agent_payload):
    created = client.post("/api/v1/agents", json=agent_payload, headers=admin_headers)
    assert created.status_code == 201, created.text
    aid = created.json()["id"]

    got = client.get(f"/api/v1/agents/{aid}", headers=admin_headers)
    assert got.status_code == 200
    assert got.json()["name"] == "Test Agent"

    upd = client.put(f"/api/v1/agents/{aid}", json={"tone": "warm"}, headers=admin_headers)
    assert upd.status_code == 200
    assert upd.json()["tone"] == "warm"

    listed = client.get("/api/v1/agents?search=Test+Agent", headers=admin_headers)
    assert listed.json()["total"] >= 1

    dele = client.delete(f"/api/v1/agents/{aid}", headers=admin_headers)
    assert dele.status_code == 204
    assert client.get(f"/api/v1/agents/{aid}", headers=admin_headers).status_code == 404


def test_agent_duplicate(client, admin_headers, make_agent):
    agent = make_agent(name="Dup Source")
    resp = client.post(f"/api/v1/agents/{agent['id']}/duplicate", headers=admin_headers)
    assert resp.status_code == 201, resp.text
    assert resp.json()["name"] == "Dup Source (copy)"
    assert resp.json()["id"] != agent["id"]


def test_agent_toggle(client, admin_headers, make_agent):
    agent = make_agent(name="Toggle Agent")
    assert agent["status"] == "active"
    resp = client.post(f"/api/v1/agents/{agent['id']}/toggle", headers=admin_headers)
    assert resp.json()["status"] == "disabled"
    resp = client.post(f"/api/v1/agents/{agent['id']}/toggle", headers=admin_headers)
    assert resp.json()["status"] == "active"


def test_agent_versions_on_update_and_restore(client, admin_headers, make_agent):
    agent = make_agent(name="Versioned Agent", tone="neutral")
    aid = agent["id"]
    # PUT snapshots prior config
    client.put(f"/api/v1/agents/{aid}", json={"tone": "formal"}, headers=admin_headers)
    client.put(f"/api/v1/agents/{aid}", json={"tone": "playful"}, headers=admin_headers)
    versions = client.get(f"/api/v1/agents/{aid}/versions", headers=admin_headers).json()
    assert len(versions) == 2
    assert versions[0]["version"] == 2
    assert versions[0]["snapshot"]["tone"] == "formal"
    assert versions[1]["snapshot"]["tone"] == "neutral"
    # restore the oldest version (tone=neutral)
    oldest = versions[-1]
    restored = client.post(f"/api/v1/agents/{aid}/versions/{oldest['id']}/restore", headers=admin_headers)
    assert restored.status_code == 200
    assert restored.json()["tone"] == "neutral"
    # restore created a new snapshot too
    versions2 = client.get(f"/api/v1/agents/{aid}/versions", headers=admin_headers).json()
    assert len(versions2) == 3


def test_agent_workspace(client, admin_headers, make_agent):
    agent = make_agent(name="Workspace Agent")
    resp = client.get(f"/api/v1/agents/{agent['id']}/workspace", headers=admin_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["agent"]["id"] == agent["id"]
    assert body["active_calls"] == 0
    assert body["calls_today"] == 0
    assert body["recent_calls"] == []


def test_agent_filters(client, admin_headers, make_agent):
    a1 = make_agent(name="Filter One")
    a2 = make_agent(name="Filter Two")
    client.post(f"/api/v1/agents/{a2['id']}/toggle", headers=admin_headers)
    resp = client.get("/api/v1/agents?status=disabled", headers=admin_headers).json()
    assert any(a["id"] == a2["id"] for a in resp["items"])
    assert all(a["id"] != a1["id"] for a in resp["items"])


def test_business_crud_and_agents(client, admin_headers, make_agent):
    created = client.post("/api/v1/businesses", json={"name": "Acme Retail", "industry": "Retail"},
                          headers=admin_headers)
    assert created.status_code == 201, created.text
    bid = created.json()["id"]

    agent = make_agent(name="Biz Agent")
    client.put(f"/api/v1/agents/{agent['id']}", json={"business_id": bid}, headers=admin_headers)

    resp = client.get(f"/api/v1/businesses/{bid}/agents", headers=admin_headers)
    assert resp.status_code == 200
    assert any(a["id"] == agent["id"] for a in resp.json()["items"])

    upd = client.put(f"/api/v1/businesses/{bid}", json={"industry": "E-commerce"}, headers=admin_headers)
    assert upd.json()["industry"] == "E-commerce"

    dele = client.delete(f"/api/v1/businesses/{bid}", headers=admin_headers)
    assert dele.status_code == 204
