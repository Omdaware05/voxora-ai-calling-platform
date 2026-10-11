"""Leads: CRUD (PATCH supported)."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import (
    get_current_user,
    get_pagination,
    paginated_response,
    require_member_or_admin,
)
from app.schemas.common import PaginatedResponse
from app.schemas.crm import LeadCreate, LeadRead, LeadUpdate

router = APIRouter(prefix="/leads", tags=["leads"])


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Lead).filter(models.Lead.tenant_id == tenant_id)


def _get_or_404(db: Session, tenant_id: int, lead_id: int) -> models.Lead:
    lead = _scoped(db, tenant_id).filter(models.Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("", response_model=PaginatedResponse[LeadRead])
def list_leads(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    status_: Annotated[str | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query()] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if status_:
        q = q.filter(models.Lead.status == status_)
    if search:
        like = f"%{search}%"
        q = q.filter((models.Lead.name.ilike(like)) | (models.Lead.phone.ilike(like)))
    total = q.count()
    items = q.order_by(models.Lead.id.desc()).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([LeadRead.model_validate(l) for l in items], total, pagination)


@router.post("", response_model=LeadRead, status_code=status.HTTP_201_CREATED)
def create_lead(
    payload: LeadCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> LeadRead:
    lead = models.Lead(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return LeadRead.model_validate(lead)


@router.get("/{lead_id}", response_model=LeadRead)
def get_lead(
    lead_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> LeadRead:
    return LeadRead.model_validate(_get_or_404(db, user.tenant_id, lead_id))


@router.patch("/{lead_id}", response_model=LeadRead)
def patch_lead(
    lead_id: int,
    payload: LeadUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> LeadRead:
    lead = _get_or_404(db, user.tenant_id, lead_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(lead, key, value)
    db.commit()
    db.refresh(lead)
    return LeadRead.model_validate(lead)


@router.delete("/{lead_id}")
def delete_lead(
    lead_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
):
    lead = _get_or_404(db, user.tenant_id, lead_id)
    db.delete(lead)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
