"""Получение обновлений через getUpdates (без webhook и постоянного сервера).

Правило надёжности: getUpdates с новым offset вызывается только после того, как
обновления предыдущего пакета надёжно сохранены (checkpoint). Вызов с offset
подтверждает Telegram все обновления с меньшим update_id, поэтому до сохранения
их нельзя «подтверждать». drop_pending_updates не используется.
"""

from __future__ import annotations

import json
import logging

from app.context import Context
from app.services import thread_resolver
from app.telegram import callbacks, commands
from app.utils.timeutil import to_iso

log = logging.getLogger(__name__)

ALLOWED_UPDATES = ["message", "edited_message", "callback_query"]
BATCH = 100


async def ensure_polling_mode(ctx: Context) -> None:
    info = await ctx.tg.get_webhook_info()
    if info.get("url"):
        log.warning("Обнаружен активный webhook — он отключается (накопленные обновления сохраняются).")
        await ctx.tg.delete_webhook()


async def fetch(ctx: Context, *, timeout: int = 0, max_batches: int = 50) -> int:
    total = 0
    for _ in range(max_batches):
        offset = ctx.meta.get_int("update_offset", 0) or None
        updates = await ctx.tg.get_updates(offset, limit=BATCH, timeout=timeout, allowed_updates=ALLOWED_UPDATES)
        if not updates:
            break
        with ctx.db.tx():
            for upd in updates:
                ctx.db.execute(
                    "INSERT OR IGNORE INTO raw_updates(update_id, payload, received_at) VALUES(?,?,?)",
                    (upd["update_id"], json.dumps(upd, ensure_ascii=False), to_iso(ctx.now)),
                )
            ctx.meta.set("update_offset", max(u["update_id"] for u in updates) + 1)
        total += len(updates)
        if len(updates) < BATCH:
            break
        await ctx.checkpoint()  # сохранить, прежде чем следующий вызов подтвердит этот пакет
        timeout = 0
    ctx.stats.updates += total
    if total:
        log.info("Получено обновлений: %d.", total)
    return total


def _kind(ctx: Context, upd: dict) -> str:
    msg = upd.get("message") or upd.get("edited_message")
    if msg:
        chat = msg.get("chat") or {}
        if chat.get("id") == ctx.group_id:
            return "group"
        if chat.get("type") == "private":
            return "private"
        return "foreign"  # посторонние чаты не обрабатываются и не сохраняются
    if upd.get("callback_query"):
        return "callback"
    return "foreign"


def ingest_group_updates(ctx: Context) -> int:
    """Сохраняет сообщения группы обсуждений. Посторонние чаты отбрасываются."""
    count = 0
    for row in ctx.db.all("SELECT update_id, payload FROM raw_updates ORDER BY update_id"):
        upd = json.loads(row["payload"])
        kind = _kind(ctx, upd)
        if kind in ("private", "callback"):
            continue
        with ctx.db.tx():
            if kind == "group":
                if upd.get("message"):
                    thread_resolver.ingest_group_message(ctx, upd["message"])
                else:
                    thread_resolver.ingest_group_message(ctx, upd["edited_message"], edited=True)
                count += 1
            ctx.db.execute("DELETE FROM raw_updates WHERE update_id=?", (row["update_id"],))
    return count


async def handle_owner_updates(ctx: Context) -> int:
    count = 0
    for row in ctx.db.all("SELECT update_id, payload FROM raw_updates ORDER BY update_id"):
        upd = json.loads(row["payload"])
        # Удаляем до обработки: при сбое команда не будет выполнена повторно.
        ctx.db.execute("DELETE FROM raw_updates WHERE update_id=?", (row["update_id"],))
        try:
            if upd.get("message"):
                await commands.handle_private_message(ctx, upd["message"])
            elif upd.get("callback_query"):
                await callbacks.handle_callback(ctx, upd["callback_query"])
        except Exception:
            log.exception("Ошибка обработки действия владельца (update %s).", row["update_id"])
        count += 1
    return count
