"""Определение ответов автора на комментарии подписчиков."""

from __future__ import annotations

from app.context import Context
from app.utils.timeutil import from_unix, to_iso


def register_reply(ctx: Context, author_row_id: int, replied_message_id: int, unix_date: int) -> None:
    """Автор (подтверждённо) ответил на сообщение replied_message_id."""
    db = ctx.db
    target = db.one(
        "SELECT id, answered_at FROM messages WHERE chat_id=? AND message_id=? AND author_kind='subscriber'",
        (ctx.group_id, replied_message_id),
    )
    if not target:
        return
    if not target["answered_at"]:
        db.execute(
            "UPDATE messages SET answered_at=?, answered_by_message_id=? WHERE id=?",
            (to_iso(from_unix(unix_date)), author_row_id, target["id"]),
        )
    close_recommendation(ctx, target["id"], "author_replied")


def close_recommendation(ctx: Context, message_row_id: int, reason: str) -> int | None:
    """Закрывает рекомендацию и отменяет напоминание. Возвращает id рекомендации."""
    row = ctx.db.one("SELECT id, status FROM recommendations WHERE message_row_id=?", (message_row_id,))
    if not row or row["status"] in ("answered", "skipped"):
        return None
    ctx.db.execute(
        "UPDATE recommendations SET status='answered', closed_at=?, close_reason=?, remind_at=NULL WHERE id=?",
        (to_iso(ctx.now), reason, row["id"]),
    )
    return row["id"]
