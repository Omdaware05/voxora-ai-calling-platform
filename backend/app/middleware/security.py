"""Security headers + in-memory per-IP rate limiting middleware."""
from __future__ import annotations

import time
from collections import defaultdict
from typing import Deque
from collections import deque

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from app.config import get_settings


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple sliding-window in-memory rate limiter (per client IP).

    Default: 120 req/min; /api/v1/auth/login: 15 req/min.
    Exceeding the limit returns HTTP 429.
    """

    def __init__(self, app, per_minute: int | None = None, login_per_minute: int | None = None):
        super().__init__(app)
        settings = get_settings()
        self.per_minute = per_minute or settings.RATE_LIMIT_PER_MINUTE
        self.login_per_minute = login_per_minute or settings.RATE_LIMIT_LOGIN_PER_MINUTE
        self._hits: dict[str, Deque[float]] = defaultdict(deque)

    def _allowed(self, key: str, limit: int) -> bool:
        now = time.monotonic()
        window = self._hits[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= limit:
            return False
        window.append(now)
        return True

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks and websockets
        if request.url.path in ("/health", "/api/v1/health") or request.url.path.startswith("/api/v1/ws/"):
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"
        if request.url.path == "/api/v1/auth/login":
            key, limit = f"login:{ip}", self.login_per_minute
        else:
            key, limit = f"ip:{ip}", self.per_minute
        if not self._allowed(key, limit):
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again later."})
        return await call_next(request)
