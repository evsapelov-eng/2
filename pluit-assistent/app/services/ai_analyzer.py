"""Анализ комментариев через Gemini API (официальный SDK google-genai) с жёсткими лимитами.

* Используются только модели из конфигурации (бесплатные). Переход на платные модели
  не предусмотрен; при исчерпании квоты комментарии ждут следующего запуска.
* Каждая попытка, в том числе неудачная, учитывается в дневном и разовом лимите.
* Несколько комментариев одного поста анализируются одним запросом.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import timedelta
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from app.context import Context
from app.prompts.analysis import alt_system, analysis_system, data_block, post_system
from app.schemas.analysis import (
    CATEGORIES,
    AlternativeReply,
    Analysis,
    BatchVerdict,
    CommentVerdict,
    PostTopicsBatch,
)
from app.services import author_style, ideas, recommendations
from app.services.priority_engine import final_priority
from app.services.rules import analyze_by_rules, prefilter_analysis
from app.utils.text import is_trivial, one_line, truncate
from app.utils.timeutil import from_iso, next_quota_reset, quota_day, to_iso

log = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

POST_CONTEXT_CHARS = 1500
COMMENT_CHARS = 1000
PARENT_CHARS = 500
THREAD_CONTEXT = 3
REPLY_MAX_CHARS = 400


class QuotaError(Exception):
    def __init__(self, per_day: bool):
        super().__init__("quota")
        self.per_day = per_day


class TransientError(Exception):
    pass


class FatalError(Exception):
    pass


class AIUnavailable(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason  # paused | no_key | run_limit | quota | error


class AIEngine(Protocol):
    async def call(self, model: str, system: str, user: str, schema: type[BaseModel]) -> str: ...


class GeminiEngine:
    def __init__(self, api_key: str, timeout_seconds: int):
        from google import genai
        from google.genai import types

        self._types = types
        self._client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=timeout_seconds * 1000))

    async def call(self, model: str, system: str, user: str, schema: type[BaseModel]) -> str:
        from google.genai import errors

        config = self._types.GenerateContentConfig(
            system_instruction=system,
            response_mime_type="application/json",
            response_schema=schema,
            temperature=0.6,
        )
        try:
            response = await self._client.aio.models.generate_content(model=model, contents=user, config=config)
        except errors.ClientError as exc:
            if exc.code == 429:
                detail = f"{exc.message or ''} {exc.details or ''}"
                raise QuotaError(per_day="PerDay" in detail or "per day" in detail.lower()) from None
            raise FatalError(f"HTTP {exc.code} {exc.status or ''}".strip()) from None
        except errors.ServerError as exc:
            raise TransientError(f"HTTP {exc.code}") from None
        except (TimeoutError, OSError) as exc:
            raise TransientError(type(exc).__name__) from None
        except Exception as exc:  # сетевые ошибки httpx внутри SDK
            if "Timeout" in type(exc).__name__ or "Connect" in type(exc).__name__:
                raise TransientError(type(exc).__name__) from None
            raise
        text = response.text
        if not text:
            raise TransientError("пустой ответ")
        return text


class AIGateway:
    """Лимиты, учёт запросов и выбор бесплатной модели."""

    def __init__(self, ctx: Context):
        self.ctx = ctx
        self.settings = ctx.config.settings

    def status(self) -> str | None:
        """None — AI доступен, иначе причина недоступности."""
        if self.ctx.ai is None:
            return "no_key"
        if self.ctx.settings.ai_paused:
            return "paused"
        return None

    def _blocked(self, model: str) -> bool:
        until = from_iso(self.ctx.meta.get(f"ai_blocked_until:{model}"))
        return bool(until and until > self.ctx.now)

    def available_models(self) -> list[str]:
        day = quota_day(self.ctx.now)
        return [
            m
            for m in self.settings.gemini_models
            if not self._blocked(m) and self.ctx.ai_usage.count(day, m) < self.settings.max_ai_requests_per_day
        ]

    async def generate(self, system: str, user: str, schema: type[T]) -> T:
        reason = self.status()
        if reason:
            raise AIUnavailable(reason)
        ctx = self.ctx
        last_reason = "quota"
        for model in self.settings.gemini_models:
            if self._blocked(model):
                continue
            attempts = 0
            while True:
                if ctx.stats.ai_requests >= self.settings.max_ai_requests_per_run:
                    raise AIUnavailable("run_limit")
                day = quota_day(ctx.now)
                if ctx.ai_usage.count(day, model) >= self.settings.max_ai_requests_per_day:
                    break
                ctx.ai_usage.add(day, model)
                ctx.stats.ai_requests += 1
                try:
                    raw = await ctx.ai.call(model, system, user, schema)
                    return schema.model_validate_json(raw)
                except QuotaError as exc:
                    log.warning("Gemini %s: квота исчерпана (%s).", model, "сутки" if exc.per_day else "минута")
                    if exc.per_day:
                        ctx.meta.set(f"ai_blocked_until:{model}", to_iso(next_quota_reset(ctx.now)))
                    last_reason = "quota"
                    break
                except (TransientError, ValidationError, json.JSONDecodeError) as exc:
                    attempts += 1
                    log.warning("Gemini %s: временная ошибка (%s).", model, type(exc).__name__)
                    last_reason = "error"
                    if attempts > self.settings.max_ai_retries:
                        break
                    await asyncio.sleep(3 * attempts)
                except FatalError as exc:
                    log.error("Gemini %s: ошибка запроса (%s).", model, exc)
                    last_reason = "error"
                    break
        raise AIUnavailable(last_reason)


# --- Подготовка контекста ---


def _label(kind: str) -> str:
    return "автор" if kind == "author" else "подписчик"


def _comment_payload(ctx: Context, row, ref: int) -> dict:
    db = ctx.db
    item: dict = {"ref": ref, "text": truncate(row["text"], COMMENT_CHARS), "author_replied": bool(row["answered_at"])}
    if row["reply_to_message_id"]:
        parent = db.one(
            "SELECT author_kind, text FROM messages WHERE chat_id=? AND message_id=?",
            (ctx.group_id, row["reply_to_message_id"]),
        )
        if parent:
            item["reply_to"] = {"from": _label(parent["author_kind"]), "text": truncate(parent["text"], PARENT_CHARS)}
    if row["thread_id"]:
        ctx_rows = db.all(
            "SELECT author_kind, text FROM messages WHERE chat_id=? AND thread_id=? AND date <= ? AND id != ? "
            "AND text != '' ORDER BY date DESC LIMIT ?",
            (ctx.group_id, row["thread_id"], row["date"], row["id"], THREAD_CONTEXT),
        )
        if ctx_rows:
            item["discussion_before"] = [
                {"from": _label(r["author_kind"]), "text": truncate(r["text"], 300)} for r in reversed(ctx_rows)
            ]
    return item


def _to_analysis(v: CommentVerdict, model: str | None) -> Analysis:
    cats = [c for c in v.categories if c in CATEGORIES] or ["обычная реакция"]
    reply = truncate(one_line(v.suggested_reply), REPLY_MAX_CHARS) if v.suggested_reply else None
    return Analysis(
        source="ai",
        categories=cats,
        topics=[truncate(one_line(t).lower(), 40) for t in v.topics[:3] if t.strip()],
        priority=v.priority,
        should_notify=v.should_notify,
        reason=truncate(one_line(v.reason), 300),
        suggested_reply=reply or None,
        potential_post_topic=truncate(one_line(v.potential_post_topic), 80) if v.potential_post_topic else None,
        potential_post_description=(
            truncate(one_line(v.potential_post_description), 300) if v.potential_post_description else None
        ),
        confidence=v.confidence,
        model=model,
    )


def save_analysis(ctx: Context, row, analysis: Analysis) -> None:
    db = ctx.db
    answered = bool(row["answered_at"])
    priority = final_priority(analysis, author_replied=answered)
    db.execute(
        "INSERT INTO analyses(message_row_id, source, categories, topics, priority, should_notify, reason,"
        " suggested_reply, potential_post_topic, confidence, model, text_hash, analyzed_at)"
        " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(message_row_id) DO UPDATE SET source=excluded.source,"
        " categories=excluded.categories, topics=excluded.topics, priority=excluded.priority,"
        " should_notify=excluded.should_notify, reason=excluded.reason, suggested_reply=excluded.suggested_reply,"
        " potential_post_topic=excluded.potential_post_topic, confidence=excluded.confidence, model=excluded.model,"
        " text_hash=excluded.text_hash, analyzed_at=excluded.analyzed_at",
        (
            row["id"],
            analysis.source,
            json.dumps(analysis.categories, ensure_ascii=False),
            json.dumps(analysis.topics, ensure_ascii=False),
            priority,
            int(analysis.should_notify),
            analysis.reason,
            analysis.suggested_reply,
            analysis.potential_post_topic,
            analysis.confidence,
            analysis.model,
            row["text_hash"],
            to_iso(ctx.now),
        ),
    )
    db.execute("UPDATE messages SET analysis_status='done', ai_pending_since=NULL WHERE id=?", (row["id"],))
    recommendations.sync(ctx, row["id"], priority)
    if (
        analysis.potential_post_topic
        and (analysis.confidence or 0) >= 0.6
        and not ({"спам", "провокация"} & set(analysis.categories))
    ):
        ideas.add_from_comment(ctx, row, analysis)
    ctx.stats.analyzed += 1


# --- Основной цикл анализа ---


def _pending_rows(ctx: Context):
    return ctx.db.all(
        "SELECT * FROM messages WHERE analysis_status='pending' AND author_kind='subscriber'"
        " AND resolve_status != 'pending' ORDER BY date"
    )


async def analyze_pending(ctx: Context) -> None:
    gateway = AIGateway(ctx)
    rows = _pending_rows(ctx)
    needs_ai = []
    for row in rows:
        if is_trivial(row["text"]):
            save_analysis(ctx, row, prefilter_analysis(row["text"]))
        else:
            needs_ai.append(row)

    unavailable = gateway.status()
    if unavailable:
        for row in needs_ai:
            save_analysis(ctx, row, analyze_by_rules(row["text"], author_replied=bool(row["answered_at"])))
        return

    by_post: dict[int | None, list] = {}
    for row in needs_ai:
        by_post.setdefault(row["post_id"], []).append(row)
    style = author_style.style_block(ctx)
    system = analysis_system(style, author_style.author_examples(ctx))
    chunk_size = ctx.config.settings.max_comments_per_ai_request
    stop = False
    for post_id, items in by_post.items():
        post = ctx.db.one("SELECT text FROM posts WHERE id=?", (post_id,)) if post_id else None
        for start in range(0, len(items), chunk_size):
            chunk = items[start : start + chunk_size]
            payload = {
                "post": truncate(post["text"], POST_CONTEXT_CHARS) if post else None,
                "comments": [_comment_payload(ctx, row, i + 1) for i, row in enumerate(chunk)],
            }
            try:
                result = await gateway.generate(system, data_block(payload), BatchVerdict)
            except AIUnavailable as exc:
                log.info("AI недоступен (%s): комментарии останутся в очереди.", exc.reason)
                stop = True
                break
            by_ref = {v.ref: v for v in result.items}
            for i, row in enumerate(chunk):
                verdict = by_ref.get(i + 1)
                if verdict:
                    save_analysis(ctx, row, _to_analysis(verdict, ctx.config.settings.gemini_model))
        if stop:
            break

    # Если AI недоступен слишком долго — анализ по правилам, чтобы важное не потерялось.
    limit = timedelta(hours=ctx.config.settings.ai_fallback_after_hours)
    for row in _pending_rows(ctx):
        since = from_iso(row["ai_pending_since"]) or from_iso(row["date"])
        if since and ctx.now - since >= limit and not is_trivial(row["text"]):
            save_analysis(ctx, row, analyze_by_rules(row["text"], author_replied=bool(row["answered_at"])))


async def analyze_post_topics(ctx: Context, limit: int = 10) -> None:
    gateway = AIGateway(ctx)
    if gateway.status():
        return
    posts = ctx.db.all(
        "SELECT id, text FROM posts WHERE topic_status='pending' AND text != '' ORDER BY date DESC LIMIT ?", (limit,)
    )
    if not posts:
        return
    payload = {"posts": [{"ref": i + 1, "text": truncate(p["text"], POST_CONTEXT_CHARS)} for i, p in enumerate(posts)]}
    try:
        result = await gateway.generate(post_system(), data_block(payload), PostTopicsBatch)
    except AIUnavailable:
        return
    for item in result.items:
        if 1 <= item.ref <= len(posts):
            ctx.db.execute(
                "UPDATE posts SET main_topic=?, extra_topics=?, topic_status='done' WHERE id=?",
                (
                    truncate(one_line(item.main_topic).lower(), 60),
                    json.dumps([truncate(one_line(t).lower(), 40) for t in item.extra_topics[:3]], ensure_ascii=False),
                    posts[item.ref - 1]["id"],
                ),
            )


async def generate_alternative(ctx: Context, rec_id: int) -> str | None:
    """Другой вариант ответа. None — AI сейчас недоступен (запрос останется в очереди)."""
    row = ctx.db.one(
        "SELECT r.alternatives, m.*, a.suggested_reply, p.text AS post_text FROM recommendations r"
        " JOIN messages m ON m.id=r.message_row_id LEFT JOIN analyses a ON a.message_row_id=m.id"
        " LEFT JOIN posts p ON p.id=m.post_id WHERE r.id=?",
        (rec_id,),
    )
    if not row:
        return None
    previous = [row["suggested_reply"], *json.loads(row["alternatives"])]
    payload = {
        "post": truncate(row["post_text"], POST_CONTEXT_CHARS) if row["post_text"] else None,
        "comment": _comment_payload(ctx, row, 1),
        "previous_suggestions": [p for p in previous if p],
    }
    gateway = AIGateway(ctx)
    try:
        result = await gateway.generate(
            alt_system(author_style.style_block(ctx)), data_block(payload), AlternativeReply
        )
    except AIUnavailable:
        return None
    reply = truncate(one_line(result.suggested_reply), REPLY_MAX_CHARS)
    alternatives = [*json.loads(row["alternatives"]), reply][-5:]
    ctx.db.execute(
        "UPDATE recommendations SET alternatives=?, alt_requested=0 WHERE id=?",
        (json.dumps(alternatives, ensure_ascii=False), rec_id),
    )
    return reply
