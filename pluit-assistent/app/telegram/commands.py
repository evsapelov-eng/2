"""Команды владельца в личном чате с ботом."""

from __future__ import annotations

import hashlib
import json
import logging

from app.context import Context
from app.services import privacy
from app.telegram import screens, ui
from app.telegram.client import TelegramError
from app.telegram.keyboards import back_to_menu, markup
from app.telegram.screens import Screen

log = logging.getLogger(__name__)

COMMANDS = [
    ("start", "Запуск помощника"),
    ("menu", "Главное меню"),
    ("inbox", "Входящие комментарии"),
    ("stats", "Аналитика"),
    ("archive", "Архив публикаций"),
    ("ideas", "Идеи для постов"),
    ("settings", "Настройки"),
    ("digest", "Текущая сводка"),
    ("pause", "Приостановить уведомления"),
    ("resume", "Возобновить уведомления"),
    ("status", "Состояние системы"),
    ("forget", "Удалить данные подписчика"),
    ("help", "Помощь"),
]

DENIED = "Этот бот работает только для автора канала PLUIT Club."


async def ensure_commands(ctx: Context) -> None:
    """Регистрирует команды только для личного чата владельца (посторонние их не видят)."""
    payload = [{"command": c, "description": d} for c, d in COMMANDS]
    version = hashlib.sha256(json.dumps([payload, ctx.owner_id]).encode()).hexdigest()[:12]
    if ctx.meta.get("commands_version") == version:
        return
    try:
        await ctx.tg.set_my_commands(payload, scope={"type": "chat", "chat_id": ctx.owner_id})
        ctx.meta.set("commands_version", version)
    except TelegramError as exc:
        # Например, владелец ещё не нажал «Старт» в личном чате.
        log.warning("Не удалось зарегистрировать команды: %s", exc.code)


def parse_command(text: str) -> tuple[str, str]:
    head, _, arg = text.strip().partition(" ")
    return head[1:].split("@", 1)[0].lower(), arg.strip()


async def handle_private_message(ctx: Context, msg: dict) -> None:
    user_id = (msg.get("from") or {}).get("id")
    text = (msg.get("text") or "").strip()
    if user_id != ctx.owner_id or (msg.get("chat") or {}).get("id") != ctx.owner_id:
        if text.startswith("/"):
            try:
                await ctx.tg.send_message(msg["chat"]["id"], DENIED)
            except TelegramError:
                pass
        log.info("Сообщение от постороннего пользователя отклонено.")
        return
    ctx.stats.owner_interacted = True
    if not text.startswith("/"):
        await ui.send(ctx, Screen("Я понимаю только команды. Список — /help.", None))
        return
    command, arg = parse_command(text)
    await run_command(ctx, command, arg)


async def run_command(ctx: Context, command: str, arg: str) -> None:
    if command == "start":
        if not ctx.meta.get("owner_started"):
            ctx.meta.set("owner_started", "1")
            await ui.send(ctx, screens.help_screen(ctx))
        await ui.send(ctx, screens.main_menu(ctx))
    elif command == "menu":
        await ui.send(ctx, screens.main_menu(ctx))
    elif command == "inbox":
        await ui.send(ctx, screens.inbox(ctx, "o", 0))
    elif command == "stats":
        await ui.send(ctx, screens.stats(ctx, "7"))
    elif command == "archive":
        await ui.send(ctx, screens.archive(ctx, 0))
    elif command == "ideas":
        await ui.send(ctx, screens.ideas_screen(ctx, "n", 0))
    elif command == "settings":
        await ui.send(ctx, screens.settings_screen(ctx))
    elif command == "digest":
        await ui.send(ctx, Screen(screens.digest_text(ctx, title="Текущая сводка"), screens.digest_keyboard(ctx)))
    elif command == "pause":
        ctx.settings.set("notifications_paused", True)
        await ui.send(
            ctx,
            Screen(
                "Уведомления приостановлены. Сбор и анализ продолжаются. /resume — возобновить.",
                markup([back_to_menu()]),
            ),
        )
    elif command == "resume":
        ctx.settings.set("notifications_paused", False)
        await ui.send(ctx, Screen("Уведомления возобновлены.", markup([back_to_menu()])))
    elif command == "status":
        await ui.send(ctx, screens.status_screen(ctx))
    elif command == "forget":
        if not arg:
            await ui.send(ctx, Screen("Укажите подписчика: /forget 123456789 или /forget @username", None))
            return
        removed = privacy.forget_user(ctx, arg)
        text = (
            f"Удалено сообщений подписчика: {removed}. Данные исчезнут из резервной копии после сохранения состояния."
            if removed
            else "Данных этого подписчика не найдено."
        )
        await ui.send(ctx, Screen(text, None))
    elif command == "help":
        await ui.send(ctx, screens.help_screen(ctx))
    else:
        await ui.send(ctx, Screen("Неизвестная команда. Список — /help.", None))
