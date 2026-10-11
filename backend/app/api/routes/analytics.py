"""Analytics: real queries only — zeros/empty arrays when there is no data."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user
from app.services import analytics as analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
def overview(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return analytics_service.overview(db, user.tenant_id, get_settings().COST_PER_MIN)


@router.get("/calls-over-time")
def calls_over_time(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
) -> dict:
    return {"days": days, "series": analytics_service.calls_over_time(db, user.tenant_id, days)}


@router.get("/outcomes")
def outcomes(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"outcomes": analytics_service.outcomes(db, user.tenant_id)}


@router.get("/durations")
def durations(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"buckets": analytics_service.durations(db, user.tenant_id)}


@router.get("/agents")
def agents(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"agents": analytics_service.per_agent(db, user.tenant_id)}


@router.get("/campaigns")
def campaigns(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"campaigns": analytics_service.per_campaign(db, user.tenant_id)}


@router.get("/lead-funnel")
def lead_funnel(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"funnel": analytics_service.lead_funnel(db, user.tenant_id)}


@router.get("/usage")
def usage(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"usage": analytics_service.usage_summary(db, user.tenant_id)}
