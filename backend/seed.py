"""Seed demo data. Idempotent: safe to run multiple times.

Usage:  cd backend && .venv/bin/python seed.py
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")

from app import models  # noqa: E402
from app.database import Base, SessionLocal, engine  # noqa: E402
from app.security import hash_password  # noqa: E402

DEMO_EMAILS = {"admin@voxora.demo": "ADMIN", "member@voxora.demo": "MEMBER"}
DEMO_PASSWORD = "demo1234"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def get_or_create_tenant(db) -> models.Tenant:
    tenant = db.query(models.Tenant).filter(models.Tenant.name == "Acme Demo Corp").first()
    if tenant is None:
        tenant = models.Tenant(
            name="Acme Demo Corp",
            industry="E-commerce",
            timezone="Asia/Kolkata",
            languages=["en", "hi"],
            status="active",
            is_demo=True,
        )
        db.add(tenant)
        db.flush()
        print("created tenant Acme Demo Corp")
    return tenant


def seed_users(db, tenant: models.Tenant) -> None:
    names = {"admin@voxora.demo": "Demo Admin", "member@voxora.demo": "Demo Member"}
    for email, role in DEMO_EMAILS.items():
        user = db.query(models.User).filter(models.User.email == email).first()
        if user is None:
            db.add(
                models.User(
                    tenant_id=tenant.id,
                    email=email,
                    name=names[email],
                    password_hash=hash_password(DEMO_PASSWORD),
                    role=role,
                    is_active=True,
                )
            )
            print(f"created user {email}")


def seed_agents(db, tenant: models.Tenant) -> list[models.Agent]:
    specs = [
        {
            "name": "Aarav — Customer Support",
            "description": "Handles post-purchase support calls in English and Hindi.",
            "purpose": "Resolve customer support queries, track orders, and escalate complaints.",
            "language": "en",
            "supported_languages": ["en", "hi"],
            "tone": "empathetic",
            "personality": "Patient, polite and solution-oriented. Speaks clearly and never rushes the caller.",
            "system_prompt": (
                "You are Aarav, a customer support voice agent for Acme Demo Corp, an e-commerce company. "
                "Greet the customer warmly, identify their issue, and resolve it using the available tools. "
                "If you cannot resolve the issue, promise a callback and escalate to a human supervisor. "
                "Never invent order details. Keep responses short and conversational."
            ),
            "greeting": "Hello! This is Aarav from Acme Demo Corp. How can I help you today?",
            "closing_behavior": "Thank the customer, summarize the resolution, and wish them a good day.",
            "safety_rules": "Never share internal system details. Never promise refunds beyond policy.",
            "voice": {"provider": "kokoro", "voice": "af_heart", "speed": 1.0},
            "concurrency": 5,
        },
        {
            "name": "Priya — Sales Outreach",
            "description": "Outbound sales agent for lead qualification and demos.",
            "purpose": "Qualify inbound leads and book product demos.",
            "language": "en",
            "supported_languages": ["en", "hi"],
            "tone": "enthusiastic",
            "personality": "Confident, warm and persuasive without being pushy.",
            "system_prompt": (
                "You are Priya, a sales development voice agent for Acme Demo Corp. "
                "Your goal is to qualify the lead using the qualification questionnaire and book a demo "
                "with the sales team. Ask one question at a time. If the lead is not interested, "
                "thank them politely and end the call."
            ),
            "greeting": "Hi! This is Priya from Acme Demo Corp. Do you have two minutes to talk about how we can help your business?",
            "closing_behavior": "Confirm the demo slot and send details via SMS.",
            "safety_rules": "Do not make pricing commitments. Do not disparage competitors.",
            "voice": {"provider": "kokoro", "voice": "af_sarah", "speed": 1.05},
            "concurrency": 8,
        },
        {
            "name": "Rohan — Feedback Survey",
            "description": "Post-interaction CSAT survey agent.",
            "purpose": "Collect customer satisfaction feedback after support interactions.",
            "language": "en",
            "supported_languages": ["en", "hi"],
            "tone": "friendly",
            "personality": "Cheerful and brief. Respects the caller's time.",
            "system_prompt": (
                "You are Rohan, a feedback survey voice agent for Acme Demo Corp. "
                "Ask the customer the satisfaction survey questions one by one. "
                "Keep the call under two minutes. Thank them at the end."
            ),
            "greeting": "Hello! This is Rohan from Acme Demo Corp. May I ask you three quick questions about your recent experience?",
            "closing_behavior": "Thank the customer for their time and feedback.",
            "safety_rules": "Do not argue with negative feedback; acknowledge it gracefully.",
            "voice": {"provider": "kokoro", "voice": "am_adam", "speed": 1.0},
            "concurrency": 10,
        },
    ]
    agents = []
    for spec in specs:
        agent = (
            db.query(models.Agent)
            .filter(models.Agent.tenant_id == tenant.id, models.Agent.name == spec["name"])
            .first()
        )
        if agent is None:
            agent = models.Agent(tenant_id=tenant.id, is_demo=True, **spec)
            db.add(agent)
            db.flush()
            print(f"created agent {spec['name']}")
        agents.append(agent)
    return agents


def seed_questionnaires(db, tenant: models.Tenant) -> list[models.Questionnaire]:
    csat_questions = [
        {"key": "overall_rating", "label": "Overall, how would you rate your experience?", "type": "rating",
         "required": True, "order": 1, "options": ["1", "2", "3", "4", "5"]},
        {"key": "issue_resolved", "label": "Was your issue resolved?", "type": "boolean",
         "required": True, "order": 2, "expected_answer": "yes"},
        {"key": "agent_politeness", "label": "How polite was our agent?", "type": "rating",
         "required": False, "order": 3, "options": ["1", "2", "3", "4", "5"]},
        {"key": "wait_time_ok", "label": "Was the wait time acceptable?", "type": "boolean",
         "required": False, "order": 4},
        {"key": "recommend", "label": "Would you recommend us to a friend?", "type": "single_choice",
         "required": True, "order": 5, "options": ["Definitely", "Maybe", "No"]},
        {"key": "feedback", "label": "Any additional feedback for us?", "type": "text",
         "required": False, "order": 6},
    ]
    qual_questions = [
        {"key": "full_name", "label": "What is your full name?", "type": "text", "required": True, "order": 1},
        {"key": "company", "label": "Which company are you with?", "type": "text", "required": True, "order": 2},
        {"key": "role", "label": "What is your role?", "type": "text", "required": False, "order": 3},
        {"key": "team_size", "label": "How large is your team?", "type": "single_choice", "required": True,
         "order": 4, "options": ["1-10", "11-50", "51-200", "200+"]},
        {"key": "budget", "label": "Do you have a budget allocated for this?", "type": "boolean",
         "required": True, "order": 5, "expected_answer": "yes"},
        {"key": "timeline", "label": "When are you looking to decide?", "type": "single_choice",
         "required": False, "order": 6, "options": ["Immediately", "This quarter", "Next quarter", "Just exploring"]},
        {"key": "demo_slot", "label": "What time works for a demo?", "type": "text", "required": False, "order": 7},
    ]
    specs = [
        ("Customer Satisfaction Survey", "Post-call CSAT survey for support interactions.", csat_questions),
        ("Lead Qualification", "BANT-style qualification for outbound sales.", qual_questions),
    ]
    out = []
    for title, desc, questions in specs:
        q = (
            db.query(models.Questionnaire)
            .filter(models.Questionnaire.tenant_id == tenant.id, models.Questionnaire.title == title)
            .first()
        )
        if q is None:
            q = models.Questionnaire(
                tenant_id=tenant.id, title=title, description=desc,
                status="published", questions=questions, is_demo=True,
            )
            db.add(q)
            db.flush()
            print(f"created questionnaire {title}")
        out.append(q)
    return out


def seed_contacts(db, tenant: models.Tenant) -> list[models.Contact]:
    people = [
        ("Aarav Sharma", "+919812345678", "aarav.sharma@example.in", ["vip", "mumbai"]),
        ("Priya Patel", "+919876543210", "priya.patel@example.in", ["delhi"]),
        ("Rohan Verma", "+919123456789", "rohan.verma@example.in", ["bangalore"]),
        ("Sneha Iyer", "+919234567890", "sneha.iyer@example.in", ["chennai", "vip"]),
        ("Vikram Singh", "+919345678901", "vikram.singh@example.in", ["delhi"]),
        ("Ananya Gupta", "+919456789012", "ananya.gupta@example.in", ["kolkata"]),
        ("Karan Mehta", "+919567890123", "karan.mehta@example.in", ["mumbai"]),
        ("Divya Nair", "+919678901234", "divya.nair@example.in", ["kochi"]),
        ("Arjun Reddy", "+919789012345", "arjun.reddy@example.in", ["hyderabad"]),
        ("Kavya Joshi", "+919890123456", "kavya.joshi@example.in", ["pune", "vip"]),
    ]
    contacts = []
    for name, phone, email, tags in people:
        c = (
            db.query(models.Contact)
            .filter(models.Contact.tenant_id == tenant.id, models.Contact.phone == phone)
            .first()
        )
        if c is None:
            c = models.Contact(
                tenant_id=tenant.id, name=name, phone=phone, email=email,
                status="active", tags=tags, is_demo=True,
            )
            db.add(c)
            db.flush()
            print(f"created contact {name}")
        contacts.append(c)
    return contacts


def seed_campaign(db, tenant: models.Tenant, agents: list[models.Agent],
                  contacts: list[models.Contact]) -> models.Campaign:
    campaign = (
        db.query(models.Campaign)
        .filter(models.Campaign.tenant_id == tenant.id, models.Campaign.name == "Diwali Outreach 2026")
        .first()
    )
    if campaign is None:
        campaign = models.Campaign(
            tenant_id=tenant.id,
            name="Diwali Outreach 2026",
            description="Festive-season outbound campaign for premium customers.",
            agent_id=agents[1].id,
            concurrency=3,
            caller_id="+911800123456",
            status="CREATED",
            is_demo=True,
        )
        db.add(campaign)
        db.flush()
        for contact in contacts:
            db.add(models.CampaignContact(campaign_id=campaign.id, contact_id=contact.id, status="PENDING"))
        print("created campaign Diwali Outreach 2026 with contacts")
    return campaign


def seed_calls(db, tenant: models.Tenant, agents: list[models.Agent],
               contacts: list[models.Contact], campaign: models.Campaign) -> list[models.Call]:
    existing = db.query(models.Call).filter(models.Call.tenant_id == tenant.id, models.Call.is_demo.is_(True)).count()
    if existing:
        print(f"calls already seeded ({existing}); skipping")
        return []
    statuses = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED",
                "BUSY", "NO_ANSWER", "FAILED", "COMPLETED", "COMPLETED", "IN_PROGRESS"]
    dispositions = ["interested", "not_interested", "follow_up", "interested", "qualified",
                    "not_interested", None, None, None, "follow_up", "interested", None]
    calls = []
    base = utcnow() - timedelta(days=6)
    for i, (st, disp) in enumerate(zip(statuses, dispositions)):
        started = base + timedelta(hours=i * 11)
        duration = 45 + (i * 37) % 240 if st == "COMPLETED" else None
        call = models.Call(
            tenant_id=tenant.id,
            agent_id=agents[i % len(agents)].id,
            contact_id=contacts[i % len(contacts)].id,
            campaign_id=campaign.id if i < 8 else None,
            phone=contacts[i % len(contacts)].phone,
            direction="outbound",
            status=st,
            started_at=started,
            ended_at=started + timedelta(seconds=duration) if duration else None,
            duration_sec=duration,
            disposition=disp,
            dograh_run_id=f"mock-run-demo-{i:03d}",
            is_demo=True,
        )
        db.add(call)
        db.flush()
        db.add(models.CallEvent(call_id=call.id, type="call.initiating", payload={"phone": call.phone}))
        db.add(models.CallEvent(call_id=call.id, type=f"call.{st.lower()}",
                                payload={"mode": "mock", "disposition": disp}))
        if st == "COMPLETED":
            db.add(models.TranscriptSegment(call_id=call.id, speaker="ai",
                                            text="Hello! This is Aarav from Acme Demo Corp. How can I help you today?",
                                            offset_sec=0.0))
            db.add(models.TranscriptSegment(call_id=call.id, speaker="customer",
                                            text="Hi, I wanted to check the status of my order.",
                                            offset_sec=4.5))
            db.add(models.TranscriptSegment(call_id=call.id, speaker="ai",
                                            text="Of course, I can help with that right away.",
                                            offset_sec=9.0))
            db.add(models.Transcript(call_id=call.id,
                                     full_text="AI: Hello! This is Aarav from Acme Demo Corp. "
                                               "Customer: Hi, I wanted to check the status of my order. "
                                               "AI: Of course, I can help with that right away.",
                                     summary="Customer asked about order status; agent offered help.",
                                     language="en"))
        calls.append(call)
    print(f"created {len(calls)} demo calls")
    return calls


def seed_leads(db, tenant: models.Tenant, agents: list[models.Agent],
               campaign: models.Campaign, calls: list[models.Call]) -> None:
    existing = db.query(models.Lead).filter(models.Lead.tenant_id == tenant.id, models.Lead.is_demo.is_(True)).count()
    if existing:
        print(f"leads already seeded ({existing}); skipping")
        return
    specs = [
        ("Aarav Sharma", "+919812345678", 82.5, "INTERESTED", "Asked for pricing details", 0),
        ("Sneha Iyer", "+919234567890", 91.0, "QUALIFIED", "Budget confirmed, demo booked", 1),
        ("Vikram Singh", "+919345678901", 35.0, "NOT_INTERESTED", "Not looking to switch vendors", 0),
        ("Kavya Joshi", "+919890123456", 68.0, "NEW", "Callback requested", 2),
    ]
    for i, (name, phone, score, st, reason, agent_idx) in enumerate(specs):
        db.add(models.Lead(
            tenant_id=tenant.id, name=name, phone=phone, score=score, status=st, reason=reason,
            agent_id=agents[agent_idx].id, campaign_id=campaign.id,
            call_id=calls[i].id if i < len(calls) else None, is_demo=True,
        ))
    print("created 4 demo leads")


def seed_followups(db, tenant: models.Tenant, contacts: list[models.Contact],
                   agents: list[models.Agent]) -> None:
    existing = db.query(models.Followup).filter(models.Followup.tenant_id == tenant.id).count()
    if existing:
        print(f"followups already seeded ({existing}); skipping")
        return
    specs = [
        (contacts[0], agents[0], 1, "Call back about order #4821", "PENDING"),
        (contacts[3], agents[1], 2, "Demo follow-up", "SCHEDULED"),
        (contacts[5], agents[0], -2, "Missed callback", "PENDING"),
    ]
    for contact, agent, days_offset, notes, st in specs:
        db.add(models.Followup(
            tenant_id=tenant.id, contact_id=contact.id, agent_id=agent.id,
            scheduled_at=utcnow() + timedelta(days=days_offset), notes=notes, status=st,
        ))
    print("created 3 demo follow-ups")


def seed_telephony(db, tenant: models.Tenant) -> None:
    cfg = (
        db.query(models.TelephonyConfig)
        .filter(models.TelephonyConfig.tenant_id == tenant.id, models.TelephonyConfig.provider == "vobiz")
        .first()
    )
    if cfg is None:
        db.add(models.TelephonyConfig(
            tenant_id=tenant.id, provider="vobiz", auth_id=None, auth_token_encrypted=None,
            from_number=None, is_default=True, status="not_configured", settings={},
        ))
        print("created vobiz telephony placeholder (no secrets)")


def seed_model_configs(db, tenant: models.Tenant) -> None:
    specs = [
        ("stt", "speaches", "whisper-large-v3-turbo", "http://localhost:8005/v1", None, None),
        ("llm", "openai-compatible", "qwen3.5-9b", "http://localhost:8006/v1", None, None),
        ("tts", "speaches", "kokoro", "http://localhost:8007/v1", None, "af_heart"),
    ]
    for mtype, provider, model, base_url, language, voice in specs:
        cfg = (
            db.query(models.ModelConfig)
            .filter(models.ModelConfig.tenant_id == tenant.id, models.ModelConfig.type == mtype)
            .first()
        )
        if cfg is None:
            db.add(models.ModelConfig(
                tenant_id=tenant.id, type=mtype, provider=provider, model=model,
                base_url=base_url, api_key_encrypted=None, language=language, voice=voice,
                speed=1.0, temperature=0.7, max_tokens=512, extra={},
            ))
            print(f"created model config {mtype} (no API key)")


def main() -> None:
    Base.metadata.create_all(bind=engine)  # ensure tables exist for direct seed runs
    db = SessionLocal()
    try:
        tenant = get_or_create_tenant(db)
        seed_users(db, tenant)
        agents = seed_agents(db, tenant)
        seed_questionnaires(db, tenant)
        contacts = seed_contacts(db, tenant)
        campaign = seed_campaign(db, tenant, agents, contacts)
        calls = seed_calls(db, tenant, agents, contacts, campaign)
        seed_leads(db, tenant, agents, campaign, calls)
        seed_followups(db, tenant, contacts, agents)
        seed_telephony(db, tenant)
        seed_model_configs(db, tenant)
        db.commit()
        print("seed complete")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
