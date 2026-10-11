"""Lead / followup / telephony schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

# ------------------------------------------------------------------ Lead
class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    phone: str = Field(min_length=3, max_length=64)
    email: Optional[str] = None
    score: float = Field(default=0.0, ge=0, le=100)
    status: str = Field(default="NEW", pattern="^(NEW|INTERESTED|NOT_INTERESTED|QUALIFIED|CLOSED)$")
    reason: Optional[str] = None
    agent_id: Optional[int] = None
    campaign_id: Optional[int] = None
    call_id: Optional[str] = None
    contact_id: Optional[int] = None


class LeadUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=64)
    email: Optional[str] = None
    score: Optional[float] = Field(default=None, ge=0, le=100)
    status: Optional[str] = Field(default=None, pattern="^(NEW|INTERESTED|NOT_INTERESTED|QUALIFIED|CLOSED)$")
    reason: Optional[str] = None
    agent_id: Optional[int] = None
    campaign_id: Optional[int] = None
    call_id: Optional[str] = None
    contact_id: Optional[int] = None


class LeadRead(ORMModel):
    id: int
    tenant_id: int
    name: str
    phone: str
    email: Optional[str] = None
    score: float
    status: str
    reason: Optional[str] = None
    agent_id: Optional[int] = None
    campaign_id: Optional[int] = None
    call_id: Optional[str] = None
    contact_id: Optional[int] = None
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ------------------------------------------------------------------ Followup
class FollowupCreate(BaseModel):
    contact_id: int
    agent_id: Optional[int] = None
    call_id: Optional[str] = None
    scheduled_at: datetime
    notes: Optional[str] = None
    status: str = Field(default="PENDING", pattern="^(PENDING|SCHEDULED|COMPLETED|CANCELLED)$")


class FollowupUpdate(BaseModel):
    contact_id: Optional[int] = None
    agent_id: Optional[int] = None
    call_id: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(default=None, pattern="^(PENDING|SCHEDULED|COMPLETED|CANCELLED)$")


class FollowupReschedule(BaseModel):
    scheduled_at: datetime


class FollowupRead(ORMModel):
    id: int
    tenant_id: int
    contact_id: int
    agent_id: Optional[int] = None
    call_id: Optional[str] = None
    scheduled_at: datetime
    notes: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ------------------------------------------------------------------ Telephony
class TelephonyConfigPublic(BaseModel):
    id: int
    provider: str
    from_number: Optional[str] = None
    is_default: bool
    status: str
    has_credentials: bool
    created_at: Optional[datetime] = None


class TelephonyOverview(BaseModel):
    configs: list[TelephonyConfigPublic]
    default_provider: Optional[str] = None


class VobizConfigUpdate(BaseModel):
    auth_id: Optional[str] = None
    auth_token: Optional[str] = Field(default=None, description="Write-only; never returned")
    from_number: Optional[str] = None


class SetDefaultProvider(BaseModel):
    provider: str = Field(pattern="^(vobiz|twilio|plivo)$")
