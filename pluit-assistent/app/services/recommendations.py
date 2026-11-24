"""Рекомендации ответить на комментарий (входящие)."""

from __future__ import annotations

from datetime import timedelta

from app.context import Context
from app.utils.timeutil import to_iso

OPEN_STATUSES = ("pending", "notified")

FILTERS = {
    "a": ("Все", None),
    "o": ("Требуют ответа", ("pending", "notified")),
    "s": ("Отложенные", ("snoozed",)),
    "d": ("Уже отвеченные", ("answered",)),
    "k": ("Пропущенные", ("skipped",)),
}


def sync(ctx: Context, message_row_id: int, priority: int) -> None:
    db = ctx.db
    msg = db.one("SELECT answered_at FROM messages WHERE id=?", (message_row_id,))
    rec = db.one("SELECT id, status FROM recommendations WHERE message_row_id=?", (message_row_id,))
    threshold = ctx.settings.notification_threshold
    if priority >= threshold and msg and not msg["answered_at"]:
        if not rec:
            db.execute(
                "INSERT INTO recommendations(message_row_id, status, created_at) VALUES(?, 'pending', ?)",
                (message_row_id, to_iso(ctx.now)),
            )
    elif rec and rec["status"] == "pending":
        # Комментарий отредактирован и больше не требует внимания — ещё не уведомляли, просто убираем.
        db.execute("DELETE FROM recommendations WHERE id=?", (rec["id"],))


def set_status(ctx: Context, rec_id: int, action: str) -> str | None:
    """Действие владельца. Возвращает короткий текст результата или None, если рекомендации нет."""
    db = ctx.db
    rec = db.one("SELECT id, status, message_row_id FROM recommendations WHERE id=?", (rec_id,))
    if not rec:
        return None
    now = ctx.now
    if action == "snz":
        if rec["status"] in ("answered", "skipped"):
            return "Комментарий уже закрыт."
        remind = now + timedelta(hours=ctx.config.settings.remind_after_hours)
        db.execute("UPDATE recommendations SET status='snoozed', remind_at=? WHERE id=?", (to_iso(remind), rec_id))
        return "Напомню позже."
    if action == "ans":
        db.execute(
            "UPDATE recommendations SET status='answered', closed_at=?, close_reason='owner_marked', remind_at=NULL"
            " WHERE id=?",
            (to_iso(now), rec_id),
        )
        db.execute(
            "UPDATE messages SET answered_at=COALESCE(answered_at, ?) WHERE id=?", (to_iso(now), rec["message_row_id"])
        )
        return "Отмечено: уже ответил."
    if action == "skp":
        db.execute(
            "UPDATE recommendations SET status='skipped', closed_at=?, close_reason='owner_skipped', remind_at=NULL"
            " WHERE id=?",
            (to_iso(now), rec_id),
        )
        return "Пропущено."
    if action == "alt":
        db.execute("UPDATE recommendations SET alt_requested=1 WHERE id=?", (rec_id,))
        return "Готовлю другой вариант."
    if action == "reo":
        db.execute(
            "UPDATE recommendations SET status='notified', closed_at=NULL, close_reason=NULL WHERE id=?", (rec_id,)
        )
        return "Возвращено во входящие."
    return None


def list_page(ctx: Context, filter_key: str, page: int, per_page: int = 1) -> tuple[list, int]:
    statuses = FILTERS.get(filter_key, FILTERS["o"])[1]
    where = ""
    params: tuple = ()
    if statuses:
        where = "WHERE r.status IN (" + ",".join("?" * len(statuses)) + ")"
        params = statuses
    total = ctx.db.scalar(f"SELECT COUNT(*) FROM recommendations r {where}", params)
    rows = ctx.db.all(
        "SELECT r.*, m.text, m.username, m.display_name, m.date, m.message_id, m.thread_id, m.answered_at,"
        " a.priority, a.reason, a.suggested_reply, a.categories, a.source, p.text AS post_text, p.channel_post_id"
        f" FROM recommendations r JOIN messages m ON m.id=r.message_row_id"
        " LEFT JOIN analyses a ON a.message_row_id=m.id LEFT JOIN posts p ON p.id=m.post_id"
        f" {where} ORDER BY CASE WHEN r.status IN ('pending','notified') THEN 0 ELSE 1 END, a.priority DESC,"
        " m.date DESC LIMIT ? OFFSET ?",
        (*params, per_page, page * per_page),
    )
    return rows, int(total or 0)


def get_full(ctx: Context, rec_id: int):
    return ctx.db.one(
        "SELECT r.*, m.text, m.username, m.display_name, m.date, m.message_id, m.thread_id, m.answered_at,"
        " a.priority, a.reason, a.suggested_reply, a.categories, a.source, p.text AS post_text, p.channel_post_id"
        " FROM recommendations r JOIN messages m ON m.id=r.message_row_id"
        " LEFT JOIN analyses a ON a.message_row_id=m.id LEFT JOIN posts p ON p.id=m.post_id WHERE r.id=?",
        (rec_id,),
    )


def open_count(ctx: Context) -> int:
    return int(ctx.db.scalar("SELECT COUNT(*) FROM recommendations WHERE status IN ('pending','notified')") or 0)
