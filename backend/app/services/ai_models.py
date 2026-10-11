"""AI model connectivity tests (STT / LLM / TTS).

`test_connection(type)` performs an HTTP GET against `{base_url}/health` (falling
back to the base URL root) with a short timeout and measures latency.
When no base_url is configured, returns a mock-mode message without network I/O.
"""
from __future__ import annotations

import logging
import time
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

VALID_TYPES = ("stt", "llm", "tts")


def test_connection(model_type: str, base_url: Optional[str], model: Optional[str] = None) -> Dict[str, Any]:
    if model_type not in VALID_TYPES:
        return {"ok": False, "message": f"Unknown model type: {model_type}", "mode": "error"}
    if not base_url:
        return {
            "ok": True,
            "message": f"{model_type.upper()} endpoint not configured — mock mode",
            "mode": "mock",
        }

    base = base_url.rstrip("/")
    candidates = [f"{base}/health", base]
    started = time.perf_counter()
    last_error: str = ""
    for url in candidates:
        try:
            with httpx.Client(timeout=6.0) as client:
                resp = client.get(url)
                latency_ms = int((time.perf_counter() - started) * 1000)
                if resp.status_code < 500:
                    return {
                        "ok": True,
                        "latency_ms": latency_ms,
                        "message": f"{model_type.upper()} endpoint reachable (HTTP {resp.status_code})",
                        "mode": "live",
                        "model": model,
                    }
                last_error = f"HTTP {resp.status_code}"
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
    latency_ms = int((time.perf_counter() - started) * 1000)
    return {
        "ok": False,
        "latency_ms": latency_ms,
        "message": f"{model_type.upper()} endpoint unreachable: {last_error}",
        "mode": "error",
    }
