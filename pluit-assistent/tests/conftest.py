"""Тестовая инфраструктура: поддельный Telegram Bot API, поддельный Gemini, управляемые часы.

Все комментарии в тестах — вымышленные и обезличенные.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import re
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs

import httpx
import pytest

from app.config import Config, Secrets, Settings
from app.main import run_once
from app.schemas.analysis import AlternativeReply, BatchVerdict, PostTopicsBatch
from app.services.ai_analyzer import QuotaError, TransientError
from app.storage.encryption import generate_key
from app.storage.state_manager import LocalFileBackend
from app.telegram.client import TelegramClient

OWNER = 1001
CHANNEL = -1002000000001
GROUP = -1002000000002
STRANGER = 5005


class FakeTelegram:
    """Имитирует семантику getUpdates: вызов с offset подтверждает (удаляет) обновления с меньшим id."""

    def __init__(self) -> None:
        self.queue: list[dict] = []
        self.calls: list[tuple[str, dict]] = []
        self.sent: list[dict] = []
        self.edited: list[dict] = []
        self.answered: list[dict] = []
        self.webhook_url = ""
        self._uid = itertools.count(1)
        self._mid = itertools.count(9000)
        self.fail_send = False
        self.transport = httpx.MockTransport(self.handle)

    # --- построение обновлений ---

    def push(self, kind: str, obj: dict) -> int:
        uid = next(self._uid)
        self.queue.append({"update_id": uid, kind: obj})
        return uid

    # --- обработчик HTTP ---

    def handle(self, request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        params = {k: v[0] for k, v in parse_qs(request.content.decode()).items()}
        for key in ("reply_markup", "allowed_updates", "commands", "scope", "reply_parameters"):
            if key in params:
                params[key] = json.loads(params[key])
        self.calls.append((method, params))
        result: object = True
        if method == "getWebhookInfo":
            result = {"url": self.webhook_url, "pending_update_count": len(self.queue)}
        elif method == "deleteWebhook":
            self.webhook_url = ""
        elif method == "getUpdates":
            offset = int(params.get("offset") or 0)
            if offset:
                self.queue = [u for u in self.queue if u["update_id"] >= offset]
            limit = int(params.get("limit") or 100)
            result = self.queue[:limit]
        elif method == "sendMessage":
            if self.fail_send:
                return httpx.Response(200, json={"ok": False, "error_code": 400, "description": "Bad Request"})
            mid = next(self._mid)
            self.sent.append({**params, "message_id": mid})
            result = {"message_id": mid, "chat": {"id": int(params["chat_id"])}, "date": 1}
        elif method == "editMessageText":
            self.edited.append(params)
            result = {"message_id": int(params["message_id"])}
        elif method == "answerCallbackQuery":
            self.answered.append(params)
        return httpx.Response(200, json={"ok": True, "result": result})

    def owner_messages(self) -> list[dict]:
        return [m for m in self.sent if int(m["chat_id"]) == OWNER]


def default_verdict(item: dict) -> dict:
    text = item["text"]
    if "игнорируй" in text.lower():
        return dict(
            categories=["провокация"],
            topics=[],
            priority=10,
            should_notify=False,
            reason="Попытка управлять ботом.",
            suggested_reply=None,
            potential_post_topic=None,
            potential_post_description=None,
            confidence=0.9,
        )
    if "?" in text:
        return dict(
            categories=["вопрос автору"],
            topics=["концерты"],
            priority=85,
            should_notify=True,
            reason="Прямой вопрос автору.",
            suggested_reply="Скоро расскажу, следи за каналом.",
            potential_post_topic=None,
            potential_post_description=None,
            confidence=0.9,
        )
    if len(text) > 60:
        return dict(
            categories=["личный опыт"],
            topics=["живая музыка"],
            priority=82,
            should_notify=True,
            reason="Подписчик поделился личным опытом.",
            suggested_reply="А помнишь концерт, на котором особенно сильно это почувствовал?",
            potential_post_topic="Концерты, которые запомнились",
            potential_post_description="Спросить подписчиков о самых ярких концертах.",
            confidence=0.9,
        )
    return dict(
        categories=["интересное мнение"],
        topics=["музыка"],
        priority=40,
        should_notify=False,
        reason="Обычное мнение.",
        suggested_reply=None,
        potential_post_topic=None,
        potential_post_description=None,
        confidence=0.7,
    )


class FakeAI:
    def __init__(self) -> None:
        self.calls: list[dict] = []
        self.comment_calls: list[dict] = []
        self.raise_error: Exception | None = None
        self.verdict = default_verdict

    async def call(self, model, system, user, schema):
        payload = json.loads(re.search(r"<data>\n(.*)\n</data>", user, re.S).group(1))
        self.calls.append({"model": model, "system": system, "payload": payload, "schema": schema})
        if schema is BatchVerdict:
            self.comment_calls.append(self.calls[-1])
        if self.raise_error:
            raise self.raise_error
        if schema is BatchVerdict:
            return json.dumps(
                {"items": [{"ref": c["ref"], **self.verdict(c)} for c in payload["comments"]]}, ensure_ascii=False
            )
        if schema is PostTopicsBatch:
            return json.dumps(
                {
                    "items": [
                        {"ref": p["ref"], "main_topic": "концерты", "extra_topics": ["живая музыка"]}
                        for p in payload["posts"]
                    ]
                },
                ensure_ascii=False,
            )
        if schema is AlternativeReply:
            return json.dumps(
                {"suggested_reply": f"Вариант {len(self.calls)}: а что запомнилось больше всего?"}, ensure_ascii=False
            )
        raise AssertionError(schema)


class Clock:
    def __init__(self, dt: datetime) -> None:
        self.dt = dt

    def __call__(self) -> datetime:
        return self.dt

    def advance(self, **kw) -> None:
        self.dt += timedelta(**kw)


class Harness:
    def __init__(self, tmp_path) -> None:
        self.tg = FakeTelegram()
        self.ai = FakeAI()
        # Вторник, 24.11.2026, 12:10 по Москве.
        self.clock = Clock(datetime(2026, 11, 24, 9, 10, tzinfo=UTC))
        self.state_path = tmp_path / "state.enc"
        self.key = generate_key()
        self.settings_overrides: dict = {}
        self.ai_enabled = True
        self._msg = itertools.count(100)
        self._cb = itertools.count(1)
        self.last_ctx = None

    @property
    def config(self) -> Config:
        return Config(
            secrets=Secrets(
                telegram_bot_token="TEST:TOKEN",
                gemini_api_key="test-key" if self.ai_enabled else None,
                owner_telegram_id=OWNER,
                channel_id=CHANNEL,
                discussion_group_id=GROUP,
                state_encryption_key=self.key,
            ),
            settings=Settings(
                state_backend="local",
                state_local_path=str(self.state_path),
                interactive_window_seconds=0,
                gemini_model="free-model-a",
                gemini_fallback_model="free-model-b",
                **self.settings_overrides,
            ),
            author_profile={"project": "PLUIT", "style": ["коротко"], "avoid_phrases": ["Друзья"]},
        )

    def run(self, **kw):
        async def go():
            tg = TelegramClient("TEST:TOKEN", transport=self.tg.transport, max_retries=0)
            try:
                return await run_once(
                    self.config,
                    backend=LocalFileBackend(self.state_path),
                    tg=tg,
                    ai=self.ai if self.ai_enabled else None,
                    clock=self.clock,
                    import_file=kw.pop("import_file", None),
                    interactive_window=0,
                    **kw,
                )
            finally:
                await tg.close()

        self.last_ctx = asyncio.run(go())
        return self.last_ctx

    # --- фабрики сообщений ---

    def unix(self, minutes_ago: int = 5) -> int:
        return int((self.clock() - timedelta(minutes=minutes_ago)).timestamp())

    def channel_post(self, channel_post_id: int = 50, text: str = "Сегодня поймал себя на одной мысли") -> int:
        group_mid = next(self._msg)
        self.tg.push(
            "message",
            {
                "message_id": group_mid,
                "date": self.unix(30),
                "chat": {"id": GROUP, "type": "supergroup"},
                "sender_chat": {"id": CHANNEL, "type": "channel", "title": "PLUIT Club"},
                "is_automatic_forward": True,
                "forward_origin": {
                    "type": "channel",
                    "chat": {"id": CHANNEL, "type": "channel"},
                    "message_id": channel_post_id,
                    "date": self.unix(31),
                },
                "text": text,
            },
        )
        return group_mid

    def comment(
        self,
        text: str,
        *,
        thread: int | None,
        reply_to: int | None = None,
        user_id: int = 7001,
        username: str | None = "listener",
        edited_from: int | None = None,
        minutes_ago: int = 5,
    ) -> int:
        mid = edited_from or next(self._msg)
        msg = {
            "message_id": mid,
            "date": self.unix(minutes_ago),
            "chat": {"id": GROUP, "type": "supergroup"},
            "from": {"id": user_id, "is_bot": False, "first_name": "Слушатель", "username": username},
            "text": text,
        }
        if thread:
            msg["message_thread_id"] = thread
            msg["reply_to_message"] = {
                "message_id": reply_to or thread,
                "date": self.unix(30),
                "chat": {"id": GROUP, "type": "supergroup"},
            }
        if edited_from:
            msg["edit_date"] = self.unix(1)
            self.tg.push("edited_message", msg)
        else:
            self.tg.push("message", msg)
        return mid

    def owner_reply(
        self, text: str, *, thread: int, reply_to: int, as_channel: bool = False, anonymous: bool = False
    ) -> int:
        mid = next(self._msg)
        msg = {
            "message_id": mid,
            "date": self.unix(1),
            "chat": {"id": GROUP, "type": "supergroup"},
            "from": {"id": OWNER, "is_bot": False, "first_name": "Автор"},
            "text": text,
            "message_thread_id": thread,
            "reply_to_message": {"message_id": reply_to, "date": self.unix(5), "chat": {"id": GROUP}},
        }
        if as_channel:
            msg["from"] = {"id": 136817688, "is_bot": True, "first_name": "Channel", "username": "Channel_Bot"}
            msg["sender_chat"] = {"id": CHANNEL, "type": "channel", "title": "PLUIT Club"}
        if anonymous:
            msg["from"] = {"id": 1087968824, "is_bot": True, "first_name": "Group", "username": "GroupAnonymousBot"}
            msg["sender_chat"] = {"id": GROUP, "type": "supergroup", "title": "PLUIT Chat"}
        self.tg.push("message", msg)
        return mid

    def command(self, text: str, user_id: int = OWNER) -> None:
        self.tg.push(
            "message",
            {
                "message_id": next(self._msg),
                "date": self.unix(1),
                "chat": {"id": user_id, "type": "private"},
                "from": {"id": user_id, "is_bot": False, "first_name": "X"},
                "text": text,
            },
        )

    def callback(self, data: str, message_id: int | None = None, user_id: int = OWNER) -> None:
        cq = {
            "id": f"cq{next(self._cb)}",
            "from": {"id": user_id, "is_bot": False, "first_name": "X"},
            "chat_instance": "1",
            "data": data,
        }
        if message_id:
            cq["message"] = {
                "message_id": message_id,
                "date": self.unix(10),
                "chat": {"id": user_id, "type": "private"},
            }
        self.tg.push("callback_query", cq)


@pytest.fixture
def h(tmp_path) -> Harness:
    return Harness(tmp_path)


__all__ = ["CHANNEL", "GROUP", "OWNER", "STRANGER", "Harness", "QuotaError", "TransientError"]


@pytest.fixture(autouse=True)
def _no_swallowed_exceptions(caplog):
    yield
    swallowed = [r for r in caplog.records if r.exc_info]
    assert not swallowed, [r.getMessage() for r in swallowed]
