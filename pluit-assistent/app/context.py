"""Общий контекст одного запуска."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING

from app.config import Config
from app.storage.database import Database
from app.storage.repositories import AIUsage, Meta, OwnerSettings
from app.telegram.client import TelegramClient
from app.utils.timeutil import Clock, utcnow

if TYPE_CHECKING:
    from app.services.ai_analyzer import AIEngine


@dataclass
class RunStats:
    updates: int = 0
    analyzed: int = 0
    notified: int = 0
    ai_requests: int = 0
    owner_interacted: bool = False


@dataclass
class Context:
    config: Config
    db: Database
    tg: TelegramClient
    ai: AIEngine | None
    checkpoint: Callable[[], Awaitable[None]]
    clock: Clock = utcnow
    stats: RunStats = field(default_factory=RunStats)

    def __post_init__(self) -> None:
        self.meta = Meta(self.db)
        self.settings = OwnerSettings(self.db, self.config.settings)
        self.ai_usage = AIUsage(self.db)

    @property
    def now(self) -> datetime:
        return self.clock()

    @property
    def tz(self):
        return self.config.settings.tz

    @property
    def owner_id(self) -> int:
        return self.config.secrets.owner_telegram_id

    @property
    def group_id(self) -> int:
        return self.config.secrets.discussion_group_id

    @property
    def channel_id(self) -> int:
        return self.config.secrets.channel_id
