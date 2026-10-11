"""Top-level /usage endpoint (usage summary for the tenant)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import get_current_user
from app.services import analytics as analytics_service

router = APIRouter(tags=["usage"])


@router.get("/usage")
def usage(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return {"usage": analytics_service.usage_summary(db, user.tenant_id)}
