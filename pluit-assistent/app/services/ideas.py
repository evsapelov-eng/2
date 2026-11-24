"""Идеи для постов, выявленные в комментариях. Только из реальных комментариев."""

from __future__ import annotations

from app.context import Context
from app.schemas.analysis import Analysis
from app.utils.links import comment_link
from app.utils.text import normalize_key
from app.utils.timeutil import to_iso

STATUSES = {
    "new": "Новая",
    "in_progress": "В работе",
    "used": "Использована",
    "rejected": "Отклонена",
}
STATUS_CODES = {"n": "new", "w": "in_progress", "u": "used", "r": "rejected"}
CODE_OF = {v: k for k, v in STATUS_CODES.items()}


def add_from_comment(ctx: Context, row, analysis: Analysis) -> None:
    title = analysis.potential_post_topic
    if not title:
        return
    key = normalize_key(title)
    if ctx.db.scalar("SELECT 1 FROM ideas WHERE norm_key=?", (key,)):
        return
    channel_post_id = (
        ctx.db.scalar("SELECT channel_post_id FROM posts WHERE id=?", (row["post_id"],)) if row["post_id"] else None
    )
    s = ctx.config.settings
    link = comment_link(
        s.channel_username, ctx.channel_id, ctx.group_id, channel_post_id, row["message_id"], row["thread_id"]
    )
    now = to_iso(ctx.now)
    ctx.db.execute(
        "INSERT INTO ideas(title, description, reason, source_message_row_id, source_link, post_id, status, norm_key,"
        " created_at, updated_at) VALUES(?,?,?,?,?,?,'new',?,?,?)",
        (title, analysis.potential_post_description, analysis.reason, row["id"], link, row["post_id"], key, now, now),
    )


def set_status(ctx: Context, idea_id: int, status: str) -> bool:
    if status not in STATUSES:
        return False
    cur = ctx.db.execute("UPDATE ideas SET status=?, updated_at=? WHERE id=?", (status, to_iso(ctx.now), idea_id))
    return cur.rowcount > 0


def count(ctx: Context, status: str = "new") -> int:
    return int(ctx.db.scalar("SELECT COUNT(*) FROM ideas WHERE status=?", (status,)) or 0)


def page(ctx: Context, status: str, index: int):
    total = count(ctx, status)
    row = ctx.db.one("SELECT * FROM ideas WHERE status=? ORDER BY created_at DESC LIMIT 1 OFFSET ?", (status, index))
    return row, total
