"""Аналитика только по реальным данным, накопленным ботом.

Охваты, просмотры и число подписчиков бот не видит и не показывает.
"""

from __future__ import annotations

import json
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.context import Context
from app.schemas.analysis import QUESTION_CATEGORIES
from app.utils.text import post_title
from app.utils.timeutil import from_iso, start_of_local_day, to_iso

PERIODS = {"t": "Сегодня", "7": "Последние 7 дней", "30": "Последние 30 дней", "all": "Всё время"}
SPARK = "▁▂▃▄▅▆▇█"


@dataclass
class Stats:
    start: datetime | None
    end: datetime
    comments: int = 0
    commenters: int = 0
    author_replies: int = 0
    unanswered_questions: int = 0
    avg_response_seconds: float | None = None
    top_posts: list[tuple[str, int]] = field(default_factory=list)
    topics: list[tuple[str, int]] = field(default_factory=list)
    daily: list[int] = field(default_factory=list)
    previous_comments: int | None = None


def period_bounds(ctx: Context, period: str) -> tuple[datetime | None, datetime]:
    now = ctx.now
    if period == "t":
        return start_of_local_day(now, ctx.tz), now
    if period in ("7", "30"):
        days = int(period)
        return start_of_local_day(now - timedelta(days=days - 1), ctx.tz), now
    return None, now


def collect(ctx: Context, start: datetime | None, end: datetime, *, with_daily: bool = True) -> Stats:
    db = ctx.db
    s = to_iso(start) if start else "0000"
    e = to_iso(end)
    where = "m.date >= ? AND m.date < ?"
    st = Stats(start=start, end=end)
    st.comments = int(db.scalar(f"SELECT COUNT(*) FROM messages m WHERE author_kind='subscriber' AND {where}", (s, e)))
    st.commenters = int(
        db.scalar(
            f"SELECT COUNT(DISTINCT user_id) FROM messages m WHERE author_kind='subscriber' AND user_id IS NOT NULL"
            f" AND {where}",
            (s, e),
        )
    )
    st.author_replies = int(
        db.scalar(f"SELECT COUNT(*) FROM messages m WHERE author_kind='author' AND {where}", (s, e))
    )
    q_like = " OR ".join("a.categories LIKE ?" for _ in QUESTION_CATEGORIES)
    st.unanswered_questions = int(
        db.scalar(
            "SELECT COUNT(*) FROM messages m JOIN analyses a ON a.message_row_id=m.id"
            f" LEFT JOIN recommendations r ON r.message_row_id=m.id WHERE m.author_kind='subscriber' AND {where}"
            f" AND m.answered_at IS NULL AND COALESCE(r.status,'') != 'skipped' AND ({q_like})",
            (s, e, *[f'%"{c}"%' for c in QUESTION_CATEGORIES]),
        )
    )
    # Среднее время ответа — только по подтверждённым ответам автора (не по ручной отметке).
    rows = db.all(
        "SELECT m.date, am.date AS answer_date FROM messages m JOIN messages am ON am.id=m.answered_by_message_id"
        f" WHERE m.author_kind='subscriber' AND {where}",
        (s, e),
    )
    deltas = [
        (from_iso(r["answer_date"]) - from_iso(r["date"])).total_seconds()
        for r in rows
        if from_iso(r["answer_date"]) >= from_iso(r["date"])
    ]
    st.avg_response_seconds = sum(deltas) / len(deltas) if deltas else None
    st.top_posts = [
        (post_title(r["text"], 50), r["n"])
        for r in db.all(
            "SELECT p.text, COUNT(*) AS n FROM messages m JOIN posts p ON p.id=m.post_id"
            f" WHERE m.author_kind='subscriber' AND {where} GROUP BY p.id ORDER BY n DESC, p.date DESC LIMIT 3",
            (s, e),
        )
    ]
    counter: Counter[str] = Counter()
    for r in db.all(f"SELECT a.topics FROM analyses a JOIN messages m ON m.id=a.message_row_id WHERE {where}", (s, e)):
        counter.update(json.loads(r["topics"] or "[]"))
    st.topics = counter.most_common(5)

    if with_daily and start is not None:
        days = max(1, (end - start).days + 1)
        if days > 1:
            st.daily = []
            for i in range(days):
                d0 = start + timedelta(days=i)
                d1 = d0 + timedelta(days=1)
                st.daily.append(
                    int(
                        db.scalar(
                            "SELECT COUNT(*) FROM messages WHERE author_kind='subscriber' AND date >= ? AND date < ?",
                            (to_iso(d0), to_iso(d1)),
                        )
                    )
                )
        prev_start = start - (end - start)
        st.previous_comments = int(
            db.scalar(
                "SELECT COUNT(*) FROM messages WHERE author_kind='subscriber' AND date >= ? AND date < ?",
                (to_iso(prev_start), to_iso(start)),
            )
        )
    return st


def sparkline(values: list[int]) -> str:
    if not values or max(values) == 0:
        return ""
    top = max(values)
    return "".join(SPARK[min(len(SPARK) - 1, round(v / top * (len(SPARK) - 1)))] for v in values)


def collection_started(ctx: Context) -> datetime | None:
    return from_iso(ctx.meta.get("collection_started_at"))
