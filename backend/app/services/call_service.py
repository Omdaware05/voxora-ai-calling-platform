"""Call orchestration shared by the calls and contacts routers."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.services import dograh as dograh_module
from app.services import redis_service

logger = logging.getLogger(__name__)


def _emit_event(db: Session, call: models.Call, event_type: str, payload: Optional[Dict[str, Any]] = None) -> None:
    db.add(models.CallEvent(call_id=call.id, type=event_type, payload=payload or {}))


def _broadcast_sync(event: Dict[str, Any]) -> None:
    """Run the async broadcaster from sync route code."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None
    if loop and loop.is_running():
        loop.create_task(redis_service.broadcast(event))
    else:
        asyncio.run(redis_service.broadcast(event))


def initiate_outbound_call(
    db: Session,
    *,
    tenant_id: int,
    agent_id: int,
    phone: str,
    contact_id: Optional[int] = None,
    campaign_id: Optional[int] = None,
    direction: str = "outbound",
) -> models.Call:
    """Validate, create an INITIATING call, hand off to the Dograh adapter, mark IN_PROGRESS."""
    agent = (
        db.query(models.Agent)
        .filter(models.Agent.id == agent_id, models.Agent.tenant_id == tenant_id)
        .first()
    )
    if agent is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
    if agent.status != "active":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Agent is disabled")

    contact = None
    if contact_id is not None:
        contact = (
            db.query(models.Contact)
            .filter(models.Contact.id == contact_id, models.Contact.tenant_id == tenant_id)
            .first()
        )
        if contact is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
        if contact.do_not_call:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Contact is on the do-not-call list"
            )
        phone = contact.phone

    if not phone:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Phone number is required")

    call = models.Call(
        tenant_id=tenant_id,
        agent_id=agent.id,
        contact_id=contact.id if contact else None,
        campaign_id=campaign_id,
        phone=phone,
        direction=direction,
        status="INITIATING",
        started_at=datetime.now(timezone.utc),
    )
    db.add(call)
    db.flush()
    _emit_event(db, call, "call.initiating", {"phone": phone, "agent_id": agent.id})
    redis_service.add_active_call(call.id)
    redis_service.set_call_session(
        call.id, {"call_id": call.id, "status": "INITIATING", "agent_id": agent.id, "phone": phone}
    )
    _broadcast_sync({"type": "call.created", "call_id": call.id, "tenant_id": tenant_id, "status": "INITIATING"})

    # Hand off to the Dograh adapter (mock mode when DOGRAH_BASE_URL unset)
    client = dograh_module.DograhClient()
    result = asyncio.run(client.initiate_call(agent_id=str(agent.id), phone=phone))
    if result.get("ok"):
        call.status = "IN_PROGRESS"
        call.dograh_run_id = result.get("run_id")
        _emit_event(db, call, "call.in_progress", {"run_id": call.dograh_run_id, "mode": result.get("mode", "live")})
        redis_service.set_call_session(
            call.id,
            {"call_id": call.id, "status": "IN_PROGRESS", "agent_id": agent.id, "phone": phone,
             "run_id": call.dograh_run_id},
        )
        _broadcast_sync({"type": "call.updated", "call_id": call.id, "tenant_id": tenant_id, "status": "IN_PROGRESS"})
    else:
        call.status = "FAILED"
        call.termination_reason = result.get("message", "adapter error")
        _emit_event(db, call, "call.failed", {"reason": call.termination_reason})
        redis_service.remove_active_call(call.id)
        _broadcast_sync({"type": "call.updated", "call_id": call.id, "tenant_id": tenant_id, "status": "FAILED"})

    if contact is not None:
        contact.last_call_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(call)
    return call


def hangup_call(db: Session, call: models.Call, tenant_id: int) -> models.Call:
    """Terminate via the adapter; mark COMPLETED with a duration."""
    if call.status in ("COMPLETED", "FAILED"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Call already ended")
    client = dograh_module.DograhClient()
    if call.dograh_run_id:
        asyncio.run(client.terminate_call(call.dograh_run_id))
    now = datetime.now(timezone.utc)
    call.ended_at = now
    if call.started_at:
        started = call.started_at
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        call.duration_sec = max(int((now - started).total_seconds()), 0)
    call.status = "COMPLETED"
    call.termination_reason = "hangup"
    _emit_event(db, call, "call.ended", {"duration_sec": call.duration_sec})
    db.commit()
    db.refresh(call)
    redis_service.remove_active_call(call.id)
    redis_service.delete_call_session(call.id)
    _broadcast_sync({"type": "call.ended", "call_id": call.id, "tenant_id": tenant_id, "status": "COMPLETED"})
    return call
