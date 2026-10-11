"""Follow-ups: CRUD + complete/cancel/reschedule."""
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
from app.schemas.crm import (
    FollowupCreate,
    FollowupRead,
    FollowupReschedule,
    FollowupUpdate,
)

router = APIRouter(prefix="/followups", tags=["followups"])


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Followup).filter(models.Followup.tenant_id == tenant_id)


def _get_or_404(db: Session, tenant_id: int, followup_id: int) -> models.Followup:
    fu = _scoped(db, tenant_id).filter(models.Followup.id == followup_id).first()
    if not fu:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")
    return fu


@router.get("", response_model=PaginatedResponse[FollowupRead])
def list_followups(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    status_: Annotated[str | None, Query(alias="status")] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if status_:
        q = q.filter(models.Followup.status == status_)
    total = q.count()
    items = q.order_by(models.Followup.scheduled_at).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([FollowupRead.model_validate(f) for f in items], total, pagination)


@router.post("", response_model=FollowupRead, status_code=status.HTTP_201_CREATED)
def create_followup(
    payload: FollowupCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> FollowupRead:
    contact = (
        db.query(models.Contact)
        .filter(models.Contact.id == payload.contact_id, models.Contact.tenant_id == user.tenant_id)
        .first()
    )
    if not contact:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact not found in tenant")
    fu = models.Followup(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(fu)
    db.commit()
    db.refresh(fu)
    return FollowupRead.model_validate(fu)


@router.get("/{followup_id}", response_model=FollowupRead)
def get_followup(
    followup_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> FollowupRead:
    return FollowupRead.model_validate(_get_or_404(db, user.tenant_id, followup_id))


@router.put("/{followup_id}", response_model=FollowupRead)
def update_followup(
    followup_id: int,
    payload: FollowupUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> FollowupRead:
    fu = _get_or_404(db, user.tenant_id, followup_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(fu, key, value)
    db.commit()
    db.refresh(fu)
    return FollowupRead.model_validate(fu)


@router.delete("/{followup_id}")
def delete_followup(
    followup_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
):
    fu = _get_or_404(db, user.tenant_id, followup_id)
    db.delete(fu)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _set_status(db: Session, tenant_id: int, followup_id: int, new_status: str) -> FollowupRead:
    fu = _get_or_404(db, tenant_id, followup_id)
    if fu.status in ("COMPLETED", "CANCELLED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Follow-up already {fu.status.lower()}"
        )
    fu.status = new_status
    db.commit()
    db.refresh(fu)
    return FollowupRead.model_validate(fu)


@router.post("/{followup_id}/complete", response_model=FollowupRead)
def complete_followup(
    followup_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> FollowupRead:
    return _set_status(db, user.tenant_id, followup_id, "COMPLETED")


@router.post("/{followup_id}/cancel", response_model=FollowupRead)
def cancel_followup(
    followup_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> FollowupRead:
    return _set_status(db, user.tenant_id, followup_id, "CANCELLED")


@router.post("/{followup_id}/reschedule", response_model=FollowupRead)
def reschedule_followup(
    followup_id: int,
    payload: FollowupReschedule,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> FollowupRead:
    fu = _get_or_404(db, user.tenant_id, followup_id)
    fu.scheduled_at = payload.scheduled_at
    if fu.status == "CANCELLED":
        fu.status = "SCHEDULED"
    db.commit()
    db.refresh(fu)
    return FollowupRead.model_validate(fu)
