"""Прямые ссылки на сообщения Telegram."""

from __future__ import annotations


def _internal_id(chat_id: int) -> int:
    # Для супергрупп и каналов chat_id имеет вид -100XXXXXXXXXX, ссылки t.me/c/ используют XXXXXXXXXX.
    s = str(abs(chat_id))
    return int(s[3:]) if s.startswith("100") and len(s) > 10 else abs(chat_id)


def post_link(channel_username: str, channel_id: int, channel_post_id: int | None) -> str | None:
    if not channel_post_id:
        return None
    if channel_username:
        return f"https://t.me/{channel_username}/{channel_post_id}"
    return f"https://t.me/c/{_internal_id(channel_id)}/{channel_post_id}"


def comment_link(
    channel_username: str,
    channel_id: int,
    group_id: int,
    channel_post_id: int | None,
    message_id: int,
    thread_id: int | None = None,
) -> str:
    """Ссылка открывает комментарий в обсуждении поста канала.

    Если пост неизвестен — ссылка на сообщение в группе обсуждений.
    """
    if channel_post_id:
        base = post_link(channel_username, channel_id, channel_post_id)
        return f"{base}?comment={message_id}"
    suffix = f"?thread={thread_id}" if thread_id else ""
    return f"https://t.me/c/{_internal_id(group_id)}/{message_id}{suffix}"
