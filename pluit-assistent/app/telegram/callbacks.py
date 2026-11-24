"""Нажатия inline-кнопок. Обрабатываются при очередном запуске (или в окне быстрых ответов)."""

from __future__ import annotations

import logging
from datetime import timedelta

from app.context import Context
from app.services import ai_analyzer, ideas, recommendations
from app.services.ai_analyzer import AIGateway
from app.telegram import screens, ui
from app.telegram.client import TelegramError
from app.telegram.keyboards import recommendation_keyboard
from app.telegram.screens import Screen
from app.utils.timeutil import to_iso

log = logging.getLogger(__name__)

RETENTION_STEPS = [30, 90, 180, 365]


def _int(value: str, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


async def _answer(ctx: Context, cq_id: str, text: str | None = None) -> None:
    try:
        await ctx.tg.answer_callback_query(cq_id, text)
    except TelegramError:
        pass  # запрос мог устареть, пока ждал запуска — это нормально


async def handle_callback(ctx: Context, cq: dict) -> None:
    if (cq.get("from") or {}).get("id") != ctx.owner_id:
        await _answer(ctx, cq["id"], "Нет доступа.")
        log.info("Нажатие кнопки посторонним пользователем отклонено.")
        return
    ctx.stats.owner_interacted = True
    data = cq.get("data") or ""
    message = cq.get("message") or {}
    message_id = message.get("message_id") if message.get("date") else None  # date=0 — сообщение недоступно
    parts = data.split(":")
    head = parts[0]
    toast = None

    if head == "m":
        await ui.show(ctx, screens.main_menu(ctx), message_id)
    elif head == "in":
        await ui.show(
            ctx,
            screens.inbox(ctx, parts[1] if len(parts) > 1 else "o", _int(parts[2] if len(parts) > 2 else 0)),
            message_id,
        )
    elif head == "r" and len(parts) >= 3:
        toast = await _recommendation_action(ctx, parts, message_id)
    elif head == "st":
        await ui.show(ctx, screens.stats(ctx, parts[1] if len(parts) > 1 else "7"), message_id)
    elif head == "ar":
        await ui.show(ctx, screens.archive(ctx, _int(parts[1] if len(parts) > 1 else 0)), message_id)
    elif head == "ap" and len(parts) >= 2:
        await ui.show(
            ctx, screens.archive_post(ctx, _int(parts[1]), _int(parts[2] if len(parts) > 2 else 0)), message_id
        )
    elif head == "id":
        await ui.show(
            ctx,
            screens.ideas_screen(ctx, parts[1] if len(parts) > 1 else "n", _int(parts[2] if len(parts) > 2 else 0)),
            message_id,
        )
    elif head == "ix" and len(parts) >= 5:
        status = ideas.STATUS_CODES.get(parts[2])
        if status and ideas.set_status(ctx, _int(parts[1]), status):
            toast = f"Статус: {ideas.STATUSES[status].lower()}."
        await ui.show(ctx, screens.ideas_screen(ctx, parts[3], _int(parts[4])), message_id)
    elif head == "se":
        if len(parts) > 1:
            toast = _apply_setting(ctx, parts[1])
        await ui.show(ctx, screens.settings_screen(ctx), message_id)
    elif head == "pz":
        paused = not ctx.settings.notifications_paused
        ctx.settings.set("notifications_paused", paused)
        toast = "Уведомления приостановлены." if paused else "Уведомления возобновлены."
        screen = screens.settings_screen(ctx) if len(parts) > 1 and parts[1] == "se" else screens.main_menu(ctx)
        await ui.show(ctx, screen, message_id)
    else:
        toast = "Кнопка устарела."
    await _answer(ctx, cq["id"], toast)


async def _recommendation_action(ctx: Context, parts: list[str], message_id: int | None) -> str | None:
    rec_id = _int(parts[1])
    action = parts[2]
    origin = parts[3:5] if len(parts) >= 5 else None
    result = recommendations.set_status(ctx, rec_id, action)
    if result is None:
        if message_id:
            await ui.show(ctx, Screen("Комментарий больше недоступен (удалён по сроку хранения).", None), message_id)
        return "Комментарий не найден."
    if action == "alt":
        alt = await ai_analyzer.generate_alternative(ctx, rec_id)
        if alt is None:
            reason = AIGateway(ctx).status()
            result = (
                "AI сейчас недоступен — вариант появится при следующей проверке."
                if reason != "no_key" and reason != "paused"
                else "AI выключен — другой вариант недоступен."
            )
            if reason in ("no_key", "paused"):
                ctx.db.execute("UPDATE recommendations SET alt_requested=0 WHERE id=?", (rec_id,))
        else:
            result = None
    if origin:
        await ui.show(ctx, screens.inbox(ctx, origin[0], _int(origin[1])), message_id)
    else:
        await refresh_card(ctx, rec_id, message_id, note=result)
    if message_id:
        ctx.db.execute(
            "UPDATE recommendations SET tg_message_id=COALESCE(tg_message_id, ?) WHERE id=?", (message_id, rec_id)
        )
    return result


async def refresh_card(ctx: Context, rec_id: int, message_id: int | None, note: str | None = None) -> None:
    row = recommendations.get_full(ctx, rec_id)
    if not row:
        return
    text = screens.rec_text(ctx, row, header=screens.TITLE)
    if note and row["status"] in ("pending", "notified"):
        text += f"\n\n{note}"
    kb = recommendation_keyboard(rec_id, screens.rec_link(ctx, row), row["status"])
    await ui.show(ctx, Screen(text, kb), message_id)


def _apply_setting(ctx: Context, key: str) -> str | None:
    st = ctx.settings
    if key == "mode":
        order = ["smart", "digest", "quiet"]
        new = order[(order.index(st.notification_mode) + 1) % len(order)]
        st.set("notification_mode", new)
        return f"Режим: {screens.MODE_LABEL[new]}."
    if key in ("th+", "th-"):
        value = max(10, min(100, st.notification_threshold + (10 if key == "th+" else -10)))
        st.set("notification_threshold", value)
        _resync_threshold(ctx)
        return f"Порог: {value}."
    if key in ("mx+", "mx-"):
        value = max(1, min(10, st.max_recommendations_per_run + (1 if key == "mx+" else -1)))
        st.set("max_recommendations_per_run", value)
        return f"Рекомендаций за проверку: {value}."
    if key == "ds":
        st.set("daily_summary_enabled", not st.daily_summary_enabled)
    elif key == "wr":
        st.set("weekly_report_enabled", not st.weekly_report_enabled)
    elif key == "len":
        st.set("reply_length", "short" if st.reply_length == "normal" else "normal")
    elif key == "adr":
        order = ["auto", "ty", "vy"]
        st.set("reply_address", order[(order.index(st.reply_address) + 1) % len(order)])
    elif key == "ret":
        current = st.data_retention_days
        nxt = next((d for d in RETENTION_STEPS if d > current), RETENTION_STEPS[0])
        st.set("data_retention_days", nxt)
        return f"Хранение: {nxt} дн. Более старые комментарии удаляются автоматически."
    elif key == "ai":
        st.set("ai_paused", not st.ai_paused)
        return "AI приостановлен: анализ по правилам." if st.ai_paused else "AI-анализ включён."
    return None


def _resync_threshold(ctx: Context) -> None:
    """Новый порог применяется и к уже проанализированным недавним комментариям."""
    rows = ctx.db.all(
        "SELECT a.message_row_id, a.priority FROM analyses a JOIN messages m ON m.id=a.message_row_id"
        " WHERE m.answered_at IS NULL AND m.date >= ?",
        (to_iso(ctx.now - timedelta(days=2)),),
    )
    for r in rows:
        recommendations.sync(ctx, r["message_row_id"], r["priority"])
