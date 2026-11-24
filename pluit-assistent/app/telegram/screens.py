"""Экраны интерфейса: текст (HTML) + inline-клавиатура. Весь текст — на русском."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import timedelta

from app.context import Context
from app.services import analytics, editorial_archive, ideas, recommendations
from app.services.author_style import ADDRESS_LABEL, LENGTH_LABEL
from app.services.priority_engine import level
from app.telegram.keyboards import back_to_menu, btn, markup, pager, recommendation_keyboard, url_btn
from app.utils.links import comment_link, post_link
from app.utils.text import esc, one_line, post_title, truncate
from app.utils.timeutil import (
    fmt_date,
    from_iso,
    human_duration,
    plural,
    quota_day,
    start_of_local_day,
    to_iso,
)

TITLE = "<b>PLUIT Assistent</b>"
MODE_LABEL = {"smart": "Умный", "digest": "Дайджест", "quiet": "Тихий"}
MODE_HINT = {
    "smart": "рекомендации при каждой плановой проверке",
    "digest": "один отчёт вечером",
    "quiet": "только сбор и анализ, без уведомлений",
}
STATUS_LABEL = {
    "pending": "требует ответа",
    "notified": "требует ответа",
    "snoozed": "отложен",
    "answered": "отвечен",
    "skipped": "пропущен",
}
DELAY_NOTE = "Кнопки и команды обрабатываются при ближайшей проверке, кроме «Открыть комментарий»."


@dataclass
class Screen:
    text: str
    keyboard: dict | None = None


def _onoff(value: bool) -> str:
    return "вкл" if value else "выкл"


def _next_check(ctx: Context) -> str:
    nxt = ctx.config.settings.next_check(ctx.now)
    return f"Следующая проверка: около {nxt.astimezone(ctx.tz):%H:%M}" if nxt else ""


def _subscriber(row) -> str:
    if row["username"]:
        return "@" + esc(row["username"])
    return esc(row["display_name"] or "подписчик")


def rec_link(ctx: Context, row) -> str:
    s = ctx.config.settings
    return comment_link(
        s.channel_username, ctx.channel_id, ctx.group_id, row["channel_post_id"], row["message_id"], row["thread_id"]
    )


def rec_text(ctx: Context, row, header: str | None = None) -> str:
    alternatives = json.loads(row["alternatives"] or "[]")
    parts = []
    if header:
        parts.append(header)
    post = f"«{esc(post_title(row['post_text']))}»" if row["post_text"] else "без привязки к посту"
    priority = row["priority"] if row["priority"] is not None else 0
    parts.append(
        f"Пост: {post}\nПодписчик: {_subscriber(row)}\n"
        f"{fmt_date(from_iso(row['date']), ctx.tz)} · приоритет {priority} ({level(priority)})"
    )
    parts.append(f"<b>Комментарий</b>\n«{esc(truncate(row['text'], 1200))}»")
    if row["reason"]:
        parts.append(f"<b>Почему стоит ответить</b>\n{esc(row['reason'])}")
    if row["suggested_reply"]:
        parts.append(f"<b>Вариант ответа</b>\n«{esc(row['suggested_reply'])}»")
    for alt in alternatives[-2:]:
        parts.append(f"<b>Другой вариант</b>\n«{esc(alt)}»")
    if row["status"] not in ("pending", "notified"):
        extra = ""
        if row["status"] == "snoozed" and row["remind_at"]:
            extra = f", напомню после {from_iso(row['remind_at']).astimezone(ctx.tz):%d.%m %H:%M}"
        parts.append(f"Статус: {STATUS_LABEL.get(row['status'], row['status'])}{extra}.")
    return "\n\n".join(parts)


# --- Главное меню ---


def main_menu(ctx: Context) -> Screen:
    start = to_iso(start_of_local_day(ctx.now, ctx.tz))
    comments = ctx.db.scalar("SELECT COUNT(*) FROM messages WHERE author_kind='subscriber' AND date >= ?", (start,))
    paused = ctx.settings.notifications_paused
    lines = [
        TITLE,
        "",
        "<b>Сводка за сегодня</b>",
        f"Комментарии: {comments}",
        f"Требуют внимания: {recommendations.open_count(ctx)}",
        f"Новые идеи: {ideas.count(ctx, 'new')}",
    ]
    if paused:
        lines += ["", "Уведомления приостановлены."]
    note = _next_check(ctx)
    if note:
        lines += ["", note]
    kb = markup(
        [
            [btn("Входящие", "in:o:0"), btn("Аналитика", "st:7")],
            [btn("Архив постов", "ar:0"), btn("Идеи для постов", "id:n:0")],
            [btn("Настройки", "se")],
            [btn("Возобновить уведомления" if paused else "Приостановить уведомления", "pz")],
        ]
    )
    return Screen("\n".join(lines), kb)


# --- Входящие ---


def inbox(ctx: Context, filter_key: str = "o", page: int = 0) -> Screen:
    if filter_key not in recommendations.FILTERS:
        filter_key = "o"
    rows, total = recommendations.list_page(ctx, filter_key, page)
    if total and page >= total:
        page = total - 1
        rows, total = recommendations.list_page(ctx, filter_key, page)
    title = recommendations.FILTERS[filter_key][0]
    filter_rows = [
        [btn(("• " if k == filter_key else "") + recommendations.FILTERS[k][0], f"in:{k}:0") for k in ("o", "s")],
        [btn(("• " if k == filter_key else "") + recommendations.FILTERS[k][0], f"in:{k}:0") for k in ("d", "k", "a")],
    ]
    if not rows:
        return Screen(f"<b>Входящие · {title}</b>\n\nПусто.", markup([*filter_rows, back_to_menu()]))
    row = rows[0]
    text = rec_text(ctx, row, header=f"<b>Входящие · {title}</b> · {page + 1} из {total}")
    card = recommendation_keyboard(row["id"], rec_link(ctx, row), row["status"], origin=f"{filter_key}:{page}")
    rows_kb = card["inline_keyboard"]
    rows_kb.append(pager(f"in:{filter_key}", page, total))
    rows_kb.extend(filter_rows)
    rows_kb.append(back_to_menu())
    return Screen(text, markup(rows_kb))


# --- Аналитика ---


def stats(ctx: Context, period: str = "7") -> Screen:
    if period not in analytics.PERIODS:
        period = "7"
    start, end = analytics.period_bounds(ctx, period)
    st = analytics.collect(ctx, start, end)
    began = analytics.collection_started(ctx)
    lines = [f"<b>Аналитика · {analytics.PERIODS[period]}</b>", ""]
    lines.append(f"Комментарии: {st.comments}")
    lines.append(f"Уникальные комментаторы: {st.commenters}")
    lines.append(f"Ответы автора: {st.author_replies}")
    lines.append(f"Вопросы без ответа: {st.unanswered_questions}")
    lines.append(
        "Среднее время ответа: "
        + (human_duration(st.avg_response_seconds) if st.avg_response_seconds else "нет данных")
    )
    if st.top_posts:
        lines += ["", "<b>Обсуждаемые публикации</b>"]
        lines += [f"— «{esc(t)}»: {n}" for t, n in st.top_posts]
    if st.topics:
        lines += ["", "<b>Основные темы</b>"]
        lines += [f"— {esc(t)}" for t, _ in st.topics]
    if st.previous_comments is not None and period != "all":
        diff = st.comments - st.previous_comments
        trend = "без изменений" if diff == 0 else (f"+{diff}" if diff > 0 else str(diff))
        spark = analytics.sparkline(st.daily)
        lines += ["", "<b>Динамика</b>", f"К предыдущему периоду: {trend}"]
        if spark:
            lines.append(spark)
    lines += ["", f"Данные собираются с {fmt_date(began, ctx.tz, with_time=False)}." if began else ""]
    lines.append("Просмотры и охваты боту недоступны.")
    kb = markup(
        [
            [btn(("• " if p == period else "") + label, f"st:{p}") for p, label in (("t", "Сегодня"), ("7", "7 дней"))],
            [
                btn(("• " if p == period else "") + label, f"st:{p}")
                for p, label in (("30", "30 дней"), ("all", "Всё время"))
            ],
            back_to_menu(),
        ]
    )
    return Screen("\n".join(line for line in lines if line is not None), kb)


# --- Архив постов ---


def archive(ctx: Context, page: int = 0) -> Screen:
    per_page = 5
    rows, total = editorial_archive.list_page(ctx, page, per_page)
    pages = max(1, -(-total // per_page))
    if not rows:
        return Screen(
            "<b>Архив постов</b>\n\nПока пусто. Посты появляются автоматически, когда выходят в канале. "
            "Старые посты можно импортировать из JSON (см. README).",
            markup([back_to_menu()]),
        )
    lines = ["<b>Архив постов</b>", ""]
    buttons = []
    for i, r in enumerate(rows, start=1 + page * per_page):
        date = fmt_date(from_iso(r["date"]), ctx.tz, with_time=False)
        lines.append(f"{i}. {date} · «{esc(post_title(r['text'], 50))}» · {r['comments']} комм.")
        buttons.append(btn(str(i), f"ap:{r['id']}:{page}"))
    return Screen("\n".join(lines), markup([buttons, pager("ar", page, pages), back_to_menu()]))


def archive_post(ctx: Context, post_id: int, back_page: int = 0) -> Screen:
    data = editorial_archive.details(ctx, post_id)
    if not data:
        return Screen("Пост не найден.", markup([[btn("К архиву", f"ar:{back_page}")]]))
    post = data["post"]
    s = ctx.config.settings
    link = post_link(s.channel_username, ctx.channel_id, post["channel_post_id"])
    extra = json.loads(post["extra_topics"] or "[]")
    lines = [
        f"<b>«{esc(post_title(post['text']))}»</b>",
        fmt_date(from_iso(post["date"]), ctx.tz),
        "",
        "Тема: " + (esc(post["main_topic"]) if post["main_topic"] else "не определена"),
    ]
    if extra:
        lines.append("Дополнительно: " + esc(", ".join(extra)))
    lines.append(f"Комментарии: {data['comments']} · ответы автора: {data['author_replies']}")
    if data["top"]:
        lines += ["", "<b>Интересные реакции</b>"]
        lines += [f"— «{esc(truncate(one_line(r['text']), 120))}»" for r in data["top"]]
    if data["ideas"]:
        lines += ["", "<b>Продолжение темы</b>"]
        lines += [f"— {esc(r['title'])}" for r in data["ideas"]]
    lines += ["", esc(truncate(post["text"], 1500))]
    rows = []
    if link:
        rows.append([url_btn("Открыть пост", link)])
    rows.append([btn("К архиву", f"ar:{back_page}"), *back_to_menu()])
    return Screen("\n".join(lines), markup(rows))


# --- Идеи ---


def ideas_screen(ctx: Context, code: str = "n", index: int = 0) -> Screen:
    status = ideas.STATUS_CODES.get(code, "new")
    row, total = ideas.page(ctx, status, index)
    if total and index >= total:
        index = total - 1
        row, total = ideas.page(ctx, status, index)
    filters = [
        [
            btn(("• " if c == code else "") + ideas.STATUSES[s], f"id:{c}:0")
            for c, s in list(ideas.STATUS_CODES.items())[:2]
        ],
        [
            btn(("• " if c == code else "") + ideas.STATUSES[s], f"id:{c}:0")
            for c, s in list(ideas.STATUS_CODES.items())[2:]
        ],
    ]
    header = f"<b>Идеи для постов · {ideas.STATUSES[status]}</b>"
    if not row:
        return Screen(
            header + "\n\nПусто. Идеи появляются, только когда комментарии действительно подсказывают тему.",
            markup([*filters, back_to_menu()]),
        )
    lines = [f"{header} · {index + 1} из {total}", "", f"<b>{esc(row['title'])}</b>"]
    if row["description"]:
        lines.append(esc(row["description"]))
    if row["reason"]:
        lines += ["", "Откуда: " + esc(row["reason"])]
    lines.append(f"Добавлена: {fmt_date(from_iso(row['created_at']), ctx.tz, with_time=False)}")
    actions = [
        btn(ideas.STATUSES[s], f"ix:{row['id']}:{ideas.CODE_OF[s]}:{code}:{index}")
        for s in ("in_progress", "used", "rejected", "new")
        if s != status
    ]
    rows = []
    if row["source_link"]:
        rows.append([url_btn("Исходный комментарий", row["source_link"])])
    rows += [actions[:2], actions[2:], pager(f"id:{code}", index, total), *filters, back_to_menu()]
    return Screen("\n".join(lines), markup(rows))


# --- Настройки ---


def settings_screen(ctx: Context) -> Screen:
    st = ctx.settings
    mode = st.notification_mode
    lines = [
        "<b>Настройки</b>",
        "",
        f"Режим: {MODE_LABEL[mode]} — {MODE_HINT[mode]}",
        f"Порог приоритета: {st.notification_threshold}",
        f"Рекомендаций за проверку: {st.max_recommendations_per_run}",
        f"Вечерняя сводка: {_onoff(st.daily_summary_enabled)}",
        f"Еженедельный отчёт: {_onoff(st.weekly_report_enabled)}",
        f"Стиль ответов: {LENGTH_LABEL.get(st.reply_length, st.reply_length)}, "
        f"{ADDRESS_LABEL.get(st.reply_address, st.reply_address)}",
        f"Хранение комментариев: {st.data_retention_days} дн.",
        f"AI-анализ: {'приостановлен' if st.ai_paused else 'вкл'}",
        f"Уведомления: {'приостановлены' if st.notifications_paused else 'вкл'}",
        "",
        "Расписание проверок меняется в .github/workflows/bot.yml.",
    ]
    kb = markup(
        [
            [btn(f"Режим: {MODE_LABEL[mode]}", "se:mode")],
            [btn("Порог −10", "se:th-"), btn("Порог +10", "se:th+")],
            [btn("Рекомендаций −1", "se:mx-"), btn("Рекомендаций +1", "se:mx+")],
            [
                btn(f"Сводка: {_onoff(st.daily_summary_enabled)}", "se:ds"),
                btn(f"Отчёт: {_onoff(st.weekly_report_enabled)}", "se:wr"),
            ],
            [btn("Длина ответа", "se:len"), btn("Обращение", "se:adr")],
            [btn(f"Хранение: {st.data_retention_days} дн.", "se:ret")],
            [
                btn("AI: " + ("выкл" if st.ai_paused else "вкл"), "se:ai"),
                btn("Уведомления: " + ("выкл" if st.notifications_paused else "вкл"), "pz:se"),
            ],
            back_to_menu(),
        ]
    )
    return Screen("\n".join(lines), kb)


# --- Состояние системы, помощь, сводка ---


def status_screen(ctx: Context) -> Screen:
    s = ctx.config.settings
    last_ok = from_iso(ctx.meta.get("last_success_at"))
    began = analytics.collection_started(ctx)
    day = quota_day(ctx.now)
    usage = ", ".join(f"{m}: {ctx.ai_usage.count(day, m)}/{s.max_ai_requests_per_day}" for m in s.gemini_models)
    if ctx.ai is None:
        ai_state = "ключ Gemini не задан — анализ по правилам"
    elif ctx.settings.ai_paused:
        ai_state = "приостановлен владельцем — анализ по правилам"
    else:
        blocked = [m for m in s.gemini_models if (from_iso(ctx.meta.get(f"ai_blocked_until:{m}")) or ctx.now) > ctx.now]
        ai_state = "работает" if len(blocked) < len(s.gemini_models) else "дневная квота исчерпана"
    waiting = ctx.db.scalar("SELECT COUNT(*) FROM messages WHERE analysis_status='pending'")
    lines = [
        "<b>Состояние системы</b>",
        "",
        f"Последняя успешная проверка: {fmt_date(last_ok, ctx.tz)}",
        _next_check(ctx),
        f"Режим уведомлений: {MODE_LABEL[ctx.settings.notification_mode]}"
        + (" (приостановлены)" if ctx.settings.notifications_paused else ""),
        f"AI: {ai_state}",
        f"Модель: {esc(s.gemini_model)}"
        + (f", запасная {esc(s.gemini_fallback_model)}" if s.gemini_fallback_model else ""),
        f"Запросы AI сегодня: {usage}",
        f"Ждут анализа: {waiting}",
        f"Постов в архиве: {ctx.db.scalar('SELECT COUNT(*) FROM posts')}",
        f"Комментариев в базе: {ctx.db.scalar('SELECT COUNT(*) FROM messages WHERE author_kind=?', ('subscriber',))}",
        f"Сбор данных с {fmt_date(began, ctx.tz, with_time=False)}" if began else "",
        "",
        DELAY_NOTE,
    ]
    return Screen("\n".join(line for line in lines if line is not None), markup([back_to_menu()]))


def help_screen(ctx: Context) -> Screen:
    text = f"""{TITLE}

