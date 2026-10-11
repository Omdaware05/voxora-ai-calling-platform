"""Businesses: CRUD + agents of a business."""
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
from app.schemas.catalog import AgentRead, BusinessCreate, BusinessRead, BusinessUpdate
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/businesses", tags=["businesses"])


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Business).filter(models.Business.tenant_id == tenant_id)


@router.get("", response_model=PaginatedResponse[BusinessRead])
def list_businesses(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    search: Annotated[str | None, Query()] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if search:
        q = q.filter(models.Business.name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.Business.id).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([BusinessRead.model_validate(b) for b in items], total, pagination)


@router.post("", response_model=BusinessRead, status_code=status.HTTP_201_CREATED)
def create_business(
    payload: BusinessCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> BusinessRead:
    business = models.Business(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(business)
    db.commit()
    db.refresh(business)
    return BusinessRead.model_validate(business)


@router.get("/{business_id}", response_model=BusinessRead)
def get_business(
    business_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> BusinessRead:
    business = _scoped(db, user.tenant_id).filter(models.Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    return BusinessRead.model_validate(business)


@router.put("/{business_id}", response_model=BusinessRead)
def update_business(
    business_id: int,
    payload: BusinessUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> BusinessRead:
    business = _scoped(db, user.tenant_id).filter(models.Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(business, key, value)
    db.commit()
    db.refresh(business)
    return BusinessRead.model_validate(business)


@router.delete("/{business_id}")
def delete_business(
    business_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> None:
    business = _scoped(db, user.tenant_id).filter(models.Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    db.delete(business)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{business_id}/agents", response_model=PaginatedResponse[AgentRead])
def business_agents(
    business_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
) -> dict:
    business = _scoped(db, user.tenant_id).filter(models.Business.id == business_id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")
    q = (
        db.query(models.Agent)
        .filter(models.Agent.tenant_id == user.tenant_id, models.Agent.business_id == business_id)
        .order_by(models.Agent.id)
    )
    total = q.count()
    items = q.offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([AgentRead.model_validate(a) for a in items], total, pagination)
