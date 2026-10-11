"""Authentication routes: login / logout / me."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import get_current_user
from app.schemas.auth import LoginRequest, LoginResponse, UserPublic
from app.schemas.common import OkResponse
from app.security import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> LoginResponse:
    user = db.query(models.User).filter(models.User.email == payload.email.lower()).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    token = create_access_token(subject=str(user.id))
    tenant_name = user.tenant.name if user.tenant else None
    return LoginResponse(
        access_token=token,
        user=UserPublic(
            id=user.id,
            email=user.email,
            name=user.name,
            role=user.role,
            tenant_id=user.tenant_id,
            tenant_name=tenant_name,
            is_active=user.is_active,
            avatar_url=user.avatar_url,
            created_at=user.created_at,
        ),
    )


@router.post("/logout", response_model=OkResponse)
def logout() -> OkResponse:
    # Stateless JWT: logout is client-side token discard.
    return OkResponse(ok=True)


@router.get("/me", response_model=UserPublic)
def me(user: Annotated[models.User, Depends(get_current_user)]) -> UserPublic:
    tenant_name = user.tenant.name if user.tenant else None
    return UserPublic(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        tenant_id=user.tenant_id,
        tenant_name=tenant_name,
        is_active=user.is_active,
        avatar_url=user.avatar_url,
        created_at=user.created_at,
    )
