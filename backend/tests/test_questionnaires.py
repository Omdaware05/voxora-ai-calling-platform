"""Tests: questionnaires CRUD, publish/archive, import xlsx, template."""
from __future__ import annotations

import io

from openpyxl import Workbook


def _make_questionnaire(client, admin_headers, title="Survey"):
    resp = client.post("/api/v1/questionnaires", headers=admin_headers, json={
        "title": title,
        "description": "desc",
        "questions": [
            {"key": "q1", "label": "Rate us", "type": "rating", "required": True, "order": 1,
             "options": ["1", "2", "3", "4", "5"]},
        ],
    })
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_questionnaire_crud(client, admin_headers):
    q = _make_questionnaire(client, admin_headers, title="CRUD Survey")
    qid = q["id"]
    assert q["status"] == "draft"
    got = client.get(f"/api/v1/questionnaires/{qid}", headers=admin_headers)
    assert got.json()["title"] == "CRUD Survey"
    upd = client.put(f"/api/v1/questionnaires/{qid}", headers=admin_headers,
                     json={"title": "CRUD Survey v2"})
    assert upd.json()["title"] == "CRUD Survey v2"
    dele = client.delete(f"/api/v1/questionnaires/{qid}", headers=admin_headers)
    assert dele.status_code == 204
    assert client.get(f"/api/v1/questionnaires/{qid}", headers=admin_headers).status_code == 404


def test_questionnaire_publish_archive(client, admin_headers):
    q = _make_questionnaire(client, admin_headers, title="Lifecycle Survey")
    qid = q["id"]
    pub = client.post(f"/api/v1/questionnaires/{qid}/publish", headers=admin_headers)
    assert pub.json()["status"] == "published"
    # filter by status
    listed = client.get("/api/v1/questionnaires?status=published", headers=admin_headers).json()
    assert any(x["id"] == qid for x in listed["items"])
    arch = client.post(f"/api/v1/questionnaires/{qid}/archive", headers=admin_headers)
    assert arch.json()["status"] == "archived"
    # archived cannot be published
    bad = client.post(f"/api/v1/questionnaires/{qid}/publish", headers=admin_headers)
    assert bad.status_code == 400


def test_questionnaire_duplicate(client, admin_headers):
    q = _make_questionnaire(client, admin_headers, title="Dup Survey")
    dup = client.post(f"/api/v1/questionnaires/{q['id']}/duplicate", headers=admin_headers)
    assert dup.status_code == 201
    assert dup.json()["title"] == "Dup Survey (copy)"
    assert dup.json()["status"] == "draft"


def test_questionnaire_versions(client, admin_headers):
    q = _make_questionnaire(client, admin_headers, title="Versioned Survey")
    qid = q["id"]
    versions = client.get(f"/api/v1/questionnaires/{qid}/versions", headers=admin_headers).json()
    assert len(versions) >= 1  # created snapshot
    client.put(f"/api/v1/questionnaires/{qid}", headers=admin_headers, json={"title": "Versioned Survey v2"})
    versions = client.get(f"/api/v1/questionnaires/{qid}/versions", headers=admin_headers).json()
    assert len(versions) >= 2


def test_questionnaire_template(client, admin_headers):
    resp = client.get("/api/v1/questionnaires/template", headers=admin_headers)
    assert resp.status_code == 200
    assert "spreadsheet" in resp.headers["content-type"]
    assert len(resp.content) > 1000


def _build_import_workbook() -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(["title", "Imported Survey"])
    ws.append(["description", "imported via xlsx"])
    ws.append([])
    ws.append(["key", "label", "description", "type", "required", "order", "options", "expected_answer"])
    ws.append(["q1", "How was it?", "", "rating", "TRUE", 1, "1,2,3,4,5", ""])
    ws.append(["q2", "Comments?", "", "text", "FALSE", 2, "", ""])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_questionnaire_import_xlsx(client, admin_headers):
    data = _build_import_workbook()
    resp = client.post("/api/v1/questionnaires/import", headers=admin_headers,
                       files={"file": ("survey.xlsx", data,
                                       "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")})
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "Imported Survey"
    assert len(body["questions"]) == 2
    assert body["questions"][0]["key"] == "q1"
    assert body["questions"][0]["required"] is True


def test_questionnaire_import_rejects_non_xlsx(client, admin_headers):
    resp = client.post("/api/v1/questionnaires/import", headers=admin_headers,
                       files={"file": ("survey.txt", b"hello", "text/plain")})
    assert resp.status_code == 400
