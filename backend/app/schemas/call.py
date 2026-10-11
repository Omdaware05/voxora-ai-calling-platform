"""Call / transcript / recording schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class CallCreate(BaseModel):
    agent_id: int
    contact_id: Optional[int] = None
    phone: Optional[str] = None
    campaign_id: Optional[int] = None


class CallRead(ORMModel):
    id: str
    tenant_id: int
    agent_id: int
    contact_id: Optional[int] = None
    campaign_id: Optional[int] = None
    phone: str
    direction: str
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_sec: Optional[int] = None
    disposition: Optional[str] = None
    termination_reason: Optional[str] = None
    dograh_run_id: Optional[str] = None
    recording_key: Optional[str] = None
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CallEventRead(ORMModel):
    id: int
    call_id: str
    type: str
    payload: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None


class TranscriptSegmentRead(ORMModel):
    id: int
    call_id: str
    speaker: str
    text: str
    offset_sec: float
    created_at: Optional[datetime] = None


class TranscriptRead(BaseModel):
    call_id: str
    segments: List[TranscriptSegmentRead]
    full_text: Optional[str] = None
    summary: Optional[str] = None
    language: Optional[str] = None


class DemoEventRequest(BaseModel):
    speaker: str = Field(pattern="^(ai|customer|system)$")
    text: str = Field(min_length=1)
