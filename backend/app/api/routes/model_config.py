"""Tenant-level AI model configuration (stt/llm/tts).

API keys are write-only and Fernet-encrypted at rest; responses expose only
`has_api_key`. Writes restricted to ADMIN.
"""
from __future__ import annotations

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.schemas.catalog import VALID_MODEL_TYPES, ModelConfigRead, ModelConfigUpdate
from app.schemas.common import OkResponse
from app.services import ai_models
from app.utils.secrets import encrypt_secret

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/model-config", tags=["model-config"])

DEFAULTS = {
    "stt": {"provider": "speaches", "model": "whisper-large-v3-turbo", "base_url": ""},
    "llm": {"provider": "openai-compatible", "model": "", "base_url": ""},
    "tts": {"provider": "speaches", "model": "kokoro", "base_url": ""},
}


def _to_read(cfg: models.ModelConfig | None, mtype: str) -> ModelConfigRead:
    base = DEFAULTS[mtype]
    if cfg is None:
        return ModelConfigRead(type=mtype, **base, has_api_key=False)
    return ModelConfigRead(
        type=mtype,
        provider=cfg.provider,
        model=cfg.model,
        base_url=cfg.base_url,
        has_api_key=bool(cfg.api_key_encrypted),
        language=cfg.language,
        voice=cfg.voice,
        speed=cfg.speed,
        temperature=cfg.temperature,
        max_tokens=cfg.max_tokens,
        extra=cfg.extra,
    )


@router.get("")
def get_all(db: Annotated[Session, Depends(get_db)], user: Annotated[models.User, Depends(get_current_user)]) -> dict:
    cfgs = (
        db.query(models.ModelConfig).filter(models.ModelConfig.tenant_id == user.tenant_id).all()
    )
    by_type = {c.type: c for c in cfgs}
    return {mtype: _to_read(by_type.get(mtype), mtype).model_dump() for mtype in VALID_MODEL_TYPES}


@router.put("/{mtype}", response_model=ModelConfigRead)
def upsert(
    mtype: str,
    payload: ModelConfigUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> ModelConfigRead:
    if mtype not in VALID_MODEL_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown model type: {mtype}")
    cfg = (
        db.query(models.ModelConfig)
        .filter(models.ModelConfig.tenant_id == user.tenant_id, models.ModelConfig.type == mtype)
        .first()
    )
    if cfg is None:
        cfg = models.ModelConfig(tenant_id=user.tenant_id, type=mtype)
        db.add(cfg)
    data = payload.model_dump(exclude_unset=True)
    api_key = data.pop("api_key", None)
    for key, value in data.items():
        setattr(cfg, key, value)
    if api_key is not None:
        cfg.api_key_encrypted = encrypt_secret(api_key) if api_key else None
    db.commit()
    db.refresh(cfg)
    return _to_read(cfg, mtype)


@router.post("/{mtype}/test")
def test(
    mtype: str,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    if mtype not in VALID_MODEL_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown model type: {mtype}")
    cfg = (
        db.query(models.ModelConfig)
        .filter(models.ModelConfig.tenant_id == user.tenant_id, models.ModelConfig.type == mtype)
        .first()
    )
    base_url = cfg.base_url if cfg else None
    model = cfg.model if cfg else None
    return ai_models.test_connection(mtype, base_url, model)


@router.post("/reset", response_model=OkResponse)
def reset(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> OkResponse:
    db.query(models.ModelConfig).filter(models.ModelConfig.tenant_id == user.tenant_id).delete()
    db.commit()
    return OkResponse(ok=True)
