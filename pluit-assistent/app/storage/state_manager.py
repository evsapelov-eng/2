"""Постоянное хранение зашифрованного состояния между запусками.

Основной вариант — отдельная ветка ``bot-state`` в том же приватном репозитории.
Каждое сохранение создаёт новый коммит БЕЗ родителя (orphan) и заменяет ветку
через ``git push --force-with-lease``. Поэтому:

* история ветки не растёт — в ней всегда один коммит;
* удалённые данные не остаются в истории ветки (старые объекты становятся
  недостижимыми и удаляются сборщиком мусора GitHub);
* если ветку изменил кто-то другой (параллельный запуск), запись отклоняется.

В коммите два файла: ``state.enc`` (текущее состояние) и ``state.prev.enc``
(предыдущее, для ручного восстановления).
"""

from __future__ import annotations

import logging
import os
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from app.storage.encryption import decrypt, encrypt

log = logging.getLogger(__name__)

STATE_FILE = "state.enc"
PREV_FILE = "state.prev.enc"


class StateError(RuntimeError):
    pass


@dataclass
class Snapshot:
    data: bytes | None
    version: str | None  # sha коммита или отметка версии


class StateBackend(Protocol):
    def fetch(self) -> Snapshot: ...

    def store(self, current: bytes, previous: bytes | None, expected_version: str | None) -> str: ...


class LocalFileBackend:
    """Файл на диске. Только для локальной разработки и тестов."""

    def __init__(self, path: str | Path):
        self.path = Path(path)

    def fetch(self) -> Snapshot:
        if not self.path.exists():
            return Snapshot(None, None)
        data = self.path.read_bytes()
        return Snapshot(data, str(self.path.stat().st_mtime_ns))

    def store(self, current: bytes, previous: bytes | None, expected_version: str | None) -> str:
        actual = str(self.path.stat().st_mtime_ns) if self.path.exists() else None
        if actual != expected_version:
            raise StateError("Состояние изменено другим процессом. Запись отменена.")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if previous is not None:
            self.path.with_name(PREV_FILE).write_bytes(previous)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_bytes(current)
        os.replace(tmp, self.path)
        return str(self.path.stat().st_mtime_ns)


class GitBranchBackend:
    """Ветка приватного репозитория. Использует git из рабочей копии actions/checkout."""

    def __init__(self, repo_dir: str | Path, branch: str = "bot-state", remote: str = "origin"):
        self.repo_dir = Path(repo_dir)
        self.branch = branch
        self.remote = remote
        self.ref = f"refs/heads/{branch}"

    def _git(self, *args: str, input_bytes: bytes | None = None, check: bool = True) -> subprocess.CompletedProcess:
        env = {
            **os.environ,
            "GIT_AUTHOR_NAME": "pluit-assistent",
            "GIT_AUTHOR_EMAIL": "pluit-assistent@users.noreply.github.com",
            "GIT_COMMITTER_NAME": "pluit-assistent",
            "GIT_COMMITTER_EMAIL": "pluit-assistent@users.noreply.github.com",
            "GIT_TERMINAL_PROMPT": "0",
        }
        proc = subprocess.run(
            ["git", *args], cwd=self.repo_dir, input=input_bytes, capture_output=True, env=env, timeout=120
        )
        if check and proc.returncode != 0:
            # stderr git не содержит данных состояния; токен в URL не печатается благодаря actions/checkout.
            message = proc.stderr.decode("utf-8", "replace").strip().splitlines()[-1:] or ["—"]
            raise StateError(f"git {args[0]}: {message[0][:300]}")
        return proc

    def fetch(self) -> Snapshot:
        listing = self._git("ls-remote", "--heads", self.remote, self.ref).stdout.decode().strip()
        if not listing:
            return Snapshot(None, None)
        sha = listing.split()[0]
        self._git(
            "fetch", "--no-tags", "--depth=1", self.remote, f"+{self.ref}:refs/remotes/{self.remote}/{self.branch}"
        )
        proc = self._git("cat-file", "blob", f"{sha}:{STATE_FILE}", check=False)
        if proc.returncode != 0:
            raise StateError(
                f"В ветке {self.branch} нет файла {STATE_FILE}. Запуск остановлен, чтобы не перезаписать данные."
            )
        return Snapshot(proc.stdout, sha)

    def _blob(self, data: bytes) -> str:
        return self._git("hash-object", "-w", "--stdin", input_bytes=data).stdout.decode().strip()

    def store(self, current: bytes, previous: bytes | None, expected_version: str | None) -> str:
        entries = [f"100644 blob {self._blob(current)}\t{STATE_FILE}"]
        if previous is not None:
            entries.append(f"100644 blob {self._blob(previous)}\t{PREV_FILE}")
        tree = self._git("mktree", input_bytes=("\n".join(entries) + "\n").encode()).stdout.decode().strip()
        commit = self._git("commit-tree", tree, "-m", "Состояние PLUIT Assistent").stdout.decode().strip()
        lease = f"--force-with-lease={self.ref}:{expected_version or ''}"
        proc = self._git("push", "--quiet", lease, self.remote, f"{commit}:{self.ref}", check=False)
        if proc.returncode != 0:
            raise StateError(
                "Не удалось сохранить состояние в ветку "
                f"{self.branch}: ветка изменилась или нет прав на запись (contents: write)."
            )
        return commit


class StateManager:
    def __init__(self, backend: StateBackend, key: bytes):
        self.backend = backend
        self.key = key
        self._version: str | None = None
        self._last_blob: bytes | None = None
        self.loaded = False

    def load(self) -> bytes | None:
        """Возвращает расшифрованный снимок SQLite или None, если состояния ещё нет."""
        snap = self.backend.fetch()
        self._version = snap.version
        self._last_blob = snap.data
        self.loaded = True
        if snap.data is None:
            log.info("Сохранённого состояния нет — первый запуск.")
            return None
        return decrypt(snap.data, self.key)

    def save(self, plaintext: bytes) -> None:
        if not self.loaded:
            raise StateError("Нельзя сохранять состояние, которое не было загружено.")
        blob = encrypt(plaintext, self.key)
        self._version = self.backend.store(blob, self._last_blob, self._version)
        self._last_blob = blob
        log.info("Состояние сохранено (%d байт).", len(blob))
