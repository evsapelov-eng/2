"""Схемы структурированных ответов Gemini и результатов анализа."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Category = Literal[
    "вопрос автору",
    "личный опыт",
    "интересное мнение",
    "конструктивная критика",
    "музыкальная рекомендация",
    "предложение сотрудничества",
    "вопрос о концертах",
    "вопрос о новых релизах",
    "потенциальная тема для поста",
    "обычная реакция",
    "благодарность",
    "спам",
    "провокация",
    "нерелевантный комментарий",
]

CATEGORIES: tuple[str, ...] = Category.__args__  # type: ignore[attr-defined]
QUESTION_CATEGORIES = ("вопрос автору", "вопрос о концертах", "вопрос о новых релизах")


class CommentVerdict(BaseModel):
    """Ответ модели по одному комментарию (схема передаётся в Gemini)."""

    ref: int = Field(description="Номер комментария из входных данных")
    categories: list[Category] = Field(description="Одна или несколько категорий")
    topics: list[str] = Field(description="1–3 коротких темы обсуждения, строчными буквами")
    priority: int = Field(ge=0, le=100)
    should_notify: bool
    reason: str = Field(description="Почему стоит или не стоит отвечать, одно предложение")
    suggested_reply: str | None = Field(description="Вариант ответа автора или null")
    potential_post_topic: str | None = Field(description="Тема будущего поста или null")
    potential_post_description: str | None = Field(description="Одно предложение о теме поста или null")
    confidence: float = Field(ge=0, le=1)


class BatchVerdict(BaseModel):
    items: list[CommentVerdict]


class PostTopic(BaseModel):
    ref: int
    main_topic: str
    extra_topics: list[str]


class PostTopicsBatch(BaseModel):
    items: list[PostTopic]


class AlternativeReply(BaseModel):
    suggested_reply: str


class Analysis(BaseModel):
    """Нормализованный результат анализа, который сохраняется в БД."""

    source: Literal["ai", "rules", "prefilter"]
    categories: list[str] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    priority: int = 0
    should_notify: bool = False
    reason: str | None = None
    suggested_reply: str | None = None
    potential_post_topic: str | None = None
    potential_post_description: str | None = None
    confidence: float | None = None
    model: str | None = None

    @field_validator("priority")
    @classmethod
    def _clamp(cls, v: int) -> int:
        return max(0, min(100, int(v)))
