"""Работа с пользовательским текстом: экранирование, обрезка, предварительный фильтр."""

from __future__ import annotations

import hashlib
import html
import re
import unicodedata

TELEGRAM_LIMIT = 4096

_REACTIONS = {
    "+",
    "++",
    "+1",
    "плюс",
    "класс",
    "классно",
    "круто",
    "огонь",
    "топ",
    "кайф",
    "кайфово",
    "пушка",
    "бомба",
    "супер",
    "отлично",
    "здорово",
    "шикарно",
    "красиво",
    "мощно",
    "вау",
    "ого",
    "ух",
    "уф",
    "лол",
    "ахах",
    "хаха",
    "аха",
    "ок",
    "окей",
    "ага",
    "да",
    "нет",
    "согласен",
    "согласна",
    "жиза",
    "база",
    "спасибо",
    "спс",
    "благодарю",
    "мерси",
    "лайк",
    "люблю",
    "обожаю",
    "прекрасно",
    "восторг",
    "имба",
    "nice",
    "cool",
    "wow",
    "fire",
    "top",
    "ok",
    "lol",
    "thanks",
    "love",
}
_INTENSIFIERS = {
    "очень",
    "просто",
    "так",
    "как",
    "всегда",
    "это",
    "ну",
    "вот",
    "же",
    "реально",
    "прям",
    "прямо",
    "большое",
    "огромное",
    "тебе",
    "вам",
    "за",
    "трек",
    "пост",
    "!",
    "мне",
}
_WORD = re.compile(r"[\w+]+", re.UNICODE)


def esc(text: str | None) -> str:
    return html.escape(text or "", quote=False)


def truncate(text: str | None, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    cut = text[: limit - 1].rstrip()
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut + "…"


def one_line(text: str | None) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def post_title(text: str | None, limit: int = 60) -> str:
    first = next((line for line in (text or "").splitlines() if line.strip()), "")
    return truncate(one_line(first), limit) or "Без текста"


def text_hash(text: str | None) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()[:16]


def _is_symbol(ch: str) -> bool:
    cat = unicodedata.category(ch)
    return cat.startswith(("S", "P", "Z", "C", "M")) or ch in "‍️"


def is_emoji_only(text: str | None) -> bool:
    stripped = (text or "").strip()
    return bool(stripped) and all(_is_symbol(ch) for ch in stripped) and "?" not in stripped


def is_trivial(text: str | None) -> bool:
    """Очевидно бессодержательная реакция: эмодзи, «+», «класс», «спасибо!».

    Короткий вопрос («когда концерт?») тривиальным не считается.
    """
    stripped = (text or "").strip()
    if not stripped:
        return True
    if "?" in stripped:
        return False
    if is_emoji_only(stripped):
        return True
    words = [w.lower() for w in _WORD.findall(stripped)]
    if not words:
        return True
    if len(words) > 4:
        return False
    meaningful = [w for w in words if w not in _INTENSIFIERS]
    return bool(meaningful) and all(w in _REACTIONS or w.rstrip("о") in _REACTIONS for w in meaningful)


def normalize_key(text: str) -> str:
    words = [w for w in _WORD.findall(text.lower()) if len(w) > 2]
    return " ".join(sorted(set(words))[:8]) or text.lower().strip()
