"""Приём сообщений группы обсуждений и привязка комментариев к публикациям канала.

Опираемся на поля Bot API: is_automatic_forward, forward_origin (тип channel:
chat.id и message_id поста в канале), message_thread_id, reply_to_message,
sender_chat, chat.id, message_id. ID поста в канале и ID его автоматической
пересылки в группе НЕ совпадают — связь хранится в таблице posts.
"""

from __future__ import annotations

import logging

from app.context import Context
from app.services import author_replies
from app.utils.text import text_hash
from app.utils.timeutil import from_unix, to_iso

log = logging.getLogger(__name__)

MAX_RESOLVE_ATTEMPTS = 3


def _text_of(msg: dict) -> tuple[str, bool]:
    text = msg.get("text") or msg.get("caption") or ""
    media_keys = ("photo", "video", "voice", "audio", "document", "sticker", "animation", "video_note")
    return text, any(k in msg for k in media_keys)


def _is_channel_forward(ctx: Context, msg: dict) -> bool:
    origin = msg.get("forward_origin") or {}
    return (
        bool(msg.get("is_automatic_forward"))
        and origin.get("type") == "channel"
        and (origin.get("chat") or {}).get("id") == ctx.channel_id
    )


def upsert_post_from_forward(ctx: Context, msg: dict, *, edited: bool = False) -> int:
    origin = msg["forward_origin"]
    text, _ = _text_of(msg)
    date = to_iso(from_unix(origin.get("date") or msg["date"]))
    db = ctx.db
    row = db.one(
        "SELECT id, text FROM posts WHERE channel_post_id=? OR group_message_id=?",
        (origin["message_id"], msg["message_id"]),
    )
    if row:
        db.execute(
            "UPDATE posts SET channel_post_id=?, group_message_id=?, date=COALESCE(date, ?) WHERE id=?",
            (origin["message_id"], msg["message_id"], date, row["id"]),
        )
        if text and (edited or not row["text"]) and text != row["text"]:
            db.execute("UPDATE posts SET text=?, topic_status='pending' WHERE id=?", (text, row["id"]))
        return row["id"]
    cur = db.execute(
        "INSERT INTO posts(channel_post_id, group_message_id, date, text, created_at) VALUES(?,?,?,?,?)",
        (origin["message_id"], msg["message_id"], date, text, to_iso(ctx.now)),
    )
    # Комментарии, пришедшие раньше поста, теперь можно привязать.
    db.execute(
        "UPDATE messages SET post_id=?, resolve_status='resolved' WHERE chat_id=? AND thread_id=? AND post_id IS NULL",
        (cur.lastrowid, ctx.group_id, msg["message_id"]),
    )
    return cur.lastrowid


def classify_sender(ctx: Context, msg: dict) -> str:
    sender_chat = (msg.get("sender_chat") or {}).get("id")
    user_id = (msg.get("from") or {}).get("id")
    if sender_chat is not None:
        if sender_chat == ctx.channel_id or sender_chat in ctx.config.settings.owner_sender_chat_ids:
            return "author"
        if sender_chat == ctx.group_id:
            # Анонимный администратор: конкретного человека определить нельзя.
            return "anonymous_admin"
        return "other_chat"
    if user_id == ctx.owner_id:
        return "author"
    return "subscriber"


def _find_post(ctx: Context, msg: dict) -> int | None:
    db = ctx.db
    reply = msg.get("reply_to_message") or {}
    if reply and _is_channel_forward(ctx, reply):
        return upsert_post_from_forward(ctx, reply)
    thread_id = msg.get("message_thread_id")
    if thread_id:
        pid = db.scalar("SELECT id FROM posts WHERE group_message_id=?", (thread_id,))
        if pid:
            return pid
    if reply:
        pid = db.scalar("SELECT id FROM posts WHERE group_message_id=?", (reply.get("message_id"),))
        if pid:
            return pid
        pid = db.scalar(
            "SELECT post_id FROM messages WHERE chat_id=? AND message_id=?", (ctx.group_id, reply.get("message_id"))
        )
        if pid:
            return pid
    return None


