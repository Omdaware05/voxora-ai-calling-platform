"""User management (ADMIN only for writes)."""
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
    require_admin,
)
from app.schemas.auth import UserCreate, UserPublic, UserUpdate
from app.schemas.common import PaginatedResponse
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


def _to_public(user: models.User) -> UserPublic:
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=user.tenant.name if user.tenant else None,
        is_active=user.is_active,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )


@router.get("", response_model=PaginatedResponse[UserPublic])
def list_users(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
) -> dict:
    q = db.query(models.User).filter(models.User.tenant_id == user.tenant_id)
    total = q.count()
    items = q.order_by(models.User.id).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([_to_public(u) for u in items], total, pagination)


@router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[models.User, Depends(require_admin)],
    current: Annotated[models.User, Depends(get_current_user)],
) -> UserPublic:
    existing = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = models.User(
        tenant_id=current.tenant_id,
        email=payload.email.lower(),
        name=payload.name,
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=payload.is_active,
        avatar_url=payload.avatar_url,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_public(user)


@router.get("/{user_id}", response_model=UserPublic)
def get_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> UserPublic:
    target = (
        db.query(models.User)
        .filter(models.User.id == user_id, models.User.tenant_id == user.tenant_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return _to_public(target)


@router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[models.User, Depends(require_admin)],
    current: Annotated[models.User, Depends(get_current_user)],
) -> UserPublic:
    target = (
        db.query(models.User)
        .filter(models.User.id == user_id, models.User.tenant_id == current.tenant_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    for key, value in data.items():
        setattr(target, key, value)
    if password:
        target.password_hash = hash_password(password)
    db.commit()
    db.refresh(target)
    return _to_public(target)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    _admin: Annotated[models.User, Depends(require_admin)],
    current: Annotated[models.User, Depends(get_current_user)],
):
    target = (
        db.query(models.User)
        .filter(models.User.id == user_id, models.User.tenant_id == current.tenant_id)
        .first()
    )
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if target.id == current.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete your own account")
    db.delete(target)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
