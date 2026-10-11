"""Voxora API — FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import (
    agents,
    analytics,
    auth,
    businesses,
    calls,
    campaigns,
    contacts,
    dograh,
    followups,
    leads,
    model_config,
    questionnaires,
    telephony,
    usage,
    users,
    websocket,
)
from app.config import get_settings
from app.middleware.security import RateLimitMiddleware, SecurityHeadersMiddleware

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    if settings.AUTO_CREATE_TABLES:
        logger.warning("AUTO_CREATE_TABLES=true: creating tables on startup (dev only).")
        from app.database import Base, engine
        from app import models  # noqa: F401  (register all models)

        Base.metadata.create_all(bind=engine)
    else:
        logger.info("AUTO_CREATE_TABLES=false: run `alembic upgrade head` to migrate the database.")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Voxora — Enterprise AI Voice Calling Platform",
        version=settings.APP_VERSION,
        description="Backend API for the Voxora AI voice calling platform.",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(RateLimitMiddleware)

    # ---- exception handlers: always JSON {detail} ----
    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=422, content={"detail": exc.errors()})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # ---- health (both /health and /api/v1/health) ----
    @app.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok", "version": settings.APP_VERSION}

    @app.get("/api/v1/health", tags=["health"])
    def health_v1() -> dict:
        return {"status": "ok", "version": settings.APP_VERSION}

    # ---- API v1 routers ----
    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(businesses.router, prefix="/api/v1")
    app.include_router(agents.router, prefix="/api/v1")
    app.include_router(model_config.router, prefix="/api/v1")
    app.include_router(questionnaires.router, prefix="/api/v1")
    app.include_router(contacts.router, prefix="/api/v1")
    app.include_router(campaigns.router, prefix="/api/v1")
    app.include_router(calls.router, prefix="/api/v1")
    app.include_router(leads.router, prefix="/api/v1")
    app.include_router(followups.router, prefix="/api/v1")
    app.include_router(telephony.router, prefix="/api/v1")
    app.include_router(analytics.router, prefix="/api/v1")
    app.include_router(usage.router, prefix="/api/v1")
    app.include_router(dograh.router, prefix="/api/v1")
    app.include_router(websocket.router, prefix="/api/v1")

    return app


app = create_app()
