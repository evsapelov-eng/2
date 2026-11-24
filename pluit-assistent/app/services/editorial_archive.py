"""Архив публикаций канала и ручной импорт старых постов из JSON.

Поддерживаются два формата файла data/import_posts.json:

1. Простой список: [{"id": 123, "date": "2026-10-01T12:00:00+03:00", "text": "..."}]
2. Экспорт Telegram Desktop (result.json канала): {"messages": [{"id": 123, "type": "message",
   "date": "2026-10-01T12:00:00", "date_unixtime": "...", "text": "..." | [ ... ]}]}

Импортированные посты не перезаписывают собранные автоматически.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime
from pathlib import Path

from app.context import Context
from app.utils.timeutil import from_unix, to_iso

log = logging.getLogger(__name__)


def _flatten_text(value) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(part if isinstance(part, str) else str(part.get("text", "")) for part in value)
    return ""


def _parse_date(item: dict, tz) -> str | None:
    if item.get("date_unixtime"):
        return to_iso(from_unix(int(item["date_unixtime"])))
    raw = item.get("date")
    if isinstance(raw, (int, float)):
        return to_iso(from_unix(raw))
    if isinstance(raw, str) and raw:
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=tz)
        return to_iso(dt)
    return None


def parse_import(data, tz) -> list[dict]:
    items = data.get("messages", []) if isinstance(data, dict) else data
    if not isinstance(items, list):
        raise ValueError("Ожидается список постов или экспорт Telegram Desktop.")
    posts = []
    for item in items:
        if not isinstance(item, dict) or item.get("type", "message") != "message":
            continue
        post_id = item.get("id") or item.get("channel_post_id")
        text = _flatten_text(item.get("text"))
        if not isinstance(post_id, int) or not text.strip():
            continue
        posts.append({"channel_post_id": post_id, "date": _parse_date(item, tz), "text": text})
    return posts


def import_file(ctx: Context, path: Path) -> int:
    """Импортирует файл, если он изменился с прошлого импорта. Возвращает число новых постов."""
    if not path.exists():
        return 0
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    if ctx.meta.get("import_hash") == digest:
        return 0
    posts = parse_import(json.loads(raw.decode("utf-8")), ctx.tz)
    added = 0
    for post in posts:
        exists = ctx.db.scalar("SELECT 1 FROM posts WHERE channel_post_id=?", (post["channel_post_id"],))
        if exists:
            continue
        ctx.db.execute(
            "INSERT INTO posts(channel_post_id, date, text, source, created_at) VALUES(?,?,?,'import',?)",
            (post["channel_post_id"], post["date"], post["text"], to_iso(ctx.now)),
        )
        added += 1
    ctx.meta.set("import_hash", digest)
    log.info("Импорт постов: добавлено %d.", added)
    return added


def list_page(ctx: Context, page: int, per_page: int = 5):
    total = int(ctx.db.scalar("SELECT COUNT(*) FROM posts") or 0)
    rows = ctx.db.all(
        "SELECT p.*, (SELECT COUNT(*) FROM messages m WHERE m.post_id=p.id AND m.author_kind='subscriber') AS comments"
        " FROM posts p ORDER BY COALESCE(p.date, p.created_at) DESC LIMIT ? OFFSET ?",
        (per_page, page * per_page),
    )
    return rows, total


def details(ctx: Context, post_id: int) -> dict | None:
    db = ctx.db
    post = db.one("SELECT * FROM posts WHERE id=?", (post_id,))
    if not post:
        return None
    return {
        "post": post,
        "comments": int(
            db.scalar("SELECT COUNT(*) FROM messages WHERE post_id=? AND author_kind='subscriber'", (post_id,)) or 0
        ),
        "author_replies": int(
            db.scalar("SELECT COUNT(*) FROM messages WHERE post_id=? AND author_kind='author'", (post_id,)) or 0
        ),
        "top": db.all(
            "SELECT m.text, a.priority FROM messages m JOIN analyses a ON a.message_row_id=m.id"
            " WHERE m.post_id=? AND a.priority >= 50 ORDER BY a.priority DESC LIMIT 3",
            (post_id,),
        ),
        "ideas": db.all("SELECT title FROM ideas WHERE post_id=? AND status != 'rejected' LIMIT 3", (post_id,)),
    }
