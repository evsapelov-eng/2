"""Упрощённый анализ без AI — по правилам.

Используется, когда AI приостановлен владельцем, ключ Gemini не задан или
бесплатная квота исчерпана дольше заданного времени. Предлагаемых ответов не
формирует: шаблонные ответы противоречат стилю автора.
"""

from __future__ import annotations

import re

from app.schemas.analysis import Analysis
from app.utils.text import is_trivial

_Q_WORDS = re.compile(
    r"^(как|когда|где|почему|зачем|что|чем|какой|какая|какие|каким|кто|сколько|будет|будут|можно|планируешь|"
    r"планируете|подскаж|расскаж|а\s+(как|когда|где|что|будет))\b",
    re.IGNORECASE,
)
_RULES: list[tuple[str, re.Pattern, int]] = [
    ("вопрос о концертах", re.compile(r"концерт|выступлен|гастрол|билет|лайв|live|сыгра(ешь|ете)", re.I), 15),
    (
        "вопрос о новых релизах",
        re.compile(r"релиз|альбом|\bеп\b|\bep\b|сингл|когда выйд|новый трек|новые треки", re.I),
        10,
    ),
    (
        "предложение сотрудничества",
        re.compile(r"сотруднич|коллаб|совместн|фит\b|feat|предлага(ю|ем)|напиши в лс", re.I),
        20,
    ),
    ("музыкальная рекомендация", re.compile(r"послушай|советую|рекомендую|посоветую|зацени|похоже на", re.I), 10),
    (
        "конструктивная критика",
        re.compile(r"не хватает|можно было бы|лучше бы|мне кажется|по-моему|сведени|мастеринг", re.I),
        10,
    ),
]
_SPAM = re.compile(r"(https?://|t\.me/|@\w+bot\b|заработ|крипт|казино|ставк|подпишись|переходи)", re.I)
_FIRST_PERSON = re.compile(r"\b(я|мне|меня|мой|моя|у меня)\b", re.I)


def analyze_by_rules(text: str, *, author_replied: bool = False) -> Analysis:
    if is_trivial(text):
        return prefilter_analysis(text)
    categories: list[str] = []
    score = 20
    stripped = text.strip()
    is_question = "?" in stripped or bool(_Q_WORDS.match(stripped))
    if _SPAM.search(stripped) and len(stripped) < 400:
        return Analysis(source="rules", categories=["спам"], priority=3, reason="Похоже на спам или рекламу.")
    if is_question:
        categories.append("вопрос автору")
        score += 45
    for category, pattern, bonus in _RULES:
        if pattern.search(stripped):
            categories.append(category)
            score += bonus
    if len(stripped) > 160 and _FIRST_PERSON.search(stripped):
        categories.append("личный опыт")
        score += 25
    elif len(stripped) > 80:
        categories.append("интересное мнение")
        score += 10
    if not categories:
        categories.append("обычная реакция")
    if author_replied:
        score = min(score, 20)
    score = max(0, min(score, 95))
    reason = {
        True: "Прямой вопрос автору.",
        False: "Содержательный комментарий." if score >= 50 else "Обычный комментарий.",
    }[is_question]
    return Analysis(
        source="rules",
        categories=categories,
        priority=score,
        should_notify=score >= 70,
        reason=reason + " Оценено без AI.",
        confidence=0.4,
    )


def prefilter_analysis(text: str) -> Analysis:
    thanks = bool(re.search(r"спасиб|спс|благодар|thanks|мерси", text or "", re.I))
    return Analysis(
        source="prefilter",
        categories=["благодарность"] if thanks else ["обычная реакция"],
        priority=5,
        reason="Короткая реакция.",
        confidence=1.0,
    )
