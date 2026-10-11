"""Questionnaires: CRUD, publish/archive, versions, XLSX import/template.

NOTE: static routes (/import, /template) are registered before /{qid} so
FastAPI does not mistake them for questionnaire ids.
"""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
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
from app.schemas.common import PaginatedResponse
from app.schemas.questionnaire import (
    QuestionnaireCreate,
    QuestionnaireRead,
    QuestionnaireUpdate,
    QuestionnaireVersionRead,
)
from app.utils.spreadsheets import parse_questionnaire_workbook, questionnaire_template_xlsx

router = APIRouter(prefix="/questionnaires", tags=["questionnaires"])


def _scoped(db: Session, tenant_id: int):
    return db.query(models.Questionnaire).filter(models.Questionnaire.tenant_id == tenant_id)


def _get_or_404(db: Session, tenant_id: int, qid: int) -> models.Questionnaire:
    q = _scoped(db, tenant_id).filter(models.Questionnaire.id == qid).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Questionnaire not found")
    return q


def _snapshot_version(db: Session, q: models.Questionnaire) -> None:
    latest = (
        db.query(func.coalesce(func.max(models.QuestionnaireVersion.version), 0))
        .filter(models.QuestionnaireVersion.questionnaire_id == q.id)
        .scalar()
    ) or 0
    db.add(
        models.QuestionnaireVersion(
            questionnaire_id=q.id,
            version=latest + 1,
            snapshot={
                "title": q.title,
                "description": q.description,
                "status": q.status,
                "version": q.version,
                "questions": q.questions,
            },
        )
    )


@router.get("", response_model=PaginatedResponse[QuestionnaireRead])
def list_questionnaires(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
    pagination=Depends(get_pagination),
    status_: Annotated[str | None, Query(alias="status")] = None,
) -> dict:
    q = _scoped(db, user.tenant_id)
    if status_:
        q = q.filter(models.Questionnaire.status == status_)
    total = q.count()
    items = q.order_by(models.Questionnaire.id).offset(pagination.offset).limit(pagination.page_size).all()
    return paginated_response([QuestionnaireRead.model_validate(x) for x in items], total, pagination)


@router.post("/import", response_model=QuestionnaireRead, status_code=status.HTTP_201_CREATED)
async def import_questionnaire(
    file: Annotated[UploadFile, File()],
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    if not file.filename or not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .xlsx files are supported")
    data = await file.read()
    try:
        parsed = parse_questionnaire_workbook(data)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not parse workbook: {exc}")
    if not parsed["questions"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No questions found in workbook")
    q = models.Questionnaire(
        tenant_id=user.tenant_id,
        title=parsed["title"],
        description=parsed["description"],
        questions=parsed["questions"],
        status="draft",
    )
    db.add(q)
    db.flush()
    _snapshot_version(db, q)
    db.commit()
    db.refresh(q)
    return QuestionnaireRead.model_validate(q)


@router.get("/template")
def download_template(
    user: Annotated[models.User, Depends(get_current_user)],
) -> Response:
    data = questionnaire_template_xlsx()
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=questionnaire_template.xlsx"},
    )


@router.post("", response_model=QuestionnaireRead, status_code=status.HTTP_201_CREATED)
def create_questionnaire(
    payload: QuestionnaireCreate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    questions = [q.model_dump() for q in payload.questions] if payload.questions else []
    q = models.Questionnaire(
        tenant_id=user.tenant_id, title=payload.title, description=payload.description, questions=questions
    )
    db.add(q)
    db.flush()
    _snapshot_version(db, q)
    db.commit()
    db.refresh(q)
    return QuestionnaireRead.model_validate(q)


@router.get("/{qid}", response_model=QuestionnaireRead)
def get_questionnaire(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> QuestionnaireRead:
    return QuestionnaireRead.model_validate(_get_or_404(db, user.tenant_id, qid))


@router.put("/{qid}", response_model=QuestionnaireRead)
def update_questionnaire(
    qid: int,
    payload: QuestionnaireUpdate,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    q = _get_or_404(db, user.tenant_id, qid)
    _snapshot_version(db, q)
    data = payload.model_dump(exclude_unset=True)
    if "questions" in data and data["questions"] is not None:
        data["questions"] = [
            qu.model_dump() if hasattr(qu, "model_dump") else qu for qu in data["questions"]
        ]
    for key, value in data.items():
        setattr(q, key, value)
    q.version = (q.version or 1) + 1
    db.commit()
    db.refresh(q)
    return QuestionnaireRead.model_validate(q)


@router.delete("/{qid}")
def delete_questionnaire(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> None:
    q = _get_or_404(db, user.tenant_id, qid)
    db.delete(q)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{qid}/duplicate", response_model=QuestionnaireRead, status_code=status.HTTP_201_CREATED)
def duplicate_questionnaire(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    q = _get_or_404(db, user.tenant_id, qid)
    copy = models.Questionnaire(
        tenant_id=user.tenant_id,
        title=f"{q.title} (copy)",
        description=q.description,
        status="draft",
        questions=list(q.questions or []),
    )
    db.add(copy)
    db.flush()
    _snapshot_version(db, copy)
    db.commit()
    db.refresh(copy)
    return QuestionnaireRead.model_validate(copy)


@router.post("/{qid}/publish", response_model=QuestionnaireRead)
def publish_questionnaire(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    q = _get_or_404(db, user.tenant_id, qid)
    if q.status == "archived":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Archived questionnaires cannot be published"
        )
    q.status = "published"
    db.commit()
    db.refresh(q)
    return QuestionnaireRead.model_validate(q)


@router.post("/{qid}/archive", response_model=QuestionnaireRead)
def archive_questionnaire(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(require_member_or_admin)],
) -> QuestionnaireRead:
    q = _get_or_404(db, user.tenant_id, qid)
    q.status = "archived"
    db.commit()
    db.refresh(q)
    return QuestionnaireRead.model_validate(q)


@router.get("/{qid}/versions", response_model=list[QuestionnaireVersionRead])
def list_versions(
    qid: int,
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[models.User, Depends(get_current_user)],
) -> list[QuestionnaireVersionRead]:
    _get_or_404(db, user.tenant_id, qid)
    versions = (
        db.query(models.QuestionnaireVersion)
        .filter(models.QuestionnaireVersion.questionnaire_id == qid)
        .order_by(models.QuestionnaireVersion.version.desc())
        .all()
    )
    return [QuestionnaireVersionRead.model_validate(v) for v in versions]
