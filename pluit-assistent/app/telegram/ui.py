"""Отправка и обновление экранов в личном чате владельца."""

from __future__ import annotations

import logging

from app.context import Context
from app.telegram.client import TelegramError
from app.telegram.screens import Screen

log = logging.getLogger(__name__)


async def send(ctx: Context, screen: Screen, *, reply_to: int | None = None) -> int | None:
    try:
        result = await ctx.tg.send_message(
            ctx.owner_id, screen.text, reply_markup=screen.keyboard, reply_to_message_id=reply_to
        )
        return result.get("message_id")
    except TelegramError as exc:
        log.error("Не удалось отправить сообщение владельцу: %s", exc.code)
        return None


async def show(ctx: Context, screen: Screen, message_id: int | None) -> None:
    """Обновляет сообщение с меню. Если это невозможно (сообщение старое) — отправляет новое."""
    if message_id:
        try:
            await ctx.tg.edit_message_text(ctx.owner_id, message_id, screen.text, reply_markup=screen.keyboard)
            return
        except TelegramError as exc:
            if exc.not_modified:
                return
            log.info("Не удалось обновить сообщение (%s), отправляю новое.", exc.code)
    await send(ctx, screen)
