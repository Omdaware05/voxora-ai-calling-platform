"""Agents: CRUD + duplicate/toggle/workspace/versions with config snapshots."""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import (
    get_current_user,
    get_pagination,
    paginated_response,
    require_member_or_admin,
)
from app.schemas.catalog import (
    AgentCreate,
    AgentRead,
    AgentUpdate,
    AgentVersionRead,
    AgentWorkspace,
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/agents", tags=["agents"])


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Agent).filter(models.Agent.tenant_id == tenant_id)


def _snapshot(agent: models.Agent) -> dict:
    """Serializable snapshot of the agent's config for versioning."""
    return {
        "name": agent.name,
        "description": agent.description,
        "purpose": agent.purpose,
        "business_id": agent.business_id,
        "language": agent.language,
        "supported_languages": agent.supported_languages,
        "tone": agent.tone,
        "personality": agent.personality,
        "system_prompt": agent.system_prompt,
        "greeting": agent.greeting,
        "closing_behavior": agent.closing_behavior,
        "safety_rules": agent.safety_rules,
        "voice": agent.voice,
        "stt": agent.stt,
        "llm": agent.llm,
        "tts": agent.tts,
        "concurrency": agent.concurrency,
        "questionnaire_id": agent.questionnaire_id,
        "advanced_config": agent.advanced_config,
        "status": agent.status,
    }


def _get_or_404(db: Session, tenant_id: int, agent_id: int) -> models.Agent:
    agent = _scoped(db, tenant_id).filter(models.Agent.id == agent_id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    return agent


@router.get("", response_model=PaginatedResponse[AgentRead])
def list_agents(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    business_id: Annotated[int | None, Query()] = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
    search: Annotated[str | None, Query()] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if business_id is not None:
        q = q.filter(models.Agent.business_id == business_id)
    if status_:
        q = q.filter(models.Agent.status == status_)
    if search:
        q = q.filter(models.Agent.name.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.Agent.id).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([AgentRead.model_validate(a) for a in items], total, pagination)


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def create_agent(
    payload: AgentCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> AgentRead:
    data = payload.model_dump()
    if data.get("business_id") is not None:
        biz = (
            db.query(models.Business)
            .filter(models.Business.id == data["business_id"], models.Business.tenant_id == user.tenant_id)
            .first()
        )
        if not biz:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Business not found in tenant")
    agent = models.Agent(tenant_id=user.tenant_id, **data)
    db.add(agent)
    db.commit()
    db.refresh(agent)
    return AgentRead.model_validate(agent)


@router.get("/{agent_id}", response_model=AgentRead)
def get_agent(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> AgentRead:
    return AgentRead.model_validate(_get_or_404(db, user.tenant_id, agent_id))


@router.put("/{agent_id}", response_model=AgentRead)
def update_agent(
    agent_id: int,
    payload: AgentUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> AgentRead:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    # Snapshot prior config before mutating
    latest = (
        db.query(func.coalesce(func.max(models.AgentVersion.version), 0))
        .filter(models.AgentVersion.agent_id == agent.id)
        .scalar()
    ) or 0
    db.add(
        models.AgentVersion(
            agent_id=agent.id, version=latest + 1, snapshot=_snapshot(agent), created_by=user.id
        )
    )
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    db.commit()
    db.refresh(agent)
    return AgentRead.model_validate(agent)


@router.delete("/{agent_id}")
def delete_agent(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> None:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    db.delete(agent)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{agent_id}/duplicate", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
def duplicate_agent(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> AgentRead:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    data = _snapshot(agent)
    data["name"] = f"{agent.name} (copy)"
    data.pop("status", None)
    copy = models.Agent(tenant_id=user.tenant_id, status="active", **data)
    db.add(copy)
    db.commit()
    db.refresh(copy)
    return AgentRead.model_validate(copy)


@router.post("/{agent_id}/toggle", response_model=AgentRead)
def toggle_agent(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> AgentRead:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    agent.status = "disabled" if agent.status == "active" else "active"
    db.commit()
    db.refresh(agent)
    return AgentRead.model_validate(agent)


@router.get("/{agent_id}/workspace", response_model=AgentWorkspace)
def agent_workspace(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> AgentWorkspace:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    active_statuses = ["INITIATING", "RINGING", "IN_PROGRESS"]
    active_calls = (
        db.query(func.count())
        .select_from(models.Call)
        .filter(models.Call.agent_id == agent.id, models.Call.status.in_(active_statuses))
        .scalar()
    ) or 0
    today_start = datetime(date.today().year, date.today().month, date.today().day)
    calls_today = (
        db.query(func.count())
        .select_from(models.Call)
        .filter(models.Call.agent_id == agent.id, models.Call.created_at >= today_start)
        .scalar()
    ) or 0
    recent = (
        db.query(models.Call)
        .filter(models.Call.agent_id == agent.id)
        .order_by(models.Call.created_at.desc())
        .limit(10)
        .all()
    )
    recent_calls = [
        {
            "id": c.id,
            "phone": c.phone,
            "status": c.status,
            "direction": c.direction,
            "duration_sec": c.duration_sec,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in recent
    ]
    return AgentWorkspace(
        agent=AgentRead.model_validate(agent),
        active_calls=active_calls,
        calls_today=calls_today,
        recent_calls=recent_calls,
    )


@router.get("/{agent_id}/versions", response_model=list[AgentVersionRead])
def list_versions(
    agent_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[AgentVersionRead]:
    _get_or_404(db, user.tenant_id, agent_id)
    versions = (
        db.query(models.AgentVersion)
        .filter(models.AgentVersion.agent_id == agent_id)
        .order_by(models.AgentVersion.version.desc())
        .all()
    )
    return [AgentVersionRead.model_validate(v) for v in versions]


@router.post("/{agent_id}/versions/{version_id}/restore", response_model=AgentRead)
def restore_version(
    agent_id: int,
    version_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> AgentRead:
    agent = _get_or_404(db, user.tenant_id, agent_id)
    version = (
        db.query(models.AgentVersion)
        .filter(models.AgentVersion.id == version_id, models.AgentVersion.agent_id == agent_id)
        .first()
    )
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    # Snapshot current config before restoring
    latest = (
        db.query(func.coalesce(func.max(models.AgentVersion.version), 0))
        .filter(models.AgentVersion.agent_id == agent.id)
        .scalar()
    ) or 0
    db.add(
        models.AgentVersion(
            agent_id=agent.id, version=latest + 1, snapshot=_snapshot(agent), created_by=user.id
        )
    )
    for key, value in version.snapshot.items():
        if hasattr(agent, key):
            setattr(agent, key, value)
    db.commit()
    db.refresh(agent)
    return AgentRead.model_validate(agent)
