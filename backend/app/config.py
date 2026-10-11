"""Application configuration via environment variables (pydantic-settings).

Nothing is required to import the app: every setting has a sane dev default.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- Core ---
    SECRET_KEY: str = Field(default="voxora-dev-secret-key-change-in-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: str = "sqlite:///./voxora.db"
    REDIS_URL: str = "redis://localhost:6379/0"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    DEMO_MODE: bool = False
    AUTO_CREATE_TABLES: bool = False
    APP_VERSION: str = "0.1.0"
    RATE_LIMIT_PER_MINUTE: int = 120
    RATE_LIMIT_LOGIN_PER_MINUTE: int = 15

    # --- Storage ---
    STORAGE_BACKEND: str = "local"  # local | minio
    DATA_DIR: str = "./data"
    MINIO_ENDPOINT: str = ""
    MINIO_ACCESS_KEY: str = ""
    MINIO_SECRET_KEY: str = ""
    MINIO_BUCKET: str = "voxora-recordings"
    MINIO_SECURE: bool = False

    # --- Dograh (voice agent orchestration) ---
    DOGRAH_BASE_URL: str = ""
    DOGRAH_API_KEY: str = ""
    DOGRAH_MPS_KEY: str = ""

    # --- VoBiz (telephony) ---
    VOBIZ_AUTH_ID: str = ""
    VOBIZ_AUTH_TOKEN: str = ""
    VOBIZ_FROM_NUMBER: str = ""
    VOBIZ_API_URL: str = ""

    # --- AI models ---
    WHISPER_STT_URL: str = ""
    WHISPER_MODEL: str = "whisper-large-v3-turbo"
    LLM_BASE_URL: str = ""
    LLM_MODEL: str = ""
    KOKORO_TTS_URL: str = ""
    KOKORO_MODEL: str = "kokoro"
    KOKORO_VOICE: str = ""

    # --- Billing ---
    COST_PER_MIN: float = 0.05

    @property
    def cors_origins(self) -> List[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def dograh_mock_mode(self) -> bool:
        return not bool(self.DOGRAH_BASE_URL)


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.SECRET_KEY == Settings.model_fields["SECRET_KEY"].default:
        # NOTE: dev default key in use
        logging.getLogger(__name__).warning(
            "Using default SECRET_KEY. Set SECRET_KEY in production!"
        )
    return settings
