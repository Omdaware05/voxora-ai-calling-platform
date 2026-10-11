"""Tests: contacts CRUD, import/export, bulk delete, DNC, click-to-call."""
from __future__ import annotations


def test_contact_crud(client, admin_headers):
    created = client.post("/api/v1/contacts", headers=admin_headers,
                          json={"name": "CRUD Person", "phone": "+911234500001", "tags": ["x"]})
    assert created.status_code == 201, created.text
    cid = created.json()["id"]
    got = client.get(f"/api/v1/contacts/{cid}", headers=admin_headers)
    assert got.json()["name"] == "CRUD Person"
    upd = client.put(f"/api/v1/contacts/{cid}", headers=admin_headers, json={"name": "CRUD Person 2"})
    assert upd.json()["name"] == "CRUD Person 2"
    dele = client.delete(f"/api/v1/contacts/{cid}", headers=admin_headers)
    assert dele.status_code == 204


def test_contact_search_and_pagination(client, admin_headers, make_contact):
    make_contact(name="Zed Alpha", phone="+911234500101")
    make_contact(name="Zed Beta", phone="+911234500102")
    resp = client.get("/api/v1/contacts?search=Zed&page=1&page_size=1", headers=admin_headers).json()
    assert resp["total"] >= 2
    assert resp["page_size"] == 1
    assert len(resp["items"]) == 1


def test_contact_import_csv(client, admin_headers):
    csv_data = "name,phone,email,tags\nCsv One,+911234501001,one@example.in,\"vip,delhi\"\nCsv Two,+911234501002,,\nBad Row,,,\n"
    resp = client.post("/api/v1/contacts/import", headers=admin_headers,
                       files={"file": ("contacts.csv", csv_data.encode(), "text/csv")})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["created"] == 2
    assert body["skipped"] == 1


def test_contact_import_rejects_bad_type(client, admin_headers):
    resp = client.post("/api/v1/contacts/import", headers=admin_headers,
                       files={"file": ("contacts.txt", b"x", "text/plain")})
    assert resp.status_code == 400


def test_contact_export_csv(client, admin_headers, make_contact):
    make_contact(name="Export Me", phone="+911234502001")
    resp = client.get("/api/v1/contacts/export", headers=admin_headers)
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    assert "Export Me" in resp.text
    assert resp.text.splitlines()[0].startswith("id,name,phone")


def test_contact_bulk_delete(client, admin_headers, make_contact):
    c1 = make_contact(name="Bulk One", phone="+911234503001")
    c2 = make_contact(name="Bulk Two", phone="+911234503002")
    resp = client.post("/api/v1/contacts/bulk-delete", headers=admin_headers,
                       json={"ids": [c1["id"], c2["id"]]})
    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2
    assert client.get(f"/api/v1/contacts/{c1['id']}", headers=admin_headers).status_code == 404


def test_dnc_blocks_call(client, admin_headers, make_agent, make_contact):
    agent = make_agent(name="DNC Agent")
    contact = make_contact(name="DNC Person", phone="+911234504001")
    # set do-not-call
    dnc = client.patch(f"/api/v1/contacts/{contact['id']}/do-not-call", headers=admin_headers,
                       json={"do_not_call": True})
    assert dnc.json()["do_not_call"] is True
    # direct call attempt -> 400
    resp = client.post("/api/v1/calls", headers=admin_headers,
                       json={"agent_id": agent["id"], "contact_id": contact["id"]})
    assert resp.status_code == 400
    assert "do-not-call" in resp.json()["detail"]
    # click-to-call also blocked
    resp = client.post(f"/api/v1/contacts/{contact['id']}/call?agent_id={agent['id']}",
                       headers=admin_headers)
    assert resp.status_code == 400
    # unset DNC -> call allowed
    client.patch(f"/api/v1/contacts/{contact['id']}/do-not-call", headers=admin_headers,
                 json={"do_not_call": False})
    ok = client.post("/api/v1/calls", headers=admin_headers,
                     json={"agent_id": agent["id"], "contact_id": contact["id"]})
    assert ok.status_code == 201, ok.text


def test_contact_click_to_call(client, admin_headers, make_agent, make_contact):
    agent = make_agent(name="Click Agent")
    contact = make_contact(name="Click Person", phone="+911234505001")
    resp = client.post(f"/api/v1/contacts/{contact['id']}/call?agent_id={agent['id']}",
                       headers=admin_headers)
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["phone"] == "+911234505001"
    assert body["status"] == "IN_PROGRESS"  # mock dograh
