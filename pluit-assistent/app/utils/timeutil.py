"""Время хранится в UTC в формате ISO 8601, отображается в часовом поясе владельца."""

from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

Clock = Callable[[], datetime]

# Дневные лимиты Gemini API сбрасываются в полночь по тихоокеанскому времени.
GEMINI_QUOTA_TZ = ZoneInfo("America/Los_Angeles")


def utcnow() -> datetime:
    return datetime.now(UTC)


def to_iso(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat()


def from_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    dt = datetime.fromisoformat(value)
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def from_unix(ts: int | float) -> datetime:
    return datetime.fromtimestamp(ts, UTC)


def local(dt: datetime, tz: ZoneInfo) -> datetime:
    return dt.astimezone(tz)


def fmt_date(dt: datetime | None, tz: ZoneInfo, with_time: bool = True) -> str:
    if dt is None:
        return "—"
    d = dt.astimezone(tz)
    return d.strftime("%d.%m.%Y, %H:%M") if with_time else d.strftime("%d.%m.%Y")


def start_of_local_day(dt: datetime, tz: ZoneInfo) -> datetime:
    d = dt.astimezone(tz)
    return d.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(UTC)


def quota_day(dt: datetime) -> str:
    return dt.astimezone(GEMINI_QUOTA_TZ).strftime("%Y-%m-%d")


def next_quota_reset(dt: datetime) -> datetime:
    d = dt.astimezone(GEMINI_QUOTA_TZ)
    nxt = (d + timedelta(days=1)).replace(hour=0, minute=5, second=0, microsecond=0)
    return nxt.astimezone(UTC)


def in_quiet_hours(dt: datetime, tz: ZoneInfo, start: int, end: int) -> bool:
    hour = dt.astimezone(tz).hour
    if start == end:
        return False
    if start < end:
        return start <= hour < end
    return hour >= start or hour < end


def plural(n: int, one: str, few: str, many: str) -> str:
    n_abs = abs(n) % 100
    if 11 <= n_abs <= 14:
        return many
    last = n_abs % 10
    if last == 1:
        return one
    if 2 <= last <= 4:
        return few
    return many


def human_duration(seconds: float) -> str:
    minutes = int(seconds // 60)
    if minutes < 60:
        return f"{max(minutes, 1)} мин"
    hours = minutes // 60
    if hours < 48:
        rest = minutes % 60
        return f"{hours} ч {rest} мин" if rest and hours < 10 else f"{hours} ч"
    return f"{hours // 24} дн"
