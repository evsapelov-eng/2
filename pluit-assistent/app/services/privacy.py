"""Срок хранения и удаление данных конкретного подписчика."""

from __future__ import annotations

import logging
from datetime import timedelta

from app.context import Context
from app.utils.timeutil import to_iso

log = logging.getLogger(__name__)


def purge_expired(ctx: Context) -> int:
    days = ctx.settings.data_retention_days
    cutoff = to_iso(ctx.now - timedelta(days=days))
    db = ctx.db
    with db.tx():
        # Очередь уведомлений содержит тексты комментариев — храним недолго.
        db.execute(
            "DELETE FROM outbox WHERE status IN ('sent','failed','uncertain') AND created_at < ?",
            (to_iso(ctx.now - timedelta(days=3)),),
        )
        cur = db.execute("DELETE FROM messages WHERE date < ?", (cutoff,))
        db.execute("DELETE FROM runs WHERE id NOT IN (SELECT id FROM runs ORDER BY id DESC LIMIT 100)")
    if cur.rowcount:
        log.info("Удалено устаревших сообщений: %d.", cur.rowcount)
    return cur.rowcount


def forget_user(ctx: Context, identifier: str) -> int:
    """Удаляет все сообщения подписчика (по Telegram ID или @username). Возвращает число удалённых сообщений."""
    db = ctx.db
    ident = identifier.strip()
    if ident.lstrip("-").isdigit():
        user_ids = [int(ident)]
    else:
        name = ident.lstrip("@").lower()
        user_ids = [
            r["user_id"]
            for r in db.all(
                "SELECT DISTINCT user_id FROM messages WHERE lower(username)=? AND user_id IS NOT NULL", (name,)
            )
        ]
    if not user_ids:
        return 0
    marks = ",".join("?" * len(user_ids))
    with db.tx():
        rec_ids = [
            r[0]
            for r in db.all(
                f"SELECT r.id FROM recommendations r JOIN messages m ON m.id=r.message_row_id WHERE m.user_id IN ({marks})",
                tuple(user_ids),
            )
        ]
        if rec_ids:
            db.execute(f"DELETE FROM outbox WHERE ref_id IN ({','.join('?' * len(rec_ids))})", tuple(rec_ids))
        cur = db.execute(
            f"DELETE FROM messages WHERE user_id IN ({marks}) AND author_kind='subscriber'", tuple(user_ids)
        )
        # Ссылки на удалённые комментарии в идеях больше не нужны.
        db.execute("UPDATE ideas SET source_link=NULL WHERE source_message_row_id IS NULL")
    log.info("Удалены данные подписчика: %d сообщений.", cur.rowcount)
    return cur.rowcount
