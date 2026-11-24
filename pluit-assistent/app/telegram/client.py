"""Минимальный асинхронный клиент Telegram Bot API на httpx.

Используются только документированные методы: getMe, getWebhookInfo, deleteWebhook,
getUpdates, sendMessage, editMessageText, editMessageReplyMarkup,
answerCallbackQuery, setMyCommands.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

API_BASE = "https://api.telegram.org"


class TelegramError(RuntimeError):
    def __init__(self, method: str, code: int, description: str, retry_after: int | None = None):
        super().__init__(f"Telegram {method}: {code} {description}")
        self.method = method
        self.code = code
        self.description = description
        self.retry_after = retry_after

    @property
    def not_modified(self) -> bool:
        return "message is not modified" in self.description.lower()


class TelegramClient:
    def __init__(self, token: str, *, transport: httpx.AsyncBaseTransport | None = None, max_retries: int = 2):
        self._base = f"{API_BASE}/bot{token}"
        self._client = httpx.AsyncClient(timeout=httpx.Timeout(40.0, connect=10.0), transport=transport)
        self._max_retries = max_retries

    async def __aenter__(self) -> TelegramClient:
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.close()

    async def close(self) -> None:
        await self._client.aclose()

    async def call(self, method: str, params: dict[str, Any] | None = None, *, timeout: float | None = None) -> Any:
        payload = {k: v for k, v in (params or {}).items() if v is not None}
        for key in ("reply_markup", "allowed_updates", "commands", "scope", "link_preview_options", "reply_parameters"):
            if key in payload and not isinstance(payload[key], str):
                payload[key] = json.dumps(payload[key], ensure_ascii=False)
        attempt = 0
        while True:
            try:
                response = await self._client.post(
                    f"{self._base}/{method}", data=payload, timeout=timeout or httpx.USE_CLIENT_DEFAULT
                )
                data = response.json()
            except (httpx.TransportError, ValueError) as exc:
                if attempt >= self._max_retries:
                    # Текст исключения httpx может содержать URL с токеном — не выводим его.
                    raise TelegramError(method, 0, f"сетевая ошибка ({type(exc).__name__})") from None
                attempt += 1
                await asyncio.sleep(2 * attempt)
                continue
            if data.get("ok"):
                return data.get("result")
            code = int(data.get("error_code") or response.status_code)
            description = str(data.get("description") or "")
            retry_after = (data.get("parameters") or {}).get("retry_after")
            if attempt < self._max_retries and (code == 429 or code >= 500):
                attempt += 1
                await asyncio.sleep(min(int(retry_after or 2 * attempt), 30))
                continue
            raise TelegramError(method, code, description, retry_after)

    # --- Методы API ---

    async def get_me(self) -> dict:
        return await self.call("getMe")

    async def get_webhook_info(self) -> dict:
        return await self.call("getWebhookInfo")

    async def delete_webhook(self) -> bool:
        # drop_pending_updates не передаётся: накопленные обновления сохраняются.
        return await self.call("deleteWebhook", {"drop_pending_updates": "false"})

    async def get_updates(
        self, offset: int | None, *, limit: int = 100, timeout: int = 0, allowed_updates: list[str] | None = None
    ) -> list[dict]:
        return await self.call(
            "getUpdates",
            {"offset": offset, "limit": limit, "timeout": timeout, "allowed_updates": allowed_updates},
            timeout=timeout + 15,
        )

    async def send_message(
        self,
        chat_id: int,
        text: str,
        *,
        reply_markup: dict | None = None,
        disable_notification: bool = False,
        reply_to_message_id: int | None = None,
    ) -> dict:
        return await self.call(
            "sendMessage",
            {
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "link_preview_options": {"is_disabled": True},
                "reply_markup": reply_markup,
                "disable_notification": "true" if disable_notification else None,
                "reply_parameters": (
                    {"message_id": reply_to_message_id, "allow_sending_without_reply": True}
                    if reply_to_message_id
                    else None
                ),
            },
        )

    async def edit_message_text(
        self, chat_id: int, message_id: int, text: str, *, reply_markup: dict | None = None
    ) -> dict | bool:
        return await self.call(
            "editMessageText",
            {
                "chat_id": chat_id,
                "message_id": message_id,
                "text": text,
                "parse_mode": "HTML",
                "link_preview_options": {"is_disabled": True},
                "reply_markup": reply_markup,
            },
        )

    async def edit_message_reply_markup(self, chat_id: int, message_id: int, reply_markup: dict | None) -> Any:
        return await self.call(
            "editMessageReplyMarkup",
            {"chat_id": chat_id, "message_id": message_id, "reply_markup": reply_markup or {"inline_keyboard": []}},
        )

    async def answer_callback_query(self, callback_query_id: str, text: str | None = None) -> bool:
        return await self.call("answerCallbackQuery", {"callback_query_id": callback_query_id, "text": text})

    async def set_my_commands(self, commands: list[dict], scope: dict | None = None) -> bool:
        return await self.call("setMyCommands", {"commands": commands, "scope": scope})

    async def get_chat(self, chat_id: int) -> dict:
        return await self.call("getChat", {"chat_id": chat_id})

    async def get_chat_member(self, chat_id: int, user_id: int) -> dict:
        return await self.call("getChatMember", {"chat_id": chat_id, "user_id": user_id})
