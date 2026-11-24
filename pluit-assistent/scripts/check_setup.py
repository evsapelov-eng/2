"""Проверка настройки PLUIT Assistent. Запускается workflow «Проверка настройки».

Не вызывает getUpdates (очередь обновлений не трогается) и не меняет состояние бота.
Значения секретов не печатаются.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ConfigError, load_config
from app.main import setup_logging
from app.storage.encryption import EncryptionError, decode_key
from app.telegram.client import TelegramClient, TelegramError

OK, WARN, FAIL = "[ок]", "[внимание]", "[ошибка]"


async def main() -> int:
    setup_logging()
    problems = 0
    try:
        config = load_config()
    except ConfigError as exc:
        print(FAIL, exc)
        return 1
    secrets = config.secrets
    try:
        decode_key(secrets.state_encryption_key.get_secret_value())
        print(OK, "Ключ шифрования состояния корректен.")
    except EncryptionError as exc:
        print(FAIL, exc)
        problems += 1

    async with TelegramClient(secrets.telegram_bot_token.get_secret_value()) as tg:
        try:
            me = await tg.get_me()
            print(OK, f"Бот: @{me.get('username')}")
            if me.get("can_read_all_group_messages"):
                print(OK, "Privacy Mode выключен: бот видит все сообщения групп.")
            else:
                print(
                    WARN,
                    "Privacy Mode включён. Бот увидит все комментарии, только если он администратор "
                    "группы обсуждений. Иначе: @BotFather → /setprivacy → Disable, затем удалите бота "
                    "из группы и добавьте снова.",
                )
        except TelegramError as exc:
            print(FAIL, f"Токен бота не принят Telegram ({exc.code}).")
            return 1

        info = await tg.get_webhook_info()
        print(
            WARN if info.get("url") else OK,
            "Активен webhook — бот отключит его при запуске." if info.get("url") else "Webhook не используется.",
        )
        print(OK, f"Необработанных обновлений в очереди Telegram: {info.get('pending_update_count', 0)}")

        try:
            group = await tg.get_chat(secrets.discussion_group_id)
            print(OK, f"Группа обсуждений: {group.get('title')}")
            if group.get("linked_chat_id") != secrets.channel_id:
                print(WARN, "Группа не привязана к каналу из CHANNEL_ID. Проверьте CHANNEL_ID и DISCUSSION_GROUP_ID.")
            member = await tg.get_chat_member(secrets.discussion_group_id, me["id"])
            status = member.get("status")
            print(OK, f"Статус бота в группе: {status}")
            if status == "administrator":
                extra = [
                    k
                    for k in (
                        "can_delete_messages",
                        "can_restrict_members",
                        "can_promote_members",
                        "can_change_info",
                        "can_pin_messages",
                        "can_invite_users",
                    )
                    if member.get(k)
                ]
                if extra:
                    print(WARN, "У бота лишние права администратора: " + ", ".join(extra) + ". Они не нужны.")
        except TelegramError as exc:
            print(FAIL, f"Бот не видит группу обсуждений ({exc.code}). Добавьте его в группу.")
            problems += 1

        if os.environ.get("SEND_TEST_MESSAGE", "true").lower() == "true":
            try:
                await tg.send_message(
                    secrets.owner_telegram_id, "<b>PLUIT Assistent</b>\n\nПроверка связи: всё работает."
                )
                print(OK, "Тестовое сообщение владельцу отправлено.")
            except TelegramError as exc:
                print(FAIL, f"Не удалось написать владельцу ({exc.code}). Откройте диалог с ботом и нажмите «Старт».")
                problems += 1

    if os.environ.get("TEST_GEMINI", "false").lower() == "true":
        if not secrets.gemini_api_key:
            print(WARN, "GEMINI_API_KEY не задан — бот будет работать в режиме анализа по правилам.")
        else:
            from app.schemas.analysis import AlternativeReply
            from app.services.ai_analyzer import FatalError, GeminiEngine, QuotaError, TransientError

            engine = GeminiEngine(secrets.gemini_api_key.get_secret_value(), 60)
            try:
                await engine.call(
                    config.settings.gemini_model,
                    "Ответь JSON.",
                    "Предложи короткую реплику «привет».",
                    AlternativeReply,
                )
                print(OK, f"Gemini отвечает (модель {config.settings.gemini_model}).")
            except QuotaError:
                print(WARN, "Gemini: квота исчерпана. Попробуйте позже.")
            except (TransientError, FatalError) as exc:
                print(FAIL, f"Gemini: {exc}. Проверьте ключ и название модели.")
                problems += 1

    print()
    print("Итог:", "всё готово." if not problems else f"проблем: {problems}.")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
