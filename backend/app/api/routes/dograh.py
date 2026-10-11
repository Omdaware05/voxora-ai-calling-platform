"""Dograh integration endpoints (health, sync, workflows, runs)."""
from __future__ import annotations

from typing import Annotated, Any, Dict

import asyncio

from fastapi import APIRouter, Depends, Query

from app import models
from app.deps import get_current_user, require_member_or_admin
from app.services.dograh import DograhClient

router = APIRouter(prefix="/integrations/dograh", tags=["integrations"])


def _client() -> DograhClient:
    return DograhClient()


@router.get("/health")
def health(user: Annotated[models.User, Depends(get_current_user)]) -> dict:
    return asyncio.run(_client().health())


@router.post("/sync")
def sync(user: Annotated[models.User, Depends(require_member_or_admin)]) -> dict:
    return asyncio.run(_client().sync_agents())


@router.get("/workflows")
def list_workflows(user: Annotated[models.User, Depends(get_current_user)]) -> dict:
    return asyncio.run(_client().list_workflows())


@router.post("/workflows")
def create_workflow(
    payload: Dict[str, Any],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    return asyncio.run(_client().create_workflow(payload))


@router.post("/workflows/{workflow_id}/publish")
def publish_workflow(
    workflow_id: str,
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    return asyncio.run(_client().publish_workflow(workflow_id))


@router.get("/runs")
def list_runs(
    user: Annotated[models.User, Depends(get_current_user)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> dict:
    return {"runs": asyncio.run(_client().list_runs(limit))}


@router.post("/runs")
def create_run(
    payload: Dict[str, Any],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    return asyncio.run(
        _client().initiate_call(
            agent_id=str(payload.get("agent_id", "")),
            phone=str(payload.get("phone", "")),
            caller_id=payload.get("caller_id"),
            metadata=payload.get("metadata"),
        )
    )


@router.get("/runs/{run_id}")
def run_status(
    run_id: str,
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    return asyncio.run(_client().run_status(run_id))


@router.post("/runs/{run_id}/stop")
def stop_run(
    run_id: str,
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    return asyncio.run(_client().terminate_call(run_id))
