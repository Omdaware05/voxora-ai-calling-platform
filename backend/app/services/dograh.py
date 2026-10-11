"""Dograh voice-agent orchestration client.

Mock mode: when DOGRAH_BASE_URL is unset, every method returns plausible
results clearly marked with "mode": "mock". Never hardcode localhost URLs —
the base URL always comes from settings.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Dict, List, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


class DograhClient:
    def __init__(self, base_url: str = "", api_key: str = "", mps_key: str = "") -> None:
        settings = get_settings()
        self.base_url = (base_url or settings.DOGRAH_BASE_URL).rstrip("/")
        self.api_key = api_key or settings.DOGRAH_API_KEY
        self.mps_key = mps_key or settings.DOGRAH_MPS_KEY

    @property
    def mock(self) -> bool:
        return not self.base_url

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        if self.mps_key:
            headers["X-MPS-Key"] = self.mps_key
        return headers

    def _mock(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        payload["mode"] = "mock"
        return payload

    # ------------------------------------------------------------------
    async def health(self) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "message": "Dograh mock mode (DOGRAH_BASE_URL not set)"})
        started = time.perf_counter()
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/health", headers=self._headers())
                latency_ms = int((time.perf_counter() - started) * 1000)
                return {"ok": resp.status_code < 500, "status_code": resp.status_code, "latency_ms": latency_ms}
        except Exception as exc:
            return {"ok": False, "message": str(exc), "latency_ms": int((time.perf_counter() - started) * 1000)}

    async def sync_agents(self) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "synced": 0, "agents": []})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/v1/agents", headers=self._headers())
                resp.raise_for_status()
                data = resp.json()
                agents = data.get("agents", data) if isinstance(data, dict) else data
                return {"ok": True, "synced": len(agents) if isinstance(agents, list) else 0, "agents": agents}
        except Exception as exc:
            logger.exception("dograh sync_agents failed")
            return {"ok": False, "message": str(exc)}

    async def initiate_call(
        self,
        agent_id: str,
        phone: str,
        caller_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if self.mock:
            run_id = f"mock-run-{uuid.uuid4().hex[:12]}"
            return self._mock(
                {
                    "ok": True,
                    "run_id": run_id,
                    "status": "IN_PROGRESS",
                    "message": "Mock call initiated",
                }
            )
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/runs",
                    headers=self._headers(),
                    json={
                        "agent_id": agent_id,
                        "to": phone,
                        "from": caller_id,
                        "metadata": metadata or {},
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return {"ok": True, **data}
        except Exception as exc:
            logger.exception("dograh initiate_call failed")
            return {"ok": False, "message": str(exc)}

    async def terminate_call(self, run_id: str) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "run_id": run_id, "status": "COMPLETED"})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/runs/{run_id}/stop", headers=self._headers()
                )
                resp.raise_for_status()
                return {"ok": True, **resp.json()}
        except Exception as exc:
            logger.exception("dograh terminate_call failed")
            return {"ok": False, "message": str(exc)}

    async def run_status(self, run_id: str) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "run_id": run_id, "status": "IN_PROGRESS"})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/v1/runs/{run_id}", headers=self._headers())
                resp.raise_for_status()
                return {"ok": True, **resp.json()}
        except Exception as exc:
            logger.exception("dograh run_status failed")
            return {"ok": False, "message": str(exc)}

    async def list_workflows(self) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "workflows": []})
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{self.base_url}/v1/workflows", headers=self._headers())
                resp.raise_for_status()
                return {"ok": True, **resp.json()}
        except Exception as exc:
            logger.exception("dograh list_workflows failed")
            return {"ok": False, "message": str(exc)}

    async def create_workflow(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        if self.mock:
            wf_id = f"mock-wf-{uuid.uuid4().hex[:12]}"
            return self._mock({"ok": True, "id": wf_id, **payload})
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/workflows", headers=self._headers(), json=payload
                )
                resp.raise_for_status()
                return {"ok": True, **resp.json()}
        except Exception as exc:
            logger.exception("dograh create_workflow failed")
            return {"ok": False, "message": str(exc)}

    async def publish_workflow(self, workflow_id: str) -> Dict[str, Any]:
        if self.mock:
            return self._mock({"ok": True, "id": workflow_id, "status": "published"})
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.base_url}/v1/workflows/{workflow_id}/publish", headers=self._headers()
                )
                resp.raise_for_status()
                return {"ok": True, **resp.json()}
        except Exception as exc:
            logger.exception("dograh publish_workflow failed")
            return {"ok": False, "message": str(exc)}

    async def list_runs(self, limit: int = 20) -> List[Dict[str, Any]]:
        if self.mock:
            return []
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{self.base_url}/v1/runs", headers=self._headers(), params={"limit": limit}
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("runs", []) if isinstance(data, dict) else data
        except Exception:
            logger.exception("dograh list_runs failed")
            return []
