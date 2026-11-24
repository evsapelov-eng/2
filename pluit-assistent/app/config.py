"""Конфигурация: секреты из окружения, остальное из config/settings.yaml с переопределением через окружение."""

from __future__ import annotations

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal
from zoneinfo import ZoneInfo

import yaml
from pydantic import BaseModel, Field, SecretStr, ValidationError, field_validator

ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = ROOT / "config"

NotificationMode = Literal["smart", "digest", "quiet"]


class ConfigError(RuntimeError):
    """Ошибка конфигурации. Текст никогда не содержит значений секретов."""


class Secrets(BaseModel):
    telegram_bot_token: SecretStr
    gemini_api_key: SecretStr | None = None
    owner_telegram_id: int
    channel_id: int
    discussion_group_id: int
    state_encryption_key: SecretStr


class Settings(BaseModel):
    timezone: str = "Europe/Moscow"
    channel_username: str = "pluit_club"
    owner_sender_chat_ids: list[int] = Field(default_factory=list)

    gemini_model: str = "gemini-3.7-flash"
    gemini_fallback_model: str = ""
    gemini_timeout_seconds: int = Field(60, ge=5, le=300)
    max_ai_requests_per_run: int = Field(10, ge=0, le=100)
    max_ai_requests_per_day: int = Field(18, ge=0, le=10000)
    max_comments_per_ai_request: int = Field(8, ge=1, le=20)
    max_ai_retries: int = Field(1, ge=0, le=3)
    ai_fallback_after_hours: int = Field(6, ge=0, le=168)

    notification_mode: NotificationMode = "smart"
    notification_threshold: int = Field(70, ge=0, le=100)
    max_recommendations_per_run: int = Field(5, ge=1, le=20)
    recommendation_max_age_hours: int = Field(48, ge=1, le=720)
    daily_summary_enabled: bool = False
    weekly_report_enabled: bool = True
    evening_hour: int = Field(20, ge=0, le=23)
    weekly_report_hour: int = Field(11, ge=0, le=23)
    quiet_hours_start: int = Field(23, ge=0, le=23)
    quiet_hours_end: int = Field(9, ge=0, le=23)
    remind_after_hours: int = Field(3, ge=1, le=72)

    schedule_cron: str = "7 6,9,12,15,18 * * *"  # копия расписания из bot.yml, только для подсказок

    data_retention_days: int = Field(90, ge=7, le=3650)
    interactive_window_seconds: int = Field(90, ge=0, le=600)

    state_backend: Literal["git", "local"] = "git"
    state_branch: str = "bot-state"
    state_local_path: str = ".state/state.enc"

    @field_validator("timezone")
    @classmethod
    def _tz(cls, value: str) -> str:
        ZoneInfo(value)
        return value

    @field_validator("channel_username")
    @classmethod
    def _username(cls, value: str) -> str:
        return value.strip().lstrip("@")

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    def next_check(self, now: datetime) -> datetime | None:
        """Ближайшее плановое время запуска (UTC) по schedule_cron. GitHub может запускать с задержкой."""
        try:
            minute_s, hours_s = self.schedule_cron.split()[:2]
            minute = int(minute_s)
            hours = sorted(int(h) for h in hours_s.split(","))
        except ValueError:
            return None
        now_utc = now.astimezone(UTC)
        for day in range(2):
            base = (now_utc + timedelta(days=day)).replace(minute=minute, second=0, microsecond=0)
            for hour in hours:
                candidate = base.replace(hour=hour)
                if candidate > now_utc:
                    return candidate
        return None

    @property
    def gemini_models(self) -> list[str]:
        models = [self.gemini_model.strip()]
        if self.gemini_fallback_model.strip() and self.gemini_fallback_model.strip() not in models:
            models.append(self.gemini_fallback_model.strip())
        return [m for m in models if m]


class Config(BaseModel):
    secrets: Secrets
    settings: Settings
    author_profile: dict


SECRET_NAMES = (
    "TELEGRAM_BOT_TOKEN",
    "GEMINI_API_KEY",
    "OWNER_TELEGRAM_ID",
    "CHANNEL_ID",
    "DISCUSSION_GROUP_ID",
    "STATE_ENCRYPTION_KEY",
)


def _read_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(data, dict):
        raise ConfigError(f"Файл {path.name} должен содержать словарь настроек.")
    return data


def _env_overrides(env: dict[str, str]) -> dict:
    result: dict = {}
    for name in Settings.model_fields:
        raw = env.get(name.upper())
        if raw is None or raw.strip() == "":
            continue
        if name == "owner_sender_chat_ids":
            result[name] = [int(x) for x in raw.replace(";", ",").split(",") if x.strip()]
        else:
            result[name] = raw.strip()
    return result


def load_settings(env: dict[str, str] | None = None, config_dir: Path = CONFIG_DIR) -> Settings:
    env = dict(os.environ) if env is None else env
    data = _read_yaml(config_dir / "settings.yaml")
    data.update(_env_overrides(env))
    try:
        return Settings.model_validate(data)
    except (ValidationError, ValueError) as exc:
        fields = ", ".join(str(e["loc"][0]) for e in getattr(exc, "errors", lambda: [])()) or "—"
        raise ConfigError(f"Некорректные настройки: {fields}. Проверьте config/settings.yaml.") from None


def load_secrets(env: dict[str, str] | None = None) -> Secrets:
    env = dict(os.environ) if env is None else env
    missing = [n for n in SECRET_NAMES if n != "GEMINI_API_KEY" and not env.get(n, "").strip()]
    if missing:
        raise ConfigError("Не заданы секреты: " + ", ".join(missing) + ".")
    try:
        return Secrets(
            telegram_bot_token=env["TELEGRAM_BOT_TOKEN"].strip(),
            gemini_api_key=(env.get("GEMINI_API_KEY") or "").strip() or None,
            owner_telegram_id=int(env["OWNER_TELEGRAM_ID"]),
            channel_id=int(env["CHANNEL_ID"]),
            discussion_group_id=int(env["DISCUSSION_GROUP_ID"]),
            state_encryption_key=env["STATE_ENCRYPTION_KEY"].strip(),
        )
    except ValueError:
        raise ConfigError("OWNER_TELEGRAM_ID, CHANNEL_ID и DISCUSSION_GROUP_ID должны быть числами.") from None


def load_author_profile(config_dir: Path = CONFIG_DIR) -> dict:
    return _read_yaml(config_dir / "author_profile.yaml")


def load_config(env: dict[str, str] | None = None, config_dir: Path = CONFIG_DIR) -> Config:
    return Config(
        secrets=load_secrets(env),
        settings=load_settings(env, config_dir),
        author_profile=load_author_profile(config_dir),
    )
