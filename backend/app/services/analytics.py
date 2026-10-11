"""Analytics: real SQLAlchemy queries over calls/leads/followups/usage.

Never fabricates data: empty arrays and zeros when there is no data.
Every query is scoped to the caller's tenant_id.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Dict, List

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app import models


def _day_start(d: date) -> datetime:
    return datetime(d.year, d.month, d.day)


def overview(db: Session, tenant_id: int, cost_per_min: float) -> Dict[str, Any]:
    today = date.today()
    start_today = _day_start(today)
    start_week = _day_start(today - timedelta(days=7))

    calls_today = db.scalar(
        select(func.count()).select_from(models.Call).where(
            models.Call.tenant_id == tenant_id, models.Call.created_at >= start_today
        )
    ) or 0
    completed_calls = db.scalar(
        select(func.count()).select_from(models.Call).where(
            models.Call.tenant_id == tenant_id, models.Call.status == "COMPLETED"
        )
    ) or 0
    active_calls = db.scalar(
        select(func.count()).select_from(models.Call).where(
            models.Call.tenant_id == tenant_id,
            models.Call.status.in_(["INITIATING", "RINGING", "IN_PROGRESS"]),
        )
    ) or 0
    answered = db.scalar(
        select(func.count()).select_from(models.Call).where(
            models.Call.tenant_id == tenant_id,
            models.Call.status.in_(["IN_PROGRESS", "COMPLETED"]),
            models.Call.created_at >= start_week,
        )
    ) or 0
    total_week = db.scalar(
        select(func.count()).select_from(models.Call).where(
            models.Call.tenant_id == tenant_id, models.Call.created_at >= start_week
        )
    ) or 0
    avg_duration = db.scalar(
        select(func.avg(models.Call.duration_sec)).where(
            models.Call.tenant_id == tenant_id,
            models.Call.status == "COMPLETED",
            models.Call.duration_sec.isnot(None),
        )
    ) or 0
    interested = db.scalar(
        select(func.count()).select_from(models.Lead).where(
            models.Lead.tenant_id == tenant_id, models.Lead.status == "INTERESTED"
        )
    ) or 0
    qualified = db.scalar(
        select(func.count()).select_from(models.Lead).where(
            models.Lead.tenant_id == tenant_id, models.Lead.status == "QUALIFIED"
        )
    ) or 0
    followups_due = db.scalar(
        select(func.count()).select_from(models.Followup).where(
            models.Followup.tenant_id == tenant_id,
            models.Followup.status.in_(["PENDING", "SCHEDULED"]),
            models.Followup.scheduled_at <= datetime.now() + timedelta(days=1),
        )
    ) or 0
    ai_minutes = db.scalar(
        select(func.coalesce(func.sum(models.UsageEvent.units), 0)).where(
            models.UsageEvent.tenant_id == tenant_id,
            models.UsageEvent.kind.in_(["stt", "llm", "tts"]),
        )
    ) or 0
    call_minutes = db.scalar(
        select(func.coalesce(func.sum(models.Call.duration_sec), 0)).where(
            models.Call.tenant_id == tenant_id, models.Call.status == "COMPLETED"
        )
    ) or 0
    call_minutes = call_minutes / 60.0
    est_cost = round((call_minutes + float(ai_minutes)) * cost_per_min, 4)

    return {
        "calls_today": calls_today,
        "completed_calls": completed_calls,
        "active_calls": active_calls,
        "answer_rate": round(answered / total_week, 4) if total_week else 0.0,
        "avg_duration_sec": round(float(avg_duration), 1),
        "interested_leads": interested,
        "qualified_leads": qualified,
        "followups_due": followups_due,
        "ai_usage_minutes": round(float(ai_minutes), 2),
        "est_cost": est_cost,
    }


def calls_over_time(db: Session, tenant_id: int, days: int = 30) -> List[Dict[str, Any]]:
    start = _day_start(date.today() - timedelta(days=days - 1))
    rows = db.execute(
        select(
            func.date(models.Call.created_at).label("day"),
            func.count().label("total"),
            func.sum(case((models.Call.status == "COMPLETED", 1), else_=0)).label("completed"),
        )
        .where(models.Call.tenant_id == tenant_id, models.Call.created_at >= start)
        .group_by(func.date(models.Call.created_at))
        .order_by(func.date(models.Call.created_at))
    ).all()
    by_day = {str(r.day): {"date": str(r.day), "total": r.total, "completed": int(r.completed or 0)} for r in rows}
    out: List[Dict[str, Any]] = []
    for i in range(days):
        d = date.today() - timedelta(days=days - 1 - i)
        key = str(d)
        out.append(by_day.get(key, {"date": key, "total": 0, "completed": 0}))
    return out


def outcomes(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(models.Call.status, func.count())
        .where(models.Call.tenant_id == tenant_id)
        .group_by(models.Call.status)
    ).all()
    return [{"status": r[0], "count": r[1]} for r in rows]


def durations(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    buckets = [(0, 30), (30, 60), (60, 120), (120, 300), (300, 600), (600, 10**9)]
    labels = ["0-30s", "30-60s", "1-2m", "2-5m", "5-10m", "10m+"]
    out = []
    for (lo, hi), label in zip(buckets, labels):
        count = db.scalar(
            select(func.count()).select_from(models.Call).where(
                models.Call.tenant_id == tenant_id,
                models.Call.duration_sec.isnot(None),
                models.Call.duration_sec >= lo,
                models.Call.duration_sec < hi,
            )
        ) or 0
        out.append({"bucket": label, "count": count})
    return out


def per_agent(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(
            models.Agent.id,
            models.Agent.name,
            func.count(models.Call.id).label("calls"),
            func.sum(case((models.Call.status == "COMPLETED", 1), else_=0)).label("completed"),
            func.avg(models.Call.duration_sec).label("avg_duration"),
        )
        .outerjoin(models.Call, models.Call.agent_id == models.Agent.id)
        .where(models.Agent.tenant_id == tenant_id)
        .group_by(models.Agent.id, models.Agent.name)
        .order_by(models.Agent.name)
    ).all()
    return [
        {
            "agent_id": r.id,
            "agent_name": r.name,
            "calls": r.calls or 0,
            "completed": int(r.completed or 0),
            "avg_duration_sec": round(float(r.avg_duration or 0), 1),
        }
        for r in rows
    ]


def per_campaign(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(
            models.Campaign.id,
            models.Campaign.name,
            models.Campaign.status,
            func.count(models.Call.id).label("calls"),
            func.sum(case((models.Call.status == "COMPLETED", 1), else_=0)).label("completed"),
        )
        .outerjoin(models.Call, models.Call.campaign_id == models.Campaign.id)
        .where(models.Campaign.tenant_id == tenant_id)
        .group_by(models.Campaign.id, models.Campaign.name, models.Campaign.status)
        .order_by(models.Campaign.name)
    ).all()
    return [
        {
            "campaign_id": r.id,
            "campaign_name": r.name,
            "status": r.status,
            "calls": r.calls or 0,
            "completed": int(r.completed or 0),
        }
        for r in rows
    ]


def lead_funnel(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    stages = ["NEW", "INTERESTED", "NOT_INTERESTED", "QUALIFIED", "CLOSED"]
    out = []
    for stage in stages:
        count = db.scalar(
            select(func.count()).select_from(models.Lead).where(
                models.Lead.tenant_id == tenant_id, models.Lead.status == stage
            )
        ) or 0
        out.append({"stage": stage, "count": count})
    return out


def usage_summary(db: Session, tenant_id: int) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(
            models.UsageEvent.kind,
            func.coalesce(func.sum(models.UsageEvent.units), 0).label("units"),
            func.coalesce(func.sum(models.UsageEvent.cost_estimate), 0).label("cost"),
        )
        .where(models.UsageEvent.tenant_id == tenant_id)
        .group_by(models.UsageEvent.kind)
    ).all()
    return [
        {"kind": r.kind, "units": round(float(r.units), 2), "cost_estimate": round(float(r.cost), 4)}
        for r in rows
    ]
