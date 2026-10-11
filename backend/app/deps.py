"""Shared FastAPI dependencies: JWT auth, RBAC, tenant scoping, pagination."""
from __future__ import annotations

from typing import Annotated, Callable

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    db: Annotated[Session, Depends(get_db)],
) -> models.User:
    """Decode the JWT bearer token and load the user. Never trust client-supplied tenant_id."""
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    user = db.get(models.User, int(user_id))
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_roles(*roles: str) -> Callable[[models.User], models.User]:
    """Dependency factory enforcing that the current user has one of the given roles."""

    def _check(user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role(s): {', '.join(roles)}",
            )
        return user

    return _check


def require_admin(user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
    if user.role != "ADMIN":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_member_or_admin(user: Annotated[models.User, Depends(get_current_user)]) -> models.User:
    """MEMBER and ADMIN can write business data; VIEWER is read-only (403 on writes)."""
    if user.role not in ("ADMIN", "MEMBER"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Write access denied for VIEWER role")
    return user


def tenant_id(user: Annotated[models.User, Depends(get_current_user)]) -> int:
    """Tenant id always comes from the authenticated user, never from the request."""
    return user.tenant_id


class Pagination:
    def __init__(self, page: int = 1, page_size: int = 20) -> None:
        self.page = max(page, 1)
        self.page_size = min(max(page_size, 1), 200)

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


def get_pagination(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=200)] = 20,
) -> Pagination:
    return Pagination(page=page, page_size=page_size)


def paginated_response(items: list, total: int, pagination: Pagination) -> dict:
    return {
        "items": items,
        "total": total,
        "page": pagination.page,
        "page_size": pagination.page_size,
    }
