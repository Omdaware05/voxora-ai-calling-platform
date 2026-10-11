"""Recording storage: local filesystem or MinIO (via boto3).

- MinIO is used when MINIO_ENDPOINT is set.
- Otherwise bytes are stored under DATA_DIR/recordings (local backend).
- `get_recording_file()` resolves a recording to a real file path for FileResponse.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)


def _local_dir() -> Path:
    d = Path(get_settings().DATA_DIR) / "recordings"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _minio_client():
    import boto3

    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=("https://" if settings.MINIO_SECURE else "http://") + settings.MINIO_ENDPOINT,
        aws_access_key_id=settings.MINIO_ACCESS_KEY,
        aws_secret_access_key=settings.MINIO_SECRET_KEY,
        region_name="us-east-1",
    )


def _use_minio() -> bool:
    settings = get_settings()
    return bool(settings.MINIO_ENDPOINT)


def put_recording(key: str, data: bytes, mime: str = "audio/wav") -> str:
    """Store recording bytes; return the storage key."""
    if _use_minio():
        try:
            client = _minio_client()
            settings = get_settings()
            client.put_object(Bucket=settings.MINIO_BUCKET, Key=key, Body=data, ContentType=mime)
            return key
        except Exception:
            logger.exception("minio put_recording failed; falling back to local")
    path = _local_dir() / key
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return key


def get_recording_bytes(key: str) -> Optional[bytes]:
    if _use_minio():
        try:
            client = _minio_client()
            settings = get_settings()
            obj = client.get_object(Bucket=settings.MINIO_BUCKET, Key=key)
            return obj["Body"].read()
        except Exception:
            logger.exception("minio get_recording failed; trying local")
    path = _local_dir() / key
    if path.is_file():
        return path.read_bytes()
    return None


def get_recording_file(key: str) -> Optional[str]:
    """Resolve a recording to a local file path usable with FileResponse.

    For MinIO, the object is downloaded to a temp path first.
    Returns None when the recording does not exist.
    """
    if _use_minio():
        data = get_recording_bytes(key)
        if data is None:
            return None
        tmp = Path(get_settings().DATA_DIR) / "tmp" / key
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_bytes(data)
        return str(tmp)
    path = _local_dir() / key
    return str(path) if path.is_file() else None


def delete_recording(key: str) -> None:
    if _use_minio():
        try:
            _minio_client().delete_object(Bucket=get_settings().MINIO_BUCKET, Key=key)
            return
        except Exception:
            logger.exception("minio delete_recording failed")
    try:
        os.remove(_local_dir() / key)
    except FileNotFoundError:
        pass
