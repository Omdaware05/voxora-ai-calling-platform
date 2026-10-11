"""Calls: initiate, live list, detail, hangup, transcript, events, recording, demo events.

NOTE: /live is registered before /{call_id} so it is not captured as an id.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.database import get_db
from app.deps import (
    get_current_user,
    get_pagination,
    paginated_response,
    require_admin,
    require_member_or_admin,
)
from app.schemas.call import (
    CallCreate,
    CallEventRead,
    CallRead,
    DemoEventRequest,
    TranscriptRead,
    TranscriptSegmentRead,
)
from app.schemas.common import PaginatedResponse
from app.services import redis_service
from app.services.call_service import hangup_call, initiate_outbound_call
from app.services.storage import get_recording_file

router = APIRouter(prefix="/calls", tags=["calls"])

ACTIVE_STATUSES = ("INITIATING", "RINGING", "IN_PROGRESS")


def _get_or_404(db: Session, tenant_id: int, call_id: str) -> models.Call:
    call = (
        db.query(models.Call)
        .filter(models.Call.id == call_id, models.Call.tenant_id == tenant_id)
        .first()
    )
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return call


@router.get("", response_model=PaginatedResponse[CallRead])
def list_calls(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    status_: Annotated[str | None, Query(alias="status")] = None,
    agent_id: Annotated[int | None, Query()] = None,
    campaign_id: Annotated[int | None, Query()] = None,
    date_from: Annotated[datetime | None, Query()] = None,
    date_to: Annotated[datetime | None, Query()] = None,
    search: Annotated[str | None, Query()] = None,
) -> dict:
    q = db.query(models.Call).filter(models.Call.tenant_id == user.tenant_id)
    if status_:
        q = q.filter(models.Call.status == status_)
    if agent_id is not None:
        q = q.filter(models.Call.agent_id == agent_id)
    if campaign_id is not None:
        q = q.filter(models.Call.campaign_id == campaign_id)
    if date_from:
        q = q.filter(models.Call.created_at >= date_from)
    if date_to:
        q = q.filter(models.Call.created_at <= date_to)
    if search:
        q = q.filter(models.Call.phone.ilike(f"%{search}%"))
    total = q.count()
    items = q.order_by(models.Call.created_at.desc()).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([CallRead.model_validate(c) for c in items], total, pagination)


@router.post("", response_model=CallRead, status_code=status.HTTP_201_CREATED)
def create_call(
    payload: CallCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CallRead:
    call = initiate_outbound_call(
        db,
        tenant_id=user.tenant_id,
        agent_id=payload.agent_id,
        phone=payload.phone or "",
        contact_id=payload.contact_id,
        campaign_id=payload.campaign_id,
    )
    return CallRead.model_validate(call)


@router.get("/live", response_model=list[CallRead])
def live_calls(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[CallRead]:
    calls = (
        db.query(models.Call)
        .filter(models.Call.tenant_id == user.tenant_id, models.Call.status.in_(ACTIVE_STATUSES))
        .order_by(models.Call.created_at.desc())
        .all()
    )
    return [CallRead.model_validate(c) for c in calls]


@router.get("/{call_id}", response_model=CallRead)
def get_call(
    call_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> CallRead:
    return CallRead.model_validate(_get_or_404(db, user.tenant_id, call_id))


@router.post("/{call_id}/hangup", response_model=CallRead)
def hangup(
    call_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> CallRead:
    call = _get_or_404(db, user.tenant_id, call_id)
    return CallRead.model_validate(hangup_call(db, call, user.tenant_id))


@router.get("/{call_id}/transcript", response_model=TranscriptRead)
def get_transcript(
    call_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> TranscriptRead:
    _get_or_404(db, user.tenant_id, call_id)
    segments = (
        db.query(models.TranscriptSegment)
        .filter(models.TranscriptSegment.call_id == call_id)
        .order_by(models.TranscriptSegment.offset_sec, models.TranscriptSegment.id)
        .all()
    )
    transcript = db.query(models.Transcript).filter(models.Transcript.call_id == call_id).first()
    full_text = transcript.full_text if transcript else " ".join(s.text for s in segments)
    return TranscriptRead(
        call_id=call_id,
        segments=[TranscriptSegmentRead.model_validate(s) for s in segments],
        full_text=full_text,
        summary=transcript.summary if transcript else None,
        language=transcript.language if transcript else None,
    )


@router.get("/{call_id}/events", response_model=list[CallEventRead])
def get_events(
    call_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[CallEventRead]:
    _get_or_404(db, user.tenant_id, call_id)
    events = (
        db.query(models.CallEvent)
        .filter(models.CallEvent.call_id == call_id)
        .order_by(models.CallEvent.created_at, models.CallEvent.id)
        .all()
    )
    return [CallEventRead.model_validate(e) for e in events]


@router.get("/{call_id}/recording")
def get_recording(
    call_id: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
):
    call = _get_or_404(db, user.tenant_id, call_id)
    key = call.recording_key
    if not key:
        rec = db.query(models.Recording).filter(models.Recording.call_id == call_id).first()
        key = rec.storage_key if rec else None
    if not key:
        return JSONResponse(status_code=404, content={"detail": "No recording available"})
    path = get_recording_file(key)
    if not path:
        return JSONResponse(status_code=404, content={"detail": "No recording available"})
    return FileResponse(path, media_type="audio/wav", filename=f"{call_id}.wav")


@router.post("/{call_id}/demo-event", response_model=TranscriptSegmentRead, status_code=status.HTTP_201_CREATED)
def demo_event(
    call_id: str,
    payload: DemoEventRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> TranscriptSegmentRead:
    """Append a demo transcript segment. Only in DEMO_MODE and only for ADMIN."""
    if not get_settings().DEMO_MODE:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Demo events require DEMO_MODE=true")
    call = _get_or_404(db, user.tenant_id, call_id)
    last_offset = (
        db.query(models.TranscriptSegment.offset_sec)
        .filter(models.TranscriptSegment.call_id == call_id)
        .order_by(models.TranscriptSegment.offset_sec.desc())
        .first()
    )
    offset = float(last_offset[0] + 2.0) if last_offset else 0.0
    segment = models.TranscriptSegment(
        call_id=call.id, speaker=payload.speaker, text=payload.text, offset_sec=offset
    )
    db.add(segment)
    db.commit()
    db.refresh(segment)
    redis_service.append_transcript_segment(
        call.id,
        {"speaker": segment.speaker, "text": segment.text, "offset_sec": segment.offset_sec},
    )
    try:
        import asyncio

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None
        event = {
            "type": "transcript.segment",
            "call_id": call.id,
            "tenant_id": user.tenant_id,
            "segment": {"speaker": segment.speaker, "text": segment.text, "offset_sec": segment.offset_sec},
        }
        if loop and loop.is_running():
            loop.create_task(redis_service.broadcast(event))
        else:
            asyncio.run(redis_service.broadcast(event))
    except Exception:
        pass
    return TranscriptSegmentRead.model_validate(segment)
