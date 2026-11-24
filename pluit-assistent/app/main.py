"""Точка входа: один запуск по расписанию GitHub Actions.

Порядок:
 1. Загрузка зашифрованного состояния.
 2. Проверка, что webhook не активен; регистрация команд.
 3. Получение новых обновлений Telegram (offset подтверждается только после сохранения).
 4. Сохранение публикаций и комментариев, определение ответов автора.
 5. Анализ необработанных комментариев (Gemini или правила), темы постов.
 6. Обработка команд и кнопок владельца.
 7. Уведомления (очередь outbox), напоминания, дайджест, еженедельный отчёт.
 8. Окно быстрых ответов, если владелец пользовался ботом.
 9. Сохранение состояния и завершение.
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import time
from pathlib import Path

from app.config import ROOT, Config, ConfigError, load_config
from app.context import Context
from app.services import ai_analyzer, editorial_archive, notifications, privacy, thread_resolver
from app.services.ai_analyzer import AIEngine, GeminiEngine
from app.storage.database import Database
from app.storage.encryption import EncryptionError, decode_key
from app.storage.state_manager import (
    GitBranchBackend,
    LocalFileBackend,
    StateBackend,
    StateError,
    StateManager,
)
from app.telegram import collector, commands
from app.telegram.client import TelegramClient, TelegramError
from app.utils.timeutil import Clock, to_iso, utcnow

log = logging.getLogger("pluit")

IMPORT_FILE = ROOT / "data" / "import_posts.json"


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s", stream=sys.stdout)
    # httpx пишет URL запросов, а в URL Bot API есть токен — эти логи отключаем.
    for name in ("httpx", "httpcore", "google_genai", "google.genai"):
        logging.getLogger(name).setLevel(logging.WARNING)


def make_backend(config: Config) -> StateBackend:
    s = config.settings
    if s.state_backend == "local":
        return LocalFileBackend(Path(s.state_local_path))
    return GitBranchBackend(os.environ.get("GITHUB_WORKSPACE", str(ROOT)), branch=s.state_branch)


async def run_once(
    config: Config,
    *,
    backend: StateBackend | None = None,
    tg: TelegramClient | None = None,
    ai: AIEngine | None = None,
    clock: Clock = utcnow,
    import_file: Path | None = IMPORT_FILE,
    interactive_window: int | None = None,
) -> Context:
    state = StateManager(
        backend or make_backend(config), decode_key(config.secrets.state_encryption_key.get_secret_value())
    )
    db = Database(state.load())  # при ошибке расшифровки запуск прерывается — данные не перезаписываются

    if ai is None and config.secrets.gemini_api_key:
        ai = GeminiEngine(config.secrets.gemini_api_key.get_secret_value(), config.settings.gemini_timeout_seconds)
    own_tg = tg is None
    tg = tg or TelegramClient(config.secrets.telegram_bot_token.get_secret_value())

    async def checkpoint() -> None:
        state.save(db.serialize())

    ctx = Context(config=config, db=db, tg=tg, ai=ai, checkpoint=checkpoint, clock=clock)
    if not ctx.meta.get("collection_started_at"):
        ctx.meta.set("collection_started_at", to_iso(ctx.now))
    run_id = db.execute("INSERT INTO runs(started_at) VALUES(?)", (to_iso(ctx.now),)).lastrowid
    error: str | None = None
    try:
        notifications.recover(ctx)
        await collector.ensure_polling_mode(ctx)
        await commands.ensure_commands(ctx)
        await collector.fetch(ctx)
        await checkpoint()  # обновления сохранены — следующий getUpdates может их подтвердить

        collector.ingest_group_updates(ctx)
        with db.tx():
            thread_resolver.retry_unresolved(ctx)
        if import_file is not None:
            try:
                editorial_archive.import_file(ctx, import_file)
            except (ValueError, UnicodeDecodeError) as exc:
                log.error("Импорт постов не выполнен: %s", exc)
        privacy.purge_expired(ctx)

        await ai_analyzer.analyze_pending(ctx)
        await ai_analyzer.analyze_post_topics(ctx)

        await collector.handle_owner_updates(ctx)
        await notifications.deliver_pending_alternatives(ctx)
        await notifications.close_answered_cards(ctx)
        notifications.plan(ctx)
        await notifications.flush(ctx)

        window = config.settings.interactive_window_seconds if interactive_window is None else interactive_window
        if ctx.stats.owner_interacted and window > 0:
            await interactive_loop(ctx, window)
    except (TelegramError, StateError) as exc:
        error = str(exc)
        log.error("Запуск завершён с ошибкой: %s", exc)
    finally:
        st = ctx.stats
        db.execute(
            "UPDATE runs SET finished_at=?, status=?, updates=?, analyzed=?, notified=?, ai_requests=?, error=? WHERE id=?",
            (
                to_iso(ctx.now),
                "error" if error else "ok",
                st.updates,
                st.analyzed,
                st.notified,
                st.ai_requests,
                error,
                run_id,
            ),
        )
        if not error:
            ctx.meta.set("last_success_at", to_iso(ctx.now))
        try:
            await checkpoint()
        finally:
            if own_tg:
                await tg.close()
    if error:
        raise RuntimeError(error)
    log.info(
        "Готово: обновлений %d, проанализировано %d, уведомлений %d, AI-запросов %d.",
        ctx.stats.updates,
        ctx.stats.analyzed,
        ctx.stats.notified,
        ctx.stats.ai_requests,
    )
    return ctx


async def interactive_loop(ctx: Context, seconds: int) -> None:
    """Короткое окно, когда кнопки владельца обрабатываются сразу. Расходует минуты Actions только
    в запусках, где владелец пользовался ботом."""
    log.info("Окно быстрых ответов: %d с.", seconds)
    deadline = time.monotonic() + seconds
    while (left := deadline - time.monotonic()) > 1:
        got = await collector.fetch(ctx, timeout=int(min(25, left)), max_batches=1)
        if not got:
            continue
        collector.ingest_group_updates(ctx)
        await collector.handle_owner_updates(ctx)
        await ctx.checkpoint()


def main() -> int:
    setup_logging()
    try:
        config = load_config()
        asyncio.run(run_once(config))
    except (ConfigError, EncryptionError, StateError) as exc:
        log.error("%s", exc)
        return 1
    except RuntimeError as exc:
        log.error("%s", exc)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
