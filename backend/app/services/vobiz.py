"""VoBiz telephony adapter."""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def test_connection(auth_id: Optional[str], auth_token: Optional[str], api_url: str = "") -> Dict[str, Any]:
    """Test the VoBiz connection.

    - No credentials -> 400-style result {"ok": False, "detail": "VoBiz not configured"}.
    - VOBIZ_API_URL set -> attempt a real HTTP check.
    - Otherwise -> report credentials-present without hitting the network.
    """
    if not auth_id or not auth_token:
        return {"ok": False, "detail": "VoBiz not configured"}

    base_url = (api_url or get_settings().VOBIZ_API_URL).rstrip("/")
    if not base_url:
        return {
            "ok": True,
            "message": "VoBiz credentials present (no API URL configured; live check skipped)",
            "mode": "credentials-present",
        }

    started = time.perf_counter()
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                f"{base_url}/balance",
                auth=(auth_id, auth_token),
            )
            latency_ms = int((time.perf_counter() - started) * 1000)
            if resp.status_code == 200:
                return {"ok": True, "message": "VoBiz connection successful", "latency_ms": latency_ms}
            return {
                "ok": False,
                "message": f"VoBiz responded with HTTP {resp.status_code}",
                "latency_ms": latency_ms,
            }
    except Exception as exc:
        logger.exception("vobiz test_connection failed")
        return {
            "ok": False,
            "message": f"VoBiz connection failed: {exc}",
            "latency_ms": int((time.perf_counter() - started) * 1000),
        }
