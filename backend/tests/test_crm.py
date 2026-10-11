"""Tests: leads CRUD, follow-ups lifecycle."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def test_lead_crud(client, admin_headers):
    created = client.post("/api/v1/leads", headers=admin_headers,
                          json={"name": "Lead One", "phone": "+911234508001", "score": 70})
    assert created.status_code == 201, created.text
    lid = created.json()["id"]
    assert created.json()["status"] == "NEW"

    got = client.get(f"/api/v1/leads/{lid}", headers=admin_headers)
    assert got.json()["name"] == "Lead One"

    patched = client.patch(f"/api/v1/leads/{lid}", headers=admin_headers,
                           json={"status": "QUALIFIED", "score": 90})
    assert patched.json()["status"] == "QUALIFIED"

    listed = client.get("/api/v1/leads?status=QUALIFIED&search=Lead+One", headers=admin_headers).json()
    assert any(l["id"] == lid for l in listed["items"])

    dele = client.delete(f"/api/v1/leads/{lid}", headers=admin_headers)
    assert dele.status_code == 204
    assert client.get(f"/api/v1/leads/{lid}", headers=admin_headers).status_code == 404


def test_lead_invalid_status(client, admin_headers):
    resp = client.post("/api/v1/leads", headers=admin_headers,
                       json={"name": "Bad Lead", "phone": "+911234508002", "status": "NOPE"})
    assert resp.status_code == 422


def _make_followup(client, admin_headers, contact_id, days=1, **kw):
    scheduled = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
    resp = client.post("/api/v1/followups", headers=admin_headers,
                       json={"contact_id": contact_id, "scheduled_at": scheduled,
                             "notes": "call back", **kw})
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_followup_lifecycle(client, admin_headers, make_contact):
    contact = make_contact(name="Followup Contact", phone="+911234508011")
    fu = _make_followup(client, admin_headers, contact["id"])
    fid = fu["id"]
    assert fu["status"] == "PENDING"

    got = client.get(f"/api/v1/followups/{fid}", headers=admin_headers)
    assert got.status_code == 200

    upd = client.put(f"/api/v1/followups/{fid}", headers=admin_headers,
                     json={"notes": "updated notes"})
    assert upd.json()["notes"] == "updated notes"

    # reschedule
    new_time = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    resched = client.post(f"/api/v1/followups/{fid}/reschedule", headers=admin_headers,
                          json={"scheduled_at": new_time})
    assert resched.status_code == 200

    # complete
    done = client.post(f"/api/v1/followups/{fid}/complete", headers=admin_headers)
    assert done.json()["status"] == "COMPLETED"
    # completing again -> 400
    again = client.post(f"/api/v1/followups/{fid}/complete", headers=admin_headers)
    assert again.status_code == 400


def test_followup_cancel(client, admin_headers, make_contact):
    contact = make_contact(name="Cancel Contact", phone="+911234508012")
    fu = _make_followup(client, admin_headers, contact["id"])
    cancelled = client.post(f"/api/v1/followups/{fu['id']}/cancel", headers=admin_headers)
    assert cancelled.json()["status"] == "CANCELLED"
    listed = client.get("/api/v1/followups?status=CANCELLED", headers=admin_headers).json()
    assert any(f["id"] == fu["id"] for f in listed["items"])
    dele = client.delete(f"/api/v1/followups/{fu['id']}", headers=admin_headers)
    assert dele.status_code == 204


def test_followup_requires_tenant_contact(client, admin_headers):
    scheduled = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    resp = client.post("/api/v1/followups", headers=admin_headers,
                       json={"contact_id": 999999, "scheduled_at": scheduled})
    assert resp.status_code == 400
