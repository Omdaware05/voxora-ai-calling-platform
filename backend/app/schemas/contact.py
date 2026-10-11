"""Contact schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ContactCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=64)
    email: Optional[str] = None
    status: str = "active"
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    agent_id: Optional[int] = None
    lead_status: Optional[str] = None
    do_not_call: bool = False


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=64)
    email: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    agent_id: Optional[int] = None
    lead_status: Optional[str] = None
    do_not_call: Optional[bool] = None


class ContactRead(ORMModel):
    id: int
    tenant_id: int
    name: str
    phone: str
    email: Optional[str] = None
    status: str
    tags: Optional[List[str]] = None
    custom_fields: Optional[Dict[str, Any]] = None
    agent_id: Optional[int] = None
    lead_status: Optional[str] = None
    do_not_call: bool
    last_call_at: Optional[datetime] = None
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class BulkDeleteRequest(BaseModel):
    ids: List[int] = Field(min_length=1)


class DoNotCallRequest(BaseModel):
    do_not_call: bool
