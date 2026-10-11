"""Questionnaire schemas."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel

QUESTION_TYPES = ("text", "number", "boolean", "single_choice", "multi_choice", "rating", "date")


class Question(BaseModel):
    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    description: Optional[str] = None
    type: str = Field(default="text", pattern="^(text|number|boolean|single_choice|multi_choice|rating|date)$")
    required: bool = False
    order: int = 0
    options: Optional[List[str]] = None
    validation: Optional[Dict[str, Any]] = None
    conditional: Optional[Dict[str, Any]] = None
    expected_answer: Optional[str] = None


class QuestionnaireCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: Optional[str] = None
    questions: Optional[List[Question]] = None


class QuestionnaireUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = None
    questions: Optional[List[Question]] = None


class QuestionnaireRead(ORMModel):
    id: int
    tenant_id: int
    title: str
    description: Optional[str] = None
    status: str
    version: int
    questions: Optional[List[Dict[str, Any]]] = None
    is_demo: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class QuestionnaireVersionRead(ORMModel):
    id: int
    questionnaire_id: int
    version: int
    snapshot: Dict[str, Any]
    created_at: Optional[datetime] = None
