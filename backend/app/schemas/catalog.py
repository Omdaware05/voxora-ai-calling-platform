"""Business / agent / model-config schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

# ------------------------------------------------------------------ Business
class BusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    industry: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class BusinessUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    industry: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None


class BusinessRead(ORMModel):
    id: int
    tenant_id: int
    name: str
    industry: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    extra: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ------------------------------------------------------------------ Agent
class AgentBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    purpose: Optional[str] = None
    business_id: Optional[int] = None
    language: str = "en"
    supported_languages: Optional[List[str]] = None
    tone: Optional[str] = None
    personality: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting: Optional[str] = None
    closing_behavior: Optional[str] = None
    safety_rules: Optional[str] = None
    voice: Optional[Dict[str, Any]] = None
    stt: Optional[Dict[str, Any]] = None
    llm: Optional[Dict[str, Any]] = None
    tts: Optional[Dict[str, Any]] = None
    concurrency: int = Field(default=5, ge=1, le=100)
    questionnaire_id: Optional[int] = None
    advanced_config: Optional[Dict[str, Any]] = None
    status: str = Field(default="active", pattern="^(active|disabled)$")


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    purpose: Optional[str] = None
    business_id: Optional[int] = None
    language: Optional[str] = None
    supported_languages: Optional[List[str]] = None
    tone: Optional[str] = None
    personality: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting: Optional[str] = None
    closing_behavior: Optional[str] = None
    safety_rules: Optional[str] = None
    voice: Optional[Dict[str, Any]] = None
    stt: Optional[Dict[str, Any]] = None
    llm: Optional[Dict[str, Any]] = None
    tts: Optional[Dict[str, Any]] = None
    concurrency: Optional[int] = Field(default=None, ge=1, le=100)
    questionnaire_id: Optional[int] = None
    advanced_config: Optional[Dict[str, Any]] = None
    status: Optional[str] = Field(default=None, pattern="^(active|disabled)$")


class AgentRead(ORMModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    purpose: Optional[str] = None
    business_id: Optional[int] = None
    language: str
    supported_languages: Optional[List[str]] = None
    tone: Optional[str] = None
    personality: Optional[str] = None
    system_prompt: Optional[str] = None
    greeting: Optional[str] = None
    closing_behavior: Optional[str] = None
    safety_rules: Optional[str] = None
    voice: Optional[Dict[str, Any]] = None
    stt: Optional[Dict[str, Any]] = None
    llm: Optional[Dict[str, Any]] = None
    tts: Optional[Dict[str, Any]] = None
    concurrency: int
    questionnaire_id: Optional[int] = None
    advanced_config: Optional[Dict[str, Any]] = None
    status: str
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AgentVersionRead(ORMModel):
    id: int
    agent_id: int
    version: int
    snapshot: Dict[str, Any]
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None


class AgentWorkspace(BaseModel):
    agent: AgentRead
    active_calls: int
    calls_today: int
    recent_calls: List[Dict[str, Any]]


# ------------------------------------------------------------------ Model config
VALID_MODEL_TYPES = ("stt", "llm", "tts")


class ModelConfigUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = Field(default=None, description="Write-only; never returned")
    language: Optional[str] = None
    voice: Optional[str] = None
    speed: Optional[float] = Field(default=None, gt=0, le=4)
    temperature: Optional[float] = Field(default=None, ge=0, le=2)
    max_tokens: Optional[int] = Field(default=None, ge=1, le=32000)
    extra: Optional[Dict[str, Any]] = None


class ModelConfigRead(BaseModel):
    type: str
    provider: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None
    has_api_key: bool = False
    language: Optional[str] = None
    voice: Optional[str] = None
    speed: float = 1.0
    temperature: float = 0.7
    max_tokens: int = 512
    extra: Optional[Dict[str, Any]] = None