Помощник читает комментарии в обсуждениях канала и подсказывает, на какие стоит ответить. Сам он никому не пишет и ничего не публикует.

<b>Команды</b>
/menu — главное меню
/inbox — входящие комментарии
/stats — аналитика
/archive — архив постов
/ideas — идеи для постов
/settings — настройки
/digest — текущая сводка
/pause — приостановить уведомления
/resume — возобновить уведомления
/status — состояние системы
/forget — удалить данные подписчика: /forget 123456789 или /forget @username
/help — помощь

<b>Важно</b>
Бот работает по расписанию: 09:00, 12:00, 15:00, 18:00 и 21:00 по Москве (GitHub может запускать с опозданием). {DELAY_NOTE} Сразу после проверки, в которой вы пользовались ботом, он ещё немного времени отвечает мгновенно.

Внеплановую проверку можно запустить вручную: GitHub → Actions → PLUIT Assistent → Run workflow."""
    return Screen(text, markup([back_to_menu()]))


def digest_text(ctx: Context, *, limit: int = 5, title: str = "Сводка") -> str | None:
    """Текущая сводка. None — если показать нечего."""
    start = start_of_local_day(ctx.now, ctx.tz)
    st = analytics.collect(ctx, start, ctx.now, with_daily=False)
    rows, total = recommendations.list_page(ctx, "o", 0, per_page=limit)
    lines = [
        f"<b>{title}</b>",
        "",
        f"Комментарии сегодня: {st.comments}",
        f"Ответы автора сегодня: {st.author_replies}",
        f"Требуют внимания: {total}",
    ]
    new_ideas = ideas.count(ctx, "new")
    if new_ideas:
        lines.append(f"Новые идеи: {new_ideas}")
    for i, r in enumerate(rows, start=1):
        post = f" · «{esc(post_title(r['post_text'], 40))}»" if r["post_text"] else ""
        lines += [
            "",
            f"{i}. {_subscriber(r)}{post} · {r['priority']}",
            f"«{esc(truncate(one_line(r['text']), 220))}»",
        ]
        if r["suggested_reply"]:
            lines.append(f"Вариант: «{esc(r['suggested_reply'])}»")
    if total > len(rows):
        lines += ["", f"Ещё {total - len(rows)} — во входящих."]
    return "\n".join(lines)


def digest_keyboard(ctx: Context, limit: int = 5) -> dict:
    rows, _ = recommendations.list_page(ctx, "o", 0, per_page=limit)
    links = [url_btn(f"Открыть {i}", rec_link(ctx, r)) for i, r in enumerate(rows, start=1)]
    return markup([links[:3], links[3:6], [btn("Входящие", "in:o:0"), *back_to_menu()]])


def weekly_report_text(ctx: Context, start, end) -> str | None:
    st = analytics.collect(ctx, start, end, with_daily=False)
    if st.comments == 0:
        return None
    lines = [
        "<b>Итоги недели</b>",
        f"{fmt_date(start, ctx.tz, with_time=False)} — {fmt_date(end - timedelta(seconds=1), ctx.tz, with_time=False)}",
        "",
        f"Новых комментариев: {st.comments}.",
        f"Уникальных комментаторов: {st.commenters}.",
        f"Ответов автора: {st.author_replies}.",
        f"Вопросов без ответа: {st.unanswered_questions}.",
    ]
    if st.top_posts:
        lines.append(f"Самая обсуждаемая публикация: «{esc(st.top_posts[0][0])}».")
    if st.topics:
        lines += ["", "Основные темы:"] + [f"— {esc(t)}" for t, _ in st.topics[:3]]
    new_ideas = ctx.db.all(
        "SELECT title FROM ideas WHERE status IN ('new','in_progress') AND created_at >= ? AND created_at < ?"
        " ORDER BY created_at DESC LIMIT 3",
        (to_iso(start), to_iso(end)),
    )
    if new_ideas:
        lines += ["", "Что можно обсудить на следующей неделе:"] + [f"— {esc(r['title'])}" for r in new_ideas]
    return "\n".join(lines)


def plural_comments(n: int) -> str:
    return f"{n} {plural(n, 'комментарий', 'комментария', 'комментариев')}"
