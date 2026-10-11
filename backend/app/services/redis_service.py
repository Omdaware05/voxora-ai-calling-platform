"""Redis client + realtime broadcaster.

- `get_client()` is None-safe: returns None when Redis is unreachable; the app
  must never crash because Redis is down.
- Realtime event broadcast: Redis pub/sub on channel `voxora:call_events` when
  Redis is reachable, else in-memory asyncio broadcast to local subscribers.

Key conventions:
- call_session:{call_id}      -> JSON call session state
- live_transcript:{call_id}   -> JSON list of segments (append-only)
- ratelimit:agent:{agent_id}:concurrent -> int concurrent-call counter
- active_calls:set             -> Redis set of active call ids
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

CHANNEL = "voxora:call_events"

_client: Optional["redis.Redis"] = None  # type: ignore[name-defined]
_client_failed: bool = False


def get_client():
    """Return a Redis client, or None when Redis is unreachable. Never raises."""
    global _client, _client_failed
    if _client_failed:
        return None
    if _client is not None:
        return _client
    try:
        import redis

        from app.config import get_settings

        client = redis.Redis.from_url(get_settings().REDIS_URL, socket_connect_timeout=2, socket_timeout=2)
        client.ping()
        _client = client
        logger.info("Connected to Redis")
        return _client
    except Exception as exc:  # redis down / not installed -> in-memory fallback
        _client_failed = True
        logger.warning("Redis unreachable, using in-memory fallback: %s", exc)
        return None


def reset_client() -> None:
    global _client, _client_failed
    _client = None
    _client_failed = False


# ----------------------------------------------------------------------------
# Call session helpers
# ----------------------------------------------------------------------------
def set_call_session(call_id: str, data: Dict[str, Any], ttl: int = 86400) -> None:
    client = get_client()
    payload = json.dumps(data)
    if client is not None:
        try:
            client.set(f"call_session:{call_id}", payload, ex=ttl)
            return
        except Exception:
            logger.exception("redis set_call_session failed")
    _memory_kv[f"call_session:{call_id}"] = payload


def get_call_session(call_id: str) -> Optional[Dict[str, Any]]:
    client = get_client()
    raw: Optional[str] = None
    if client is not None:
        try:
            raw = client.get(f"call_session:{call_id}")
        except Exception:
            logger.exception("redis get_call_session failed")
    if raw is None:
        raw = _memory_kv.get(f"call_session:{call_id}")
    return json.loads(raw) if raw else None


def delete_call_session(call_id: str) -> None:
    client = get_client()
    if client is not None:
        try:
            client.delete(f"call_session:{call_id}")
        except Exception:
            logger.exception("redis delete_call_session failed")
    _memory_kv.pop(f"call_session:{call_id}", None)


def add_active_call(call_id: str) -> None:
    client = get_client()
    if client is not None:
        try:
            client.sadd("active_calls:set", call_id)
            return
        except Exception:
            logger.exception("redis sadd failed")
    _memory_active_calls.add(call_id)


def remove_active_call(call_id: str) -> None:
    client = get_client()
    if client is not None:
        try:
            client.srem("active_calls:set", call_id)
            return
        except Exception:
            logger.exception("redis srem failed")
    _memory_active_calls.discard(call_id)


def get_active_call_ids() -> List[str]:
    client = get_client()
    if client is not None:
        try:
            return [c.decode() if isinstance(c, bytes) else c for c in client.smembers("active_calls:set")]
        except Exception:
            logger.exception("redis smembers failed")
    return sorted(_memory_active_calls)


def append_transcript_segment(call_id: str, segment: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Append a transcript segment to the live transcript buffer; return all segments."""
    client = get_client()
    if client is not None:
        try:
            client.rpush(f"live_transcript:{call_id}", json.dumps(segment))
            client.expire(f"live_transcript:{call_id}", 86400)
            items = client.lrange(f"live_transcript:{call_id}", 0, -1)
            return [json.loads(i) for i in items]
        except Exception:
            logger.exception("redis transcript append failed")
    buf = _memory_transcripts.setdefault(call_id, [])
    buf.append(segment)
    return list(buf)


_memory_kv: Dict[str, str] = {}
_memory_active_calls: set[str] = set()
_memory_transcripts: Dict[str, List[Dict[str, Any]]] = {}


# ----------------------------------------------------------------------------
# Broadcaster: redis pub/sub + in-memory asyncio fallback
# ----------------------------------------------------------------------------
_subscribers: set[asyncio.Queue] = set()


async def broadcast(event: Dict[str, Any]) -> None:
    """Broadcast a realtime event to all subscribers.

    Event shape: {"type": "call.created"|"call.updated"|"call.ended"|"transcript.segment", ...}
    """
    message = json.dumps(event)
    client = get_client()
    if client is not None:
        try:
            client.publish(CHANNEL, message)
        except Exception:
            logger.exception("redis publish failed")
    # Always fan out to local in-memory subscribers too (tests + single process)
    for queue in list(_subscribers):
        try:
            queue.put_nowait(event)
        except asyncio.QueueFull:
            pass


def subscribe() -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue(maxsize=200)
    _subscribers.add(queue)
    return queue


def unsubscribe(queue: asyncio.Queue) -> None:
    _subscribers.discard(queue)


async def redis_listener(on_event: Callable[[Dict[str, Any]], Any]) -> None:
    """Background task: forward Redis pub/sub messages into the in-memory bus."""
    client = get_client()
    if client is None:
        return
    try:
        pubsub = client.pubsub()
        pubsub.subscribe(CHANNEL)
        loop = asyncio.get_running_loop()

        def _check() -> None:
            msg = pubsub.get_message(ignore_subscribe_messages=True)
            if msg and msg.get("data"):
                try:
                    event = json.loads(msg["data"])
                    loop.call_soon_threadsafe(asyncio.create_task, on_event(event))
                except Exception:
                    logger.exception("bad pubsub message")

        while True:
            await asyncio.sleep(0.2)
            await loop.run_in_executor(None, _check)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("redis_listener stopped")
