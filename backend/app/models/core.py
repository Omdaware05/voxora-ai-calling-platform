"""All SQLAlchemy models for Voxora (SQLAlchemy 2.x typed mappings)."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now()


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class DemoMixin:
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class Tenant(TimestampMixin, DemoMixin, Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    timezone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, default="Asia/Kolkata")
    languages: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)

    users: Mapped[List["User"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")
    agents: Mapped[List["Agent"]] = relationship(back_populates="tenant", cascade="all, delete-orphan")


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(16), default="MEMBER", nullable=False)  # ADMIN|MEMBER|VIEWER
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)

    tenant: Mapped["Tenant"] = relationship(back_populates="users")


class Business(TimestampMixin, Base):
    """A business unit / brand inside a tenant that owns voice agents."""

    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    tenant: Mapped["Tenant"] = relationship()
    agents: Mapped[List["Agent"]] = relationship(back_populates="business")


class Agent(TimestampMixin, DemoMixin, Base):
    __tablename__ = "agents"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    purpose: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    business_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("businesses.id", ondelete="SET NULL"), nullable=True, index=True
    )
    language: Mapped[str] = mapped_column(String(16), default="en", nullable=False)
    supported_languages: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    tone: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    personality: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    greeting: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    closing_behavior: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    safety_rules: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    voice: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    stt: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    llm: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    tts: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    concurrency: Mapped[int] = mapped_column(Integer, default=5, nullable=False)
    questionnaire_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("questionnaires.id", ondelete="SET NULL"), nullable=True
    )
    advanced_config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="active", nullable=False)  # active|disabled

    tenant: Mapped["Tenant"] = relationship(back_populates="agents")
    business: Mapped[Optional["Business"]] = relationship(back_populates="agents")
    versions: Mapped[List["AgentVersion"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan", order_by="AgentVersion.version.desc()"
    )


class AgentVersion(Base):
    __tablename__ = "agent_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_by: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    agent: Mapped["Agent"] = relationship(back_populates="versions")

    __table_args__ = (UniqueConstraint("agent_id", "version", name="uq_agent_version"),)


class Questionnaire(TimestampMixin, DemoMixin, Base):
    __tablename__ = "questionnaires"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="draft", nullable=False)  # draft|published|archived
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    questions: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)

    versions: Mapped[List["QuestionnaireVersion"]] = relationship(
        back_populates="questionnaire", cascade="all, delete-orphan"
    )


class QuestionnaireVersion(Base):
    __tablename__ = "questionnaire_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    questionnaire_id: Mapped[int] = mapped_column(
        ForeignKey("questionnaires.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    questionnaire: Mapped["Questionnaire"] = relationship(back_populates="versions")


class Contact(TimestampMixin, DemoMixin, Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    custom_fields: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    lead_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    do_not_call: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    last_call_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (Index("ix_contacts_tenant_phone", "tenant_id", "phone"),)


class Campaign(TimestampMixin, DemoMixin, Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="RESTRICT"), nullable=False)
    questionnaire_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("questionnaires.id", ondelete="SET NULL"), nullable=True
    )
    concurrency: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    caller_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    schedule: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="CREATED", nullable=False)
    # CREATED|RUNNING|PAUSED|STOPPED|COMPLETED|FAILED

    contacts: Mapped[List["CampaignContact"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan"
    )


class CampaignContact(Base):
    __tablename__ = "campaign_contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        ForeignKey("campaigns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    contact_id: Mapped[int] = mapped_column(
        ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(32), default="PENDING", nullable=False)
    attempted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="contacts")
    contact: Mapped["Contact"] = relationship()

    __table_args__ = (UniqueConstraint("campaign_id", "contact_id", name="uq_campaign_contact"),)


class Call(TimestampMixin, DemoMixin, Base):
    __tablename__ = "calls"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id", ondelete="RESTRICT"), nullable=False, index=True)
    contact_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True, index=True
    )
    campaign_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True, index=True
    )
    phone: Mapped[str] = mapped_column(String(64), nullable=False)
    direction: Mapped[str] = mapped_column(String(16), default="outbound", nullable=False)  # outbound|inbound
    status: Mapped[str] = mapped_column(String(16), default="INITIATING", nullable=False)
    # INITIATING|RINGING|IN_PROGRESS|COMPLETED|BUSY|NO_ANSWER|FAILED
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_sec: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    disposition: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    termination_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    dograh_run_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    recording_key: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)

    agent: Mapped["Agent"] = relationship()
    contact: Mapped[Optional["Contact"]] = relationship()
    events: Mapped[List["CallEvent"]] = relationship(back_populates="call", cascade="all, delete-orphan")
    segments: Mapped[List["TranscriptSegment"]] = relationship(back_populates="call", cascade="all, delete-orphan")


class CallEvent(Base):
    __tablename__ = "call_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    call: Mapped["Call"] = relationship(back_populates="events")


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    full_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class TranscriptSegment(Base):
    __tablename__ = "transcript_segments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)  # ai|customer|system
    text: Mapped[str] = mapped_column(Text, nullable=False)
    offset_sec: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    call: Mapped["Call"] = relationship(back_populates="segments")


class Recording(Base):
    __tablename__ = "recordings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    duration_sec: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    mime: Mapped[str] = mapped_column(String(128), default="audio/wav", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Lead(TimestampMixin, DemoMixin, Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="NEW", nullable=False)
    # NEW|INTERESTED|NOT_INTERESTED|QUALIFIED|CLOSED
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    campaign_id: Mapped[Optional[int]] = mapped_column(ForeignKey("campaigns.id", ondelete="SET NULL"), nullable=True)
    call_id: Mapped[Optional[str]] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"), nullable=True)
    contact_id: Mapped[Optional[int]] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)


class Followup(TimestampMixin, Base):
    __tablename__ = "followups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_id: Mapped[Optional[int]] = mapped_column(ForeignKey("agents.id", ondelete="SET NULL"), nullable=True)
    call_id: Mapped[Optional[str]] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"), nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(16), default="PENDING", nullable=False)
    # PENDING|SCHEDULED|COMPLETED|CANCELLED

    contact: Mapped["Contact"] = relationship()


class TelephonyConfig(TimestampMixin, Base):
    __tablename__ = "telephony_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(32), nullable=False)  # vobiz|twilio|plivo
    auth_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    auth_token_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    from_number: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="not_configured", nullable=False)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    __table_args__ = (UniqueConstraint("tenant_id", "provider", name="uq_telephony_tenant_provider"),)


class ModelConfig(TimestampMixin, Base):
    __tablename__ = "model_configs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)  # stt|llm|tts
    provider: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    base_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    api_key_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    voice: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    speed: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    temperature: Mapped[float] = mapped_column(Float, default=0.7, nullable=False)
    max_tokens: Mapped[int] = mapped_column(Integer, default=512, nullable=False)
    extra: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    __table_args__ = (UniqueConstraint("tenant_id", "type", name="uq_modelconfig_tenant_type"),)


class UsageEvent(Base):
    __tablename__ = "usage_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    call_id: Mapped[Optional[str]] = mapped_column(ForeignKey("calls.id", ondelete="SET NULL"), nullable=True, index=True)
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # stt|llm|tts|call
    units: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="minutes", nullable=False)
    cost_estimate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
