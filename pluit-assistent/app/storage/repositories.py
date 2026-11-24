"""Небольшие хранилища поверх SQLite: служебные значения, настройки владельца, учёт AI-запросов."""

from __future__ import annotations

import json
from typing import Any

from app.config import Settings
from app.storage.database import Database

# Настройки, которые владелец меняет в меню. Значение в БД перекрывает config/settings.yaml.
OWNER_SETTINGS: dict[str, type] = {
    "notification_mode": str,
    "notification_threshold": int,
    "max_recommendations_per_run": int,
    "daily_summary_enabled": bool,
    "weekly_report_enabled": bool,
    "data_retention_days": int,
    "reply_length": str,  # short | normal
    "reply_address": str,  # auto | ty | vy
    "ai_paused": bool,
    "notifications_paused": bool,
}

DEFAULTS_EXTRA: dict[str, Any] = {
    "reply_length": "normal",
    "reply_address": "auto",
    "ai_paused": False,
    "notifications_paused": False,
}


class Meta:
    def __init__(self, db: Database):
        self.db = db

    def get(self, key: str, default: str | None = None) -> str | None:
        value = self.db.scalar("SELECT value FROM meta WHERE key=?", (key,))
        return default if value is None else value

    def set(self, key: str, value: Any) -> None:
        self.db.execute(
            "INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, None if value is None else str(value)),
        )

    def get_int(self, key: str, default: int = 0) -> int:
        value = self.get(key)
        return default if value is None else int(value)


class OwnerSettings:
    """Действующие настройки: значение владельца из БД или значение из конфигурации."""

    def __init__(self, db: Database, base: Settings):
        self.db = db
        self.base = base

    def get(self, key: str) -> Any:
        kind = OWNER_SETTINGS[key]
        raw = self.db.scalar("SELECT value FROM settings WHERE key=?", (key,))
        if raw is not None:
            value = json.loads(raw)
            return bool(value) if kind is bool else kind(value)
        if key in DEFAULTS_EXTRA:
            return DEFAULTS_EXTRA[key]
        return getattr(self.base, key)

    def set(self, key: str, value: Any) -> None:
        if key not in OWNER_SETTINGS:
            raise KeyError(key)
        self.db.execute(
            "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, json.dumps(value)),
        )

    def __getattr__(self, key: str) -> Any:
        if key in OWNER_SETTINGS:
            return self.get(key)
        raise AttributeError(key)


class AIUsage:
    def __init__(self, db: Database):
        self.db = db

    def count(self, day: str, model: str | None = None) -> int:
        if model is None:
            return int(self.db.scalar("SELECT COALESCE(SUM(requests),0) FROM ai_usage WHERE day=?", (day,)))
        return int(
            self.db.scalar("SELECT COALESCE(requests,0) FROM ai_usage WHERE day=? AND model=?", (day, model)) or 0
        )

    def add(self, day: str, model: str) -> None:
        self.db.execute(
            "INSERT INTO ai_usage(day, model, requests) VALUES(?, ?, 1) "
            "ON CONFLICT(day, model) DO UPDATE SET requests=requests+1",
            (day, model),
        )
        self.db.execute("DELETE FROM ai_usage WHERE day < date(?, '-40 days')", (day,))
