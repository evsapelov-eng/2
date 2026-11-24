"""Уведомления владельцу через постоянную очередь (outbox).

Порядок отправки:
1. Сообщения ставятся в очередь с уникальным dedupe_key (повторно та же запись не создаётся).
2. Перед отправкой записи помечаются «sending», и состояние сохраняется.
3. После отправки — «sent», и состояние сохраняется в конце запуска.

Если запуск оборвался между шагами 2 и 3, запись остаётся «sending» и при следующем
запуске становится «uncertain»: повторно её не отправляем (лучше пропустить дубль,
комментарий всё равно есть во входящих). Абсолютная гарантия однократной доставки
через Bot API невозможна; так вероятность дубля минимальна.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, timedelta

from app.context import Context
from app.services import analytics
from app.telegram import screens
from app.telegram.client import TelegramError
from app.telegram.keyboards import markup, recommendation_keyboard, url_btn
from app.utils.text import esc
from app.utils.timeutil import in_quiet_hours, start_of_local_day, to_iso

log = logging.getLogger(__name__)

MAX_ATTEMPTS = 3


def recover(ctx: Context) -> None:
    """Записи, оставшиеся в состоянии «sending» после сбоя, повторно не отправляются."""
    rows = ctx.db.all("SELECT id, kind, ref_id, payload FROM outbox WHERE status='sending'")
    for row in rows:
        ctx.db.execute("UPDATE outbox SET status='uncertain' WHERE id=?", (row["id"],))
        _mark_delivered(ctx, row, None)
    if rows:
        log.warning("Неподтверждённых отправок после сбоя: %d (повторно не отправляются).", len(rows))


def _enqueue(ctx: Context, kind: str, key: str, payload: dict, ref_id: int | None = None) -> bool:
    cur = ctx.db.execute(
        "INSERT OR IGNORE INTO outbox(kind, dedupe_key, payload, ref_id, created_at) VALUES(?,?,?,?,?)",
        (kind, key, json.dumps(payload, ensure_ascii=False), ref_id, to_iso(ctx.now)),
    )
    return cur.rowcount > 0


def notifications_allowed(ctx: Context) -> bool:
    s = ctx.config.settings
    if ctx.settings.notifications_paused or ctx.settings.notification_mode == "quiet":
        return False
    return not in_quiet_hours(ctx.now, ctx.tz, s.quiet_hours_start, s.quiet_hours_end)


def _is_evening(ctx: Context) -> bool:
    s = ctx.config.settings
    return ctx.now.astimezone(ctx.tz).hour >= s.evening_hour


def _card_payload(ctx: Context, rec_id: int, header: str | None) -> dict | None:
    from app.services import recommendations

    row = recommendations.get_full(ctx, rec_id)
    if not row:
        return None
    return {
        "text": screens.rec_text(ctx, row, header=header),
        "reply_markup": recommendation_keyboard(rec_id, screens.rec_link(ctx, row), "notified"),
    }


def plan(ctx: Context) -> None:
    """Решает, что отправить в этом запуске, и ставит сообщения в очередь."""
    if not notifications_allowed(ctx):
        return
    s = ctx.config.settings
    mode = ctx.settings.notification_mode
    today = ctx.now.astimezone(ctx.tz).strftime("%Y-%m-%d")

    # Напоминания об отложенных комментариях.
    due = ctx.db.all(
        "SELECT id, notify_count FROM recommendations WHERE status='snoozed' AND remind_at <= ?", (to_iso(ctx.now),)
    )
    for r in due:
        payload = _card_payload(ctx, r["id"], "<b>PLUIT Assistent</b>\nНапоминание")
        if payload:
            _enqueue(ctx, "reminder", f"rem:{r['id']}:{r['notify_count']}", payload, r["id"])

    if mode == "smart":
        min_created = to_iso(ctx.now - timedelta(hours=s.recommendation_max_age_hours))
        rows = ctx.db.all(
            "SELECT r.id FROM recommendations r JOIN analyses a ON a.message_row_id=r.message_row_id"
            " JOIN messages m ON m.id=r.message_row_id WHERE r.status='pending' AND r.created_at >= ?"
            " AND m.answered_at IS NULL AND NOT EXISTS (SELECT 1 FROM outbox o WHERE o.ref_id=r.id"
            " AND o.kind='rec') ORDER BY a.priority DESC, m.date LIMIT ?",
            (min_created, ctx.settings.max_recommendations_per_run),
        )
        for i, r in enumerate(rows):
            header = None
            if i == 0:
                header = "<b>PLUIT Assistent</b>\nНовые комментарии требуют внимания."
            payload = _card_payload(ctx, r["id"], header)
            if payload:
                _enqueue(ctx, "rec", f"rec:{r['id']}", payload, r["id"])
        if ctx.settings.daily_summary_enabled and _is_evening(ctx) and ctx.meta.get("last_summary_day") != today:
            st = analytics.collect(ctx, start_of_local_day(ctx.now, ctx.tz), ctx.now, with_daily=False)
            if st.comments:
                text = screens.digest_text(ctx, limit=0, title="Вечерняя сводка")
                _enqueue(ctx, "summary", f"summary:{today}", {"text": text, "reply_markup": None})
            ctx.meta.set("last_summary_day", today)

    if mode == "digest" and _is_evening(ctx) and ctx.meta.get("last_digest_day") != today:
        limit = ctx.settings.max_recommendations_per_run
        rows = ctx.db.all("SELECT id FROM recommendations WHERE status IN ('pending','notified')")
        if rows:
            pending_ids = [
                r["id"]
                for r in ctx.db.all(
                    "SELECT r.id FROM recommendations r JOIN analyses a ON a.message_row_id=r.message_row_id"
                    " WHERE r.status='pending' ORDER BY a.priority DESC LIMIT ?",
                    (limit,),
                )
            ]
            _enqueue(
                ctx,
                "digest",
                f"digest:{today}",
                {
                    "text": screens.digest_text(ctx, limit=limit, title="PLUIT Assistent · Дайджест"),
                    "reply_markup": screens.digest_keyboard(ctx, limit),
                    "rec_ids": pending_ids,
                },
            )
        ctx.meta.set("last_digest_day", today)

    _plan_weekly(ctx)


def _plan_weekly(ctx: Context) -> None:
    if not ctx.settings.weekly_report_enabled:
        return
    s = ctx.config.settings
    local_now = ctx.now.astimezone(ctx.tz)
    if local_now.weekday() == 0 and local_now.hour < s.weekly_report_hour:
        return
    week_start_local = (local_now - timedelta(days=local_now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    this_week = week_start_local.astimezone(ctx.tz).strftime("%G-W%V")
    if ctx.meta.get("last_weekly_week") == this_week:
        return
    ctx.meta.set("last_weekly_week", this_week)
    end = week_start_local.astimezone(UTC)
    start = end - timedelta(days=7)
    began = analytics.collection_started(ctx)
    if began and began >= end:
        return  # прошлой недели в данных ещё нет
    text = screens.weekly_report_text(ctx, start, end)
    if text:
        _enqueue(ctx, "weekly", f"weekly:{this_week}", {"text": text, "reply_markup": None})


def _mark_delivered(ctx: Context, row, message_id: int | None) -> None:
    payload = json.loads(row["payload"])
    now = to_iso(ctx.now)
    if row["kind"] in ("rec", "reminder") and row["ref_id"]:
        ctx.db.execute(
            "UPDATE recommendations SET status=CASE WHEN status IN ('pending','snoozed') THEN 'notified' ELSE status"
            " END, notified_at=?, remind_at=NULL, notify_count=notify_count+1,"
            " tg_message_id=COALESCE(?, tg_message_id) WHERE id=?",
            (now, message_id, row["ref_id"]),
        )
    elif row["kind"] == "digest":
        for rec_id in payload.get("rec_ids", []):
            ctx.db.execute(
                "UPDATE recommendations SET status='notified', notified_at=?, notify_count=notify_count+1"
                " WHERE id=? AND status='pending'",
                (now, rec_id),
            )


async def flush(ctx: Context) -> int:
    rows = ctx.db.all("SELECT * FROM outbox WHERE status='pending' ORDER BY id")
    if not rows:
        return 0
    ids = [r["id"] for r in rows]
    ctx.db.execute(
        f"UPDATE outbox SET status='sending', attempts=attempts+1 WHERE id IN ({','.join('?' * len(ids))})",
        tuple(ids),
    )
    await ctx.checkpoint()  # отметка «отправляется» сохранена до фактической отправки
    sent = 0
    for i, row in enumerate(rows):
        payload = json.loads(row["payload"])
        try:
            result = await ctx.tg.send_message(
                ctx.owner_id,
                payload["text"],
                reply_markup=payload.get("reply_markup"),
                disable_notification=i > 0,  # один звуковой сигнал на всю подборку
            )
        except TelegramError as exc:
            final = row["attempts"] + 1 >= MAX_ATTEMPTS or (400 <= exc.code < 500 and exc.code != 429)
            ctx.db.execute(
                "UPDATE outbox SET status=?, error=? WHERE id=?",
                ("failed" if final else "pending", f"{exc.code}", row["id"]),
            )
            log.error("Уведомление не отправлено: %s", exc.code)
            continue
        message_id = result.get("message_id")
        ctx.db.execute(
            "UPDATE outbox SET status='sent', sent_at=?, tg_message_id=? WHERE id=?",
            (to_iso(ctx.now), message_id, row["id"]),
        )
        _mark_delivered(ctx, row, message_id)
        sent += 1
        await asyncio.sleep(0.4)
    ctx.stats.notified += sent
    log.info("Отправлено уведомлений: %d.", sent)
    return sent


async def close_answered_cards(ctx: Context) -> None:
    """Если автор ответил сам, карточка рекомендации тихо обновляется: кнопки убираются."""
    rows = ctx.db.all(
        "SELECT id, tg_message_id FROM recommendations WHERE status='answered' AND close_reason='author_replied'"
        " AND tg_message_id IS NOT NULL AND card_closed=0"
    )
    from app.services import recommendations

    for r in rows:
        ctx.db.execute("UPDATE recommendations SET card_closed=1 WHERE id=?", (r["id"],))
        full = recommendations.get_full(ctx, r["id"])
        if not full:
            continue
        text = screens.rec_text(ctx, full, header=screens.TITLE) + "\n\nВы уже ответили в обсуждении."
        kb = markup([[url_btn("Открыть комментарий", screens.rec_link(ctx, full))]])
        try:
            await ctx.tg.edit_message_text(ctx.owner_id, r["tg_message_id"], text, reply_markup=kb)
        except TelegramError:
            pass


async def deliver_pending_alternatives(ctx: Context) -> None:
    """«Другой вариант ответа», который не удалось подготовить сразу из-за лимита AI."""
    from app.services.ai_analyzer import generate_alternative

    rows = ctx.db.all("SELECT id, tg_message_id FROM recommendations WHERE alt_requested=1 LIMIT 3")
    for r in rows:
        alt = await generate_alternative(ctx, r["id"])
        if alt is None:
            return
        try:
            await ctx.tg.send_message(
                ctx.owner_id,
                f"<b>Другой вариант ответа</b>\n«{esc(alt)}»",
                reply_to_message_id=r["tg_message_id"],
                disable_notification=True,
            )
        except TelegramError as exc:
            log.error("Не удалось отправить вариант ответа: %s", exc.code)
