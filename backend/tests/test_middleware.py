"""Tests: middleware — secure headers and rate limiting (429)."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware


def _mini_app(**kwargs) -> TestClient:
    app = FastAPI()

    @app.get("/ping")
    def ping():
        return JSONResponse({"ok": True})

    @app.post("/api/v1/auth/login")
    def login():
        return JSONResponse({"ok": True})

    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware, **kwargs)
    return TestClient(app)


def test_secure_headers():
    client = _mini_app()
    resp = client.get("/ping")
    assert resp.headers["X-Content-Type-Options"] == "nosniff"
    assert resp.headers["X-Frame-Options"] == "DENY"
    assert resp.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_rate_limit_429():
    client = _mini_app(per_minute=2, login_per_minute=100)
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    resp = client.get("/ping")
    assert resp.status_code == 429
    assert "detail" in resp.json()


def test_login_rate_limit_separate_bucket():
    client = _mini_app(per_minute=100, login_per_minute=1)
    assert client.post("/api/v1/auth/login").status_code == 200
    resp = client.post("/api/v1/auth/login")
    assert resp.status_code == 429
