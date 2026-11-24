"""SQLite в памяти процесса. Снимок сериализуется, шифруется и сохраняется StateManager."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager

SCHEMA_VERSION = 1

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);

-- Обновления Telegram хранятся до завершения обработки, затем удаляются.
CREATE TABLE IF NOT EXISTS raw_updates (
    update_id INTEGER PRIMARY KEY,
    payload TEXT NOT NULL,
    received_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_post_id INTEGER UNIQUE,
    group_message_id INTEGER UNIQUE,
    date TEXT,
    text TEXT NOT NULL DEFAULT '',
    main_topic TEXT,
    extra_topics TEXT NOT NULL DEFAULT '[]',
    topic_status TEXT NOT NULL DEFAULT 'pending',   -- pending | done | skipped
    source TEXT NOT NULL DEFAULT 'auto',            -- auto | import
    created_at TEXT NOT NULL
);

-- Все сообщения группы обсуждений: комментарии подписчиков и ответы автора.
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER NOT NULL,
    message_id INTEGER NOT NULL,
    thread_id INTEGER,
    reply_to_message_id INTEGER,
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    user_id INTEGER,
    sender_chat_id INTEGER,
    username TEXT,
    display_name TEXT,
    author_kind TEXT NOT NULL,          -- subscriber | author | anonymous_admin | other_chat
    text TEXT NOT NULL DEFAULT '',
    has_media INTEGER NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    edit_date TEXT,
    text_hash TEXT NOT NULL DEFAULT '',
    resolve_status TEXT NOT NULL,       -- resolved | pending | no_post
    resolve_attempts INTEGER NOT NULL DEFAULT 0,
    analysis_status TEXT NOT NULL,      -- pending | done | skipped
    ai_pending_since TEXT,
    answered_at TEXT,
    answered_by_message_id INTEGER,
    UNIQUE (chat_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_date ON messages(date);
CREATE INDEX IF NOT EXISTS idx_messages_post ON messages(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

CREATE TABLE IF NOT EXISTS analyses (
    message_row_id INTEGER PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
    source TEXT NOT NULL,               -- ai | rules | prefilter
    categories TEXT NOT NULL DEFAULT '[]',
    topics TEXT NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL,
    should_notify INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    suggested_reply TEXT,
    potential_post_topic TEXT,
    confidence REAL,
    model TEXT,
    text_hash TEXT NOT NULL DEFAULT '',
    analyzed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_row_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    status TEXT NOT NULL,               -- pending | notified | snoozed | answered | skipped
    created_at TEXT NOT NULL,
    notified_at TEXT,
    remind_at TEXT,
    closed_at TEXT,
    close_reason TEXT,
    notify_count INTEGER NOT NULL DEFAULT 0,
    tg_message_id INTEGER,
    alt_requested INTEGER NOT NULL DEFAULT 0,
    alternatives TEXT NOT NULL DEFAULT '[]',
    card_closed INTEGER NOT NULL DEFAULT 0
);

-- Очередь исходящих уведомлений.
CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    payload TEXT NOT NULL,
    ref_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending', -- pending | sending | sent | failed | uncertain
    attempts INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    sent_at TEXT,
    tg_message_id INTEGER,
    error TEXT
);

CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    reason TEXT,
    source_message_row_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
    source_link TEXT,
    post_id INTEGER REFERENCES posts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'new',  -- new | in_progress | used | rejected
    norm_key TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage (
    day TEXT NOT NULL,
    model TEXT NOT NULL,
    requests INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, model)
);

CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    updates INTEGER NOT NULL DEFAULT 0,
    analyzed INTEGER NOT NULL DEFAULT 0,
    notified INTEGER NOT NULL DEFAULT 0,
    ai_requests INTEGER NOT NULL DEFAULT 0,
    error TEXT
);
"""


class Database:
    def __init__(self, snapshot: bytes | None = None):
        self.conn = sqlite3.connect(":memory:", isolation_level=None)
        if snapshot:
            self.conn.deserialize(snapshot)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.migrate()

    def migrate(self) -> None:
        self.conn.executescript(SCHEMA)
        row = self.conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
        if row is None:
            self.conn.execute("INSERT INTO meta(key, value) VALUES('schema_version', ?)", (str(SCHEMA_VERSION),))

    def serialize(self) -> bytes:
        return self.conn.serialize()

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        self.conn.execute("BEGIN")
        try:
            yield self.conn
        except BaseException:
            self.conn.execute("ROLLBACK")
            raise
        else:
            self.conn.execute("COMMIT")

    def execute(self, sql: str, params: tuple | dict = ()) -> sqlite3.Cursor:
        return self.conn.execute(sql, params)

    def one(self, sql: str, params: tuple | dict = ()) -> sqlite3.Row | None:
        return self.conn.execute(sql, params).fetchone()

    def all(self, sql: str, params: tuple | dict = ()) -> list[sqlite3.Row]:
        return self.conn.execute(sql, params).fetchall()

    def scalar(self, sql: str, params: tuple | dict = ()):
        row = self.conn.execute(sql, params).fetchone()
        return None if row is None else row[0]
