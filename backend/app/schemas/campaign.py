"""Campaign schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

VALID_CAMPAIGN_STATUSES = ("CREATED", "RUNNING", "PAUSED", "STOPPED", "COMPLETED", "FAILED")


class CampaignCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    agent_id: int
    questionnaire_id: Optional[int] = None
    concurrency: int = Field(default=3, ge=1, le=50)
    caller_id: Optional[str] = None
    schedule: Optional[Dict[str, Any]] = None


class CampaignUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    agent_id: Optional[int] = None
    questionnaire_id: Optional[int] = None
    concurrency: Optional[int] = Field(default=None, ge=1, le=50)
    caller_id: Optional[str] = None
    schedule: Optional[Dict[str, Any]] = None


class CampaignRead(ORMModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    agent_id: int
    questionnaire_id: Optional[int] = None
    concurrency: int
    caller_id: Optional[str] = None
    schedule: Optional[Dict[str, Any]] = None
    status: str
    contact_count: int = 0
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CampaignContactsAdd(BaseModel):
    contact_ids: List[int] = Field(min_length=1)


class CampaignStats(BaseModel):
    total: int = 0
    attempted: int = 0
    answered: int = 0
    completed: int = 0
    failed: int = 0
    busy: int = 0
    no_answer: int = 0
    interested: int = 0
    qualified: int = 0
    avg_duration_sec: float = 0.0
