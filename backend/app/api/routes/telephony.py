"""Telephony config (VoBiz): view, save (write-only token, encrypted), test, set-default.

Writes restricted to ADMIN. Tokens are never returned — only `has_credentials`.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import models
from app.config import get_settings
from app.database import get_db
from app.deps import get_current_user, require_admin
from app.schemas.crm import (
    SetDefaultProvider,
    TelephonyConfigPublic,
    TelephonyOverview,
    VobizConfigUpdate,
)
from app.services import vobiz
from app.utils.secrets import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/telephony", tags=["telephony"])


def _public(cfg: models.TelephonyConfig) -> TelephonyConfigPublic:
    return TelephonyConfigPublic(
        id=cfg.id,
        provider=cfg.provider,
        from_number=cfg.from_number,
        is_default=cfg.is_default,
        status=cfg.status,
        has_credentials=bool(cfg.auth_id and cfg.auth_token_encrypted),
        created_at=cfg.created_at,
    )


@router.get("", response_model=TelephonyOverview)
def get_overview(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> TelephonyOverview:
    cfgs = (
        db.query(models.TelephonyConfig)
        .filter(models.TelephonyConfig.tenant_id == user.tenant_id)
        .order_by(models.TelephonyConfig.id)
        .all()
    )
    default = next((c.provider for c in cfgs if c.is_default), None)
    return TelephonyOverview(configs=[_public(c) for c in cfgs], default_provider=default)


@router.put("/vobiz", response_model=TelephonyConfigPublic)
def save_vobiz(
    payload: VobizConfigUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> TelephonyConfigPublic:
    cfg = (
        db.query(models.TelephonyConfig)
        .filter(models.TelephonyConfig.tenant_id == user.tenant_id, models.TelephonyConfig.provider == "vobiz")
        .first()
    )
    if cfg is None:
        cfg = models.TelephonyConfig(tenant_id=user.tenant_id, provider="vobiz")
        db.add(cfg)
    data = payload.model_dump(exclude_unset=True)
    token = data.pop("auth_token", None)
    if "auth_id" in data:
        cfg.auth_id = data["auth_id"]
    if "from_number" in data:
        cfg.from_number = data["from_number"]
    if token is not None:
        # Write-only: empty string clears, non-empty encrypts; omitted leaves as-is
        cfg.auth_token_encrypted = encrypt_secret(token) if token else None
    has_creds = bool(cfg.auth_id and cfg.auth_token_encrypted)
    cfg.status = "configured" if has_creds else "not_configured"
    db.commit()
    db.refresh(cfg)
    return _public(cfg)


@router.post("/vobiz/test")
def test_vobiz(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> dict:
    cfg = (
        db.query(models.TelephonyConfig)
        .filter(models.TelephonyConfig.tenant_id == user.tenant_id, models.TelephonyConfig.provider == "vobiz")
        .first()
    )
    if cfg is None or not cfg.auth_id or not cfg.auth_token_encrypted:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="VoBiz not configured")
    token = decrypt_secret(cfg.auth_token_encrypted)
    return vobiz.test_connection(cfg.auth_id, token, get_settings().VOBIZ_API_URL)


@router.post("/set-default", response_model=TelephonyOverview)
def set_default(
    payload: SetDefaultProvider,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_admin)],
) -> TelephonyOverview:
    cfgs = (
        db.query(models.TelephonyConfig)
        .filter(models.TelephonyConfig.tenant_id == user.tenant_id)
        .all()
    )
    target = next((c for c in cfgs if c.provider == payload.provider), None)
    if target is None:
        target = models.TelephonyConfig(
            tenant_id=user.tenant_id, provider=payload.provider, status="not_configured"
        )
        db.add(target)
        cfgs.append(target)
    for c in cfgs:
        c.is_default = c.provider == payload.provider
    db.commit()
    return TelephonyOverview(configs=[_public(c) for c in cfgs], default_provider=payload.provider)
