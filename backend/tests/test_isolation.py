"""Tests: tenant isolation — tenant B cannot see tenant A's data."""
from __future__ import annotations


def test_agent_isolation(client, admin_headers, admin_b_headers, make_agent):
    agent = make_agent(name="Isolation Agent")
    # Tenant B list: must not contain A's agent
    resp = client.get("/api/v1/agents", headers=admin_b_headers)
    assert resp.status_code == 200
    ids = [a["id"] for a in resp.json()["items"]]
    assert agent["id"] not in ids
    # Tenant B direct fetch -> 404
    resp = client.get(f"/api/v1/agents/{agent['id']}", headers=admin_b_headers)
    assert resp.status_code == 404


def test_contact_isolation(client, admin_headers, admin_b_headers, make_contact):
    contact = make_contact(name="Isolation Contact", phone="+919990001111")
    resp = client.get("/api/v1/contacts?search=Isolation+Contact", headers=admin_b_headers)
    assert resp.status_code == 200
    assert all(c["id"] != contact["id"] for c in resp.json()["items"])
    resp = client.get(f"/api/v1/contacts/{contact['id']}", headers=admin_b_headers)
    assert resp.status_code == 404


def test_call_isolation(client, admin_headers, admin_b_headers, make_agent, make_contact):
    agent = make_agent(name="Iso Call Agent")
    contact = make_contact(name="Iso Call Contact", phone="+919990002222")
    created = client.post("/api/v1/calls", headers=admin_headers,
                          json={"agent_id": agent["id"], "contact_id": contact["id"]})
    assert created.status_code == 201, created.text
    call_id = created.json()["id"]
    resp = client.get(f"/api/v1/calls/{call_id}", headers=admin_b_headers)
    assert resp.status_code == 404
    resp = client.get("/api/v1/calls", headers=admin_b_headers)
    assert resp.status_code == 200
    assert all(c["id"] != call_id for c in resp.json()["items"])


def test_campaign_isolation(client, admin_headers, admin_b_headers, make_agent):
    agent = make_agent(name="Iso Campaign Agent")
    created = client.post("/api/v1/campaigns", headers=admin_headers,
                          json={"name": "Iso Campaign", "agent_id": agent["id"]})
    cid = created.json()["id"]
    resp = client.get(f"/api/v1/campaigns/{cid}", headers=admin_b_headers)
    assert resp.status_code == 404


def test_lead_isolation(client, admin_headers, admin_b_headers):
    created = client.post("/api/v1/leads", headers=admin_headers,
                          json={"name": "Iso Lead", "phone": "+919990003333"})
    lid = created.json()["id"]
    resp = client.get(f"/api/v1/leads/{lid}", headers=admin_b_headers)
    assert resp.status_code == 404