def ingest_group_message(ctx: Context, msg: dict, *, edited: bool = False) -> None:
    if (msg.get("chat") or {}).get("id") != ctx.group_id:
        return
    if _is_channel_forward(ctx, msg):
        upsert_post_from_forward(ctx, msg, edited=edited)
        return
    if msg.get("is_automatic_forward"):
        return  # пересылка из другого канала — не наш пост
    if (msg.get("from") or {}).get("is_bot") and not msg.get("sender_chat"):
        return
    text, has_media = _text_of(msg)
    if not text and not has_media:
        return  # служебные сообщения (вход участников и т. п.)

    db = ctx.db
    existing = db.one(
        "SELECT id, text_hash FROM messages WHERE chat_id=? AND message_id=?", (ctx.group_id, msg["message_id"])
    )
    new_hash = text_hash(text)
    if existing:
        if edited and existing["text_hash"] != new_hash:
            db.execute(
                "UPDATE messages SET text=?, text_hash=?, edit_date=?, analysis_status=CASE "
                "WHEN author_kind='subscriber' THEN 'pending' ELSE analysis_status END, ai_pending_since=? "
                "WHERE id=?",
                (
                    text,
                    new_hash,
                    to_iso(from_unix(msg.get("edit_date") or msg["date"])),
                    to_iso(ctx.now),
                    existing["id"],
                ),
            )
        return  # повтор обновления — не дублируем

    kind = classify_sender(ctx, msg)
    post_id = _find_post(ctx, msg)
    thread_id = msg.get("message_thread_id")
    reply_id = (msg.get("reply_to_message") or {}).get("message_id")
    if post_id:
        resolve = "resolved"
    elif thread_id or reply_id:
        resolve = "pending"
    else:
        resolve = "no_post"
    user = msg.get("from") or {}
    name = " ".join(x for x in (user.get("first_name"), user.get("last_name")) if x) or None
    if kind != "subscriber":
        name = (msg.get("sender_chat") or {}).get("title") or name
    analyzable = kind == "subscriber" and bool(text)
    cur = db.execute(
        "INSERT INTO messages(chat_id, message_id, thread_id, reply_to_message_id, post_id, user_id, sender_chat_id,"
        " username, display_name, author_kind, text, has_media, date, edit_date, text_hash, resolve_status,"
        " analysis_status, ai_pending_since) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            ctx.group_id,
            msg["message_id"],
            thread_id,
            reply_id,
            post_id,
            user.get("id") if kind == "subscriber" or kind == "author" else None,
            (msg.get("sender_chat") or {}).get("id"),
            user.get("username") if kind == "subscriber" else None,
            name,
            kind,
            text,
            int(has_media),
            to_iso(from_unix(msg["date"])),
            to_iso(from_unix(msg["edit_date"])) if msg.get("edit_date") else None,
            new_hash,
            resolve,
            "pending" if analyzable else "skipped",
            to_iso(ctx.now) if analyzable else None,
        ),
    )
    if kind == "author" and reply_id:
        author_replies.register_reply(ctx, cur.lastrowid, reply_id, msg["date"])


def retry_unresolved(ctx: Context) -> int:
    """Повторная попытка привязать комментарии к постам (например, пост пришёл позже)."""
    db = ctx.db
    resolved = 0
    rows = db.all(
        "SELECT id, thread_id, reply_to_message_id, resolve_attempts FROM messages WHERE resolve_status='pending'"
    )
    for row in rows:
        pid = None
        if row["thread_id"]:
            pid = db.scalar("SELECT id FROM posts WHERE group_message_id=?", (row["thread_id"],))
        if not pid and row["reply_to_message_id"]:
            pid = db.scalar(
                "SELECT COALESCE((SELECT id FROM posts WHERE group_message_id=?),"
                " (SELECT post_id FROM messages WHERE chat_id=? AND message_id=?))",
                (row["reply_to_message_id"], ctx.group_id, row["reply_to_message_id"]),
            )
        if pid:
            db.execute("UPDATE messages SET post_id=?, resolve_status='resolved' WHERE id=?", (pid, row["id"]))
            resolved += 1
        elif row["resolve_attempts"] + 1 >= MAX_RESOLVE_ATTEMPTS:
            db.execute("UPDATE messages SET resolve_status='no_post' WHERE id=?", (row["id"],))
        else:
            db.execute("UPDATE messages SET resolve_attempts=resolve_attempts+1 WHERE id=?", (row["id"],))
    return resolved
