"""Итоговый приоритет комментария и уровни приоритета."""

from __future__ import annotations

from app.schemas.analysis import Analysis

LEVELS = ((80, "особый"), (60, "высокий"), (30, "средний"), (0, "низкий"))


def level(priority: int) -> str:
    return next(name for bound, name in LEVELS if priority >= bound)


def final_priority(analysis: Analysis, *, author_replied: bool) -> int:
    p = analysis.priority
    cats = set(analysis.categories)
    if "спам" in cats:
        p = min(p, 5)
    elif cats <= {"обычная реакция", "благодарность"} and cats:
        p = min(p, 25)
    if "нерелевантный комментарий" in cats:
        p = min(p, 25)
    if author_replied:
        p = min(p, 20)
    return max(0, min(100, p))
