"""Auth + user schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel

VALID_ROLES = ("ADMIN", "MEMBER", "VIEWER")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserPublic(ORMModel):
    id: int
    email: str
    name: str
    role: str
    tenant_id: int
    tenant_name: Optional[str] = None
    is_active: bool = True
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: str = Field(default="MEMBER", pattern="^(ADMIN|MEMBER|VIEWER)$")
    is_active: bool = True
    avatar_url: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    role: Optional[str] = Field(default=None, pattern="^(ADMIN|MEMBER|VIEWER)$")
    is_active: Optional[bool] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
