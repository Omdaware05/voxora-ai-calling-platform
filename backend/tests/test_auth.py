"""Tests: health, auth, RBAC."""
from __future__ import annotations


def test_health_root(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok", "version": "0.1.0"}


def test_health_v1(client):
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_login_ok(client):
    resp = client.post("/api/v1/auth/login", json={"email": "admin@tenant-a.voxora.io", "password": "password123"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["email"] == "admin@tenant-a.voxora.io"
    assert body["user"]["role"] == "ADMIN"
    assert body["user"]["tenant_name"] == "Tenant A"


def test_login_bad_password(client):
    resp = client.post("/api/v1/auth/login", json={"email": "admin@tenant-a.voxora.io", "password": "wrong"})
    assert resp.status_code == 401
    assert "detail" in resp.json()


def test_login_unknown_user(client):
    resp = client.post("/api/v1/auth/login", json={"email": "nobody@tenant-a.voxora.io", "password": "password123"})
    assert resp.status_code == 401


def test_me(client, admin_headers):
    resp = client.get("/api/v1/auth/me", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["email"] == "admin@tenant-a.voxora.io"


def test_me_unauthenticated(client):
    resp = client.get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_me_bad_token(client):
    resp = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


def test_logout(client, admin_headers):
    resp = client.post("/api/v1/auth/logout", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


def test_viewer_cannot_create_user(client, viewer_headers):
    resp = client.post("/api/v1/users", headers=viewer_headers,
                       json={"email": "x@tenant-a.voxora.io", "name": "X", "password": "password123"})
    assert resp.status_code == 403


def test_member_cannot_create_user(client, member_headers):
    resp = client.post("/api/v1/users", headers=member_headers,
                       json={"email": "x@tenant-a.voxora.io", "name": "X", "password": "password123"})
    assert resp.status_code == 403


def test_admin_can_create_user(client, admin_headers):
    resp = client.post("/api/v1/users", headers=admin_headers,
                       json={"email": "newbie@tenant-a.voxora.io", "name": "Newbie", "password": "password123",
                             "role": "VIEWER"})
    assert resp.status_code == 201, resp.text
    assert resp.json()["email"] == "newbie@tenant-a.voxora.io"
    # duplicate -> 409
    resp2 = client.post("/api/v1/users", headers=admin_headers,
                        json={"email": "newbie@tenant-a.voxora.io", "name": "Dup", "password": "password123"})
    assert resp2.status_code == 409


def test_viewer_cannot_write_contacts(client, viewer_headers):
    resp = client.post("/api/v1/contacts", headers=viewer_headers,
                       json={"name": "Nope", "phone": "+911111111111"})
    assert resp.status_code == 403


def test_viewer_can_read(client, viewer_headers):
    resp = client.get("/api/v1/agents", headers=viewer_headers)
    assert resp.status_code == 200


def test_user_crud_admin(client, admin_headers):
    created = client.post("/api/v1/users", headers=admin_headers,
                          json={"email": "crud@tenant-a.voxora.io", "name": "Crud", "password": "password123"})
    uid = created.json()["id"]
    got = client.get(f"/api/v1/users/{uid}", headers=admin_headers)
    assert got.status_code == 200
    upd = client.put(f"/api/v1/users/{uid}", headers=admin_headers, json={"name": "Crud Updated"})
    assert upd.status_code == 200
    assert upd.json()["name"] == "Crud Updated"
    dele = client.delete(f"/api/v1/users/{uid}", headers=admin_headers)
    assert dele.status_code == 204
    gone = client.get(f"/api/v1/users/{uid}", headers=admin_headers)
    assert gone.status_code == 404


def test_cannot_delete_self(client, admin_headers):
    me = client.get("/api/v1/auth/me", headers=admin_headers).json()
    resp = client.delete(f"/api/v1/users/{me['id']}", headers=admin_headers)
    assert resp.status_code == 400
