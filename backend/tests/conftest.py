"""Pytest fixtures: file-based SQLite (per session), StaticPool, overridden get_db,
DEMO_MODE=true, generous rate limits, and two tenants for isolation tests."""
from __future__ import annotations

import os
import tempfile

# --- env must be set BEFORE importing app modules (settings are cached) ---
_tmpdir = tempfile.mkdtemp(prefix="voxora-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmpdir}/test.db"
os.environ["DEMO_MODE"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key"
os.environ["RATE_LIMIT_PER_MINUTE"] = "100000"
os.environ["RATE_LIMIT_LOGIN_PER_MINUTE"] = "10000"
os.environ["REDIS_URL"] = "redis://localhost:6399/0"  # nothing listens here -> in-memory fallback

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app import models  # noqa: E402
from app.database import Base, get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402

TEST_PASSWORD = "password123"


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(
        os.environ["DATABASE_URL"],
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session")
def session_factory(engine):
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


@pytest.fixture(scope="session")
def _seed(session_factory):
    """Seed two tenants + users (session scoped)."""
    db = session_factory()
    try:
        tenant_a = models.Tenant(name="Tenant A", industry="Retail", timezone="Asia/Kolkata",
                                 languages=["en"], status="active")
        tenant_b = models.Tenant(name="Tenant B", industry="Health", timezone="Asia/Kolkata",
                                 languages=["en"], status="active")
        db.add_all([tenant_a, tenant_b])
        db.flush()
        users = [
            models.User(tenant_id=tenant_a.id, email="admin@tenant-a.voxora.io", name="Admin A",
                        password_hash=hash_password(TEST_PASSWORD), role="ADMIN"),
            models.User(tenant_id=tenant_a.id, email="member@tenant-a.voxora.io", name="Member A",
                        password_hash=hash_password(TEST_PASSWORD), role="MEMBER"),
            models.User(tenant_id=tenant_a.id, email="viewer@tenant-a.voxora.io", name="Viewer A",
                        password_hash=hash_password(TEST_PASSWORD), role="VIEWER"),
            models.User(tenant_id=tenant_b.id, email="admin@tenant-b.voxora.io", name="Admin B",
                        password_hash=hash_password(TEST_PASSWORD), role="ADMIN"),
        ]
        db.add_all(users)
        db.commit()
        yield {"tenant_a": tenant_a.id, "tenant_b": tenant_b.id}
    finally:
        db.close()


@pytest.fixture(scope="session")
def client(session_factory, _seed):
    def override_get_db():
        db = session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(scope="session")
def db(session_factory, _seed):
    s = session_factory()
    try:
        yield s
    finally:
        s.close()


def _login(client: TestClient, email: str) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": TEST_PASSWORD})
    assert resp.status_code == 200, resp.text
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def admin_headers(client) -> dict:
    return _login(client, "admin@tenant-a.voxora.io")


@pytest.fixture(scope="session")
def member_headers(client) -> dict:
    return _login(client, "member@tenant-a.voxora.io")


@pytest.fixture(scope="session")
def viewer_headers(client) -> dict:
    return _login(client, "viewer@tenant-a.voxora.io")


@pytest.fixture(scope="session")
def admin_b_headers(client) -> dict:
    return _login(client, "admin@tenant-b.voxora.io")


@pytest.fixture()
def agent_payload() -> dict:
    return {"name": "Test Agent", "description": "pytest agent", "language": "en",
            "greeting": "Hello", "status": "active"}


@pytest.fixture()
def make_agent(client, admin_headers, agent_payload):
    """Create an agent via API; return its JSON."""
    created = []

    def _make(**overrides):
        payload = {**agent_payload, **overrides}
        resp = client.post("/api/v1/agents", json=payload, headers=admin_headers)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        created.append(data["id"])
        return data

    yield _make


@pytest.fixture()
def make_contact(client, admin_headers):
    created = []

    def _make(**overrides):
        payload = {"name": "Test Contact", "phone": "+911234567890", **overrides}
        resp = client.post("/api/v1/contacts", json=payload, headers=admin_headers)
        assert resp.status_code == 201, resp.text
        data = resp.json()
        created.append(data["id"])
        return data

    yield _make
