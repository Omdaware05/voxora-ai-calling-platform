"""Realtime WebSockets.

- /api/v1/ws/calls            -> call.created / call.updated / call.ended events
- /api/v1/ws/calls/{call_id}  -> transcript.segment events for one call

Auth: ?token=<JWT> query param. Events are scoped to the user's tenant.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.security import decode_access_token
from app.services import redis_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


def _user_from_token(token: Optional[str], db: Session) -> Optional[models.User]:
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        user = db.get(models.User, int(payload.get("sub")))
        if user and user.is_active:
            return user
        return None
    except Exception:
        return None


@router.websocket("/ws/calls")
async def ws_calls(websocket: WebSocket, token: Optional[str] = None):
    await websocket.accept()
    db = next(get_db())
    try:
        user = _user_from_token(token, db)
        if user is None:
            await websocket.send_json({"type": "error", "detail": "Unauthorized"})
            await websocket.close(code=4401)
            return
        queue = redis_service.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
                    continue
                if event.get("tenant_id") != user.tenant_id:
                    continue
                if event.get("type") in ("call.created", "call.updated", "call.ended"):
                    await websocket.send_json(event)
        finally:
            redis_service.unsubscribe(queue)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()


@router.websocket("/ws/calls/{call_id}")
async def ws_call_transcript(websocket: WebSocket, call_id: str, token: Optional[str] = None):
    await websocket.accept()
    db = next(get_db())
    try:
        user = _user_from_token(token, db)
        if user is None:
            await websocket.send_json({"type": "error", "detail": "Unauthorized"})
            await websocket.close(code=4401)
            return
        call = (
            db.query(models.Call)
            .filter(models.Call.id == call_id, models.Call.tenant_id == user.tenant_id)
            .first()
        )
        if call is None:
            await websocket.send_json({"type": "error", "detail": "Call not found"})
            await websocket.close(code=4404)
            return
        queue = redis_service.subscribe()
        try:
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                except asyncio.TimeoutError:
                    await websocket.send_json({"type": "ping"})
                    continue
                if event.get("tenant_id") != user.tenant_id:
                    continue
                if event.get("type") == "transcript.segment" and event.get("call_id") == call_id:
                    await websocket.send_json(event)
        finally:
            redis_service.unsubscribe(queue)
    except WebSocketDisconnect:
        pass
    finally:
        db.close()
