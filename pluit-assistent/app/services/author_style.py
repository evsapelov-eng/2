"""Профиль и стиль автора для генерации предлагаемых ответов."""

from __future__ import annotations

from app.context import Context
from app.utils.text import one_line, truncate

LENGTH_HINT = {
    "short": "Ответ — одно короткое предложение.",
    "normal": "Ответ — 1–3 коротких предложения.",
}
ADDRESS_HINT = {
    "auto": "Обращайся к подписчику так же, как он сам пишет (на «ты» или на «вы»); если непонятно — на «ты».",
    "ty": "Обращайся к подписчику на «ты».",
    "vy": "Обращайся к подписчику на «вы».",
}
LENGTH_LABEL = {"short": "коротко", "normal": "обычно"}
ADDRESS_LABEL = {"auto": "как подписчик", "ty": "на «ты»", "vy": "на «вы»"}


def style_block(ctx: Context) -> str:
    profile = ctx.config.author_profile or {}

    def bullets(key: str) -> str:
        return "\n".join(f"- {x}" for x in profile.get(key, []) or [])

    parts = [
        f"Проект: {profile.get('project', 'PLUIT')}.",
        str(profile.get("about", "")).strip(),
        "Темы канала:\n" + bullets("topics"),
        "Стиль автора:\n" + bullets("style"),
        "Никогда не используй фразы и обороты:\n" + bullets("avoid_phrases"),
        "Правила ответа:\n" + bullets("rules"),
        LENGTH_HINT.get(ctx.settings.reply_length, LENGTH_HINT["normal"]),
        ADDRESS_HINT.get(ctx.settings.reply_address, ADDRESS_HINT["auto"]),
    ]
    return "\n\n".join(p for p in parts if p.strip())


def author_examples(ctx: Context, limit: int = 5) -> list[str]:
    """Последние реальные ответы автора — образцы интонации."""
    rows = ctx.db.all(
        "SELECT text FROM messages WHERE author_kind='author' AND text != '' ORDER BY date DESC LIMIT ?", (limit,)
    )
    return [truncate(one_line(r["text"]), 200) for r in rows]
