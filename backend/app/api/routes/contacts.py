"""Contacts: CRUD, CSV/XLSX import, CSV export, bulk delete, DNC, click-to-call."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app import models
from app.database import get_db
from app.deps import (
    get_current_user,
    get_pagination,
    paginated_response,
    require_member_or_admin,
)
from app.schemas.call import CallRead
from app.schemas.common import PaginatedResponse
from app.schemas.contact import (
    BulkDeleteRequest,
    ContactCreate,
    ContactRead,
    ContactUpdate,
    DoNotCallRequest,
)
from app.services.call_service import initiate_outbound_call
from app.utils.spreadsheets import parse_csv, parse_xlsx, to_csv

router = APIRouter(prefix="/contacts", tags=["contacts"])

EXPORT_FIELDS = ["id", "name", "phone", "email", "status", "tags", "lead_status", "do_not_call"]


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Contact).filter(models.Contact.tenant_id == tenant_id)


def _get_or_404(db: Session, tenant_id: int, contact_id: int) -> models.Contact:
    contact = _scoped(db, tenant_id).filter(models.Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.get("", response_model=PaginatedResponse[ContactRead])
def list_contacts(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    search: Annotated[str | None, Query()] = None,
    status_: Annotated[str | None, Query(alias="status")] = None,
    tag: Annotated[str | None, Query()] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if search:
        like = f"%{search}%"
        q = q.filter((models.Contact.name.ilike(like)) | (models.Contact.phone.ilike(like)) | (models.Contact.email.ilike(like)))
    if status_:
        q = q.filter(models.Contact.status == status_)
    total = q.count()
    items = q.order_by(models.Contact.id).offset(pagination.offset).limit(pagination.page_size).all()
    if tag:
        items = [c for c in items if tag in (c.tags or [])]
        total = len(items)
        items = items[pagination.offset : pagination.offset + pagination.page_size]
    return paginated_response([ContactRead.model_validate(c) for c in items], total, pagination)


@router.post("/import", response_model=dict, status_code=status.HTTP_201_CREATED)
async def import_contacts(
    file: Annotated[UploadFile, File()],
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    name = (file.filename or "").lower()
    data = await file.read()
    try:
        rows = parse_csv(data) if name.endswith(".csv") else parse_xlsx(data) if name.endswith((".xlsx", ".xls")) else None
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not parse file: {exc}")
    if rows is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .csv or .xlsx files are supported")
    created, skipped = 0, 0
    for row in rows:
        phone = str(row.get("phone") or "").strip()
        cname = str(row.get("name") or "").strip()
        if not phone or not cname:
            skipped += 1
            continue
        tags_raw = row.get("tags") or ""
        tags = [t.strip() for t in str(tags_raw).split(",") if t.strip()]
        db.add(
            models.Contact(
                tenant_id=user.tenant_id,
                name=cname,
                phone=phone,
                email=str(row.get("email") or "").strip() or None,
                status=str(row.get("status") or "active").strip(),
                tags=tags,
            )
        )
        created += 1
    db.commit()
    return {"created": created, "skipped": skipped}


@router.get("/export")
def export_contacts(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> Response:
    contacts = _scoped(db, user.tenant_id).order_by(models.Contact.id).all()
    rows = [
        {
            "id": c.id,
            "name": c.name,
            "phone": c.phone,
            "email": c.email or "",
            "status": c.status,
            "tags": ",".join(c.tags or []),
            "lead_status": c.lead_status or "",
            "do_not_call": c.do_not_call,
        }
        for c in contacts
    ]
    return Response(
        content=to_csv(rows, EXPORT_FIELDS),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete(
    payload: BulkDeleteRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> dict:
    deleted = (
        _scoped(db, user.tenant_id).filter(models.Contact.id.in_(payload.ids)).delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


@router.post("", response_model=ContactRead, status_code=status.HTTP_201_CREATED)
def create_contact(
    payload: ContactCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> ContactRead:
    contact = models.Contact(tenant_id=user.tenant_id, **payload.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return ContactRead.model_validate(contact)


@router.get("/{contact_id}", response_model=ContactRead)
def get_contact(
    contact_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> ContactRead:
    return ContactRead.model_validate(_get_or_404(db, user.tenant_id, contact_id))


@router.put("/{contact_id}", response_model=ContactRead)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> ContactRead:
    contact = _get_or_404(db, user.tenant_id, contact_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return ContactRead.model_validate(contact)


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> None:
    contact = _get_or_404(db, user.tenant_id, contact_id)
    db.delete(contact)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{contact_id}/call", response_model=CallRead, status_code=status.HTTP_201_CREATED)
def call_contact(
    contact_id: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
    agent_id: Annotated[int | None, Query()] = None,
) -> CallRead:
    contact = _get_or_404(db, user.tenant_id, contact_id)
    if contact.do_not_call:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contact is on the do-not-call list")
    if agent_id is None:
        agent = (
            db.query(models.Agent)
            .filter(models.Agent.tenant_id == user.tenant_id, models.Agent.status == "active")
            .order_by(models.Agent.id)
            .first()
        )
        if agent is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No active agent available")
        agent_id = agent.id
    call = initiate_outbound_call(
        db, tenant_id=user.tenant_id, agent_id=agent_id, phone=contact.phone, contact_id=contact.id
    )
    return CallRead.model_validate(call)


@router.patch("/{contact_id}/do-not-call", response_model=ContactRead)
def set_do_not_call(
    contact_id: int,
    payload: DoNotCallRequest,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> ContactRead:
    contact = _get_or_404(db, user.tenant_id, contact_id)
    contact.do_not_call = payload.do_not_call
    db.commit()
    db.refresh(contact)
    return ContactRead.model_validate(contact)
