"""Campaigns: CRUD, lifecycle (start/pause/resume/stop), contacts, stats."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.schemas.campaign import (
    VALID_CAMPAIGN_STATUSES,
    CampaignContactsAdd,
    CampaignCreate,
    CampaignRead,
    CampaignStats,
    CampaignUpdate,
)
from app.schemas.common import PaginatedResponse

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

# Allowed status transitions for lifecycle actions
TRANSITIONS = {
    "start": {"from": ("CREATED", "PAUSED", "STOPPED"), "to": "RUNNING"},
    "pause": {"from": ("RUNNING",), "to": "PAUSED"},
    "resume": {"from": ("PAUSED",), "to": "RUNNING"},
    "stop": {"from": ("RUNNING", "PAUSED"), "to": "STOPPED"},
}


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Campaign).filter(models.Campaign.tenant_id == tenant_id)


def _get_or_404(db: Session, tenant_id: int, campaign_id: int) -> models.Campaign:
    campaign = _scoped(db, tenant_id).filter(models.Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


def _to_read(campaign: models.Campaign) -> CampaignRead:
    return CampaignRead(
        id=campaign.id,
        tenant_id=campaign.tenant_id,
        name=campaign.name,
        description=campaign.description,
        agent_id=campaign.agent_id,
        questionnaire_id=campaign.questionnaire_id,
        concurrency=campaign.concurrency,
        caller_id=campaign.caller_id,
        schedule=campaign.schedule,
        status=campaign.status,
        contact_count=len(campaign.contacts or []),
        is_demo=campaign.is_demo,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
    )


@router.get("", response_model=PaginatedResponse[CampaignRead])
def list_campaigns(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
) -> dict:
    q = _scoped(db, user.tenant_id).order_by(models.Campaign.id)
    total = q.count()
    items = q.offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([_to_read(c) for c in items], total, pagination)


@router.post("", response_model=CampaignRead, status_code=status.HTTP_201_CREATED)
def create_campaign(
    payload: CampaignCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    agent = (
        db.query(models.Agent)
        .filter(models.Agent.id == payload.agent_id, models.Agent.tenant_id == user.tenant_id)
        .first()
    )
    if not agent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent not found in tenant")
    if payload.questionnaire_id is not None:
        qq = (
            db.query(models.Questionnaire)
            .filter(
                models.Questionnaire.id == payload.questionnaire_id,
                models.Questionnaire.tenant_id == user.tenant_id,
            )
            .first()
        )
        if not qq:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Questionnaire not found in tenant")
    campaign = models.Campaign(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return _to_read(campaign)


@router.get("/{campaign_id}", response_model=CampaignRead)
def get_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> CampaignRead:
    return _to_read(_get_or_404(db, user.tenant_id, campaign_id))


@router.put("/{campaign_id}", response_model=CampaignRead)
def update_campaign(
    campaign_id: int,
    payload: CampaignUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    campaign = _get_or_404(db, user.tenant_id, campaign_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(campaign, key, value)
    db.commit()
    db.refresh(campaign)
    return _to_read(campaign)


@router.delete("/{campaign_id}")
def delete_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
):
    campaign = _get_or_404(db, user.tenant_id, campaign_id)
    db.delete(campaign)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _transition(db: Session, user: models.User, campaign_id: int, action: str) -> CampaignRead:
    campaign = _get_or_404(db, user.tenant_id, campaign_id)
    rule = TRANSITIONS[action]
    if campaign.status not in rule["from"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot {action} campaign in status {campaign.status}",
        )
    if action == "start":
        agent = db.get(models.Agent, campaign.agent_id)
        if agent is None or agent.status != "active":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Campaign agent is not active")
        contact_count = (
            db.query(func.count())
            .select_from(models.CampaignContact)
            .filter(models.CampaignContact.campaign_id == campaign.id)
            .scalar()
        ) or 0
        if contact_count == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot start campaign with no contacts"
            )
    campaign.status = rule["to"]
    db.commit()
    db.refresh(campaign)
    return _to_read(campaign)


@router.post("/{campaign_id}/start", response_model=CampaignRead)
def start_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    return _transition(db, user, campaign_id, "start")


@router.post("/{campaign_id}/pause", response_model=CampaignRead)
def pause_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    return _transition(db, user, campaign_id, "pause")


@router.post("/{campaign_id}/resume", response_model=CampaignRead)
def resume_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    return _transition(db, user, campaign_id, "resume")


@router.post("/{campaign_id}/stop", response_model=CampaignRead)
def stop_campaign(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    return _transition(db, user, campaign_id, "stop")


@router.post("/{campaign_id}/contacts", response_model=CampaignRead)
def add_contacts(
    campaign_id: int,
    payload: CampaignContactsAdd,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CampaignRead:
    campaign = _get_or_404(db, user.tenant_id, campaign_id)
    valid_ids = {
        c.id
        for c in db.query(models.Contact.id)
        .filter(models.Contact.tenant_id == user.tenant_id, models.Contact.id.in_(payload.contact_ids))
        .all()
    }
    missing = set(payload.contact_ids) - valid_ids
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Contacts not found in tenant: {sorted(missing)}",
        )
    for cid in payload.contact_ids:
        exists = (
            db.query(models.CampaignContact)
            .filter(
                models.CampaignContact.campaign_id == campaign.id,
                models.CampaignContact.contact_id == cid,
            )
            .first()
        )
        if not exists:
            db.add(models.CampaignContact(campaign_id=campaign.id, contact_id=cid))
    db.commit()
    db.refresh(campaign)
    return _to_read(campaign)


@router.get("/{campaign_id}/stats", response_model=CampaignStats)
def campaign_stats(
    campaign_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> CampaignStats:
    campaign = _get_or_404(db, user.tenant_id, campaign_id)
    calls = db.query(models.Call).filter(models.Call.campaign_id == campaign.id).all()
    total = (
        db.query(func.count())
        .select_from(models.CampaignContact)
        .filter(models.CampaignContact.campaign_id == campaign.id)
        .scalar()
    ) or 0
    attempted = sum(1 for c in calls if c.status not in ("INITIATING",))
    answered = sum(1 for c in calls if c.status in ("IN_PROGRESS", "COMPLETED"))
    completed = sum(1 for c in calls if c.status == "COMPLETED")
    failed = sum(1 for c in calls if c.status == "FAILED")
    busy = sum(1 for c in calls if c.status == "BUSY")
    no_answer = sum(1 for c in calls if c.status == "NO_ANSWER")
    durations = [c.duration_sec for c in calls if c.duration_sec]
    avg_duration = sum(durations) / len(durations) if durations else 0.0
    interested = (
        db.query(func.count())
        .select_from(models.Lead)
        .filter(models.Lead.campaign_id == campaign.id, models.Lead.status == "INTERESTED")
        .scalar()
    ) or 0
    qualified = (
        db.query(func.count())
        .select_from(models.Lead)
        .filter(models.Lead.campaign_id == campaign.id, models.Lead.status == "QUALIFIED")
        .scalar()
    ) or 0
    return CampaignStats(
        total=total,
        attempted=attempted,
        answered=answered,
        completed=completed,
        failed=failed,
        busy=busy,
        no_answer=no_answer,
        interested=interested,
        qualified=qualified,
        avg_duration_sec=round(avg_duration, 1),
    )
