from __future__ import annotations

import json
import subprocess
from datetime import UTC, datetime

import pytest

from app.config import ConfigError, Settings, load_secrets, load_settings
from app.services.editorial_archive import parse_import
from app.services.rules import analyze_by_rules
from app.storage.encryption import EncryptionError, decode_key, decrypt, encrypt, generate_key
from app.storage.state_manager import GitBranchBackend, StateError, StateManager
from app.utils.links import comment_link
from app.utils.text import is_trivial
from app.utils.timeutil import in_quiet_hours, next_quota_reset, quota_day

# --- шифрование ---


def test_encryption_roundtrip_and_tamper():
    key = decode_key(generate_key())
    blob = encrypt(b"secret data" * 100, key)
    assert b"secret" not in blob
    assert decrypt(blob, key) == b"secret data" * 100
    tampered = blob[:-1] + bytes([blob[-1] ^ 1])
    with pytest.raises(EncryptionError):
        decrypt(tampered, key)
    with pytest.raises(EncryptionError):
        decrypt(blob, decode_key(generate_key()))


def test_bad_key_rejected():
    with pytest.raises(EncryptionError):
        decode_key("short")


# --- состояние в ветке git ---


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


@pytest.fixture
def git_repo(tmp_path):
    remote = tmp_path / "remote.git"
    _git(tmp_path, "init", "--bare", "-q", str(remote))
    work = tmp_path / "work"
    _git(tmp_path, "init", "-q", str(work))
    _git(work, "remote", "add", "origin", str(remote))
    return work, remote


def test_git_backend_orphan_commits(git_repo):
    work, remote = git_repo
    key = decode_key(generate_key())
    sm = StateManager(GitBranchBackend(work), key)
    assert sm.load() is None
    sm.save(b"v1")
    sm.save(b"v2")
    sm.save(b"v3")
    # В ветке один коммит без истории — старые версии не накапливаются.
    count = subprocess.run(["git", "rev-list", "--count", "bot-state"], cwd=remote, capture_output=True, text=True)
    assert count.stdout.strip() == "1"
    files = subprocess.run(["git", "ls-tree", "--name-only", "bot-state"], cwd=remote, capture_output=True, text=True)
    assert files.stdout.split() == ["state.enc", "state.prev.enc"]
    fresh = StateManager(GitBranchBackend(work), key)
    assert fresh.load() == b"v3"


def test_git_backend_concurrent_write_rejected(git_repo):
    work, _ = git_repo
    key = decode_key(generate_key())
    StateManager(GitBranchBackend(work), key).load()
    first = StateManager(GitBranchBackend(work), key)
    first.load()
    first.save(b"init")
    a = StateManager(GitBranchBackend(work), key)
    b = StateManager(GitBranchBackend(work), key)
    a.load()
    b.load()
    a.save(b"from a")
    with pytest.raises(StateError):
        b.save(b"from b")
    check = StateManager(GitBranchBackend(work), key)
    assert check.load() == b"from a"


def test_git_backend_wrong_key_aborts(git_repo):
    work, _ = git_repo
    sm = StateManager(GitBranchBackend(work), decode_key(generate_key()))
    sm.load()
    sm.save(b"data")
    with pytest.raises(EncryptionError):
        StateManager(GitBranchBackend(work), decode_key(generate_key())).load()


# --- конфигурация ---


def test_settings_env_override(tmp_path):
    (tmp_path / "settings.yaml").write_text("notification_threshold: 60\ngemini_model: a\n", encoding="utf-8")
    s = load_settings({"NOTIFICATION_THRESHOLD": "75", "NOTIFICATION_MODE": "digest"}, tmp_path)
    assert s.notification_threshold == 75 and s.notification_mode == "digest" and s.gemini_model == "a"


def test_invalid_settings_message_has_no_values(tmp_path):
    with pytest.raises(ConfigError) as err:
        load_settings({"NOTIFICATION_MODE": "loud"}, tmp_path)
    assert "loud" not in str(err.value)


def test_missing_secrets_named_without_values():
    with pytest.raises(ConfigError) as err:
        load_secrets({"TELEGRAM_BOT_TOKEN": "123:abc"})
    assert "OWNER_TELEGRAM_ID" in str(err.value) and "123:abc" not in str(err.value)


def test_next_check():
    s = Settings()
    nxt = s.next_check(datetime(2026, 11, 24, 9, 10, tzinfo=UTC))
    assert (nxt.hour, nxt.minute) == (12, 7)
    nxt = s.next_check(datetime(2026, 11, 24, 19, 0, tzinfo=UTC))
    assert (nxt.day, nxt.hour) == (25, 6)


# --- текст и правила ---


@pytest.mark.parametrize("text", ["🔥", "👍👍", "+", "Класс!", "огонь 🔥", "Спасибо!", "очень круто", "❤️"])
def test_trivial(text):
    assert is_trivial(text)


@pytest.mark.parametrize(
    "text", ["Когда концерт?", "?", "где купить", "Мне кажется, бас тихий", "Спасибо, а когда тур?"]
)
def test_not_trivial(text):
    assert not is_trivial(text)


def test_rules_question_high_priority():
    a = analyze_by_rules("Когда будет концерт в Москве?")
    assert "вопрос автору" in a.categories and "вопрос о концертах" in a.categories and a.priority >= 70
    assert a.suggested_reply is None


def test_rules_spam():
    assert analyze_by_rules("Заработок от 1000$ в день, переходи t.me/xxx").priority <= 5


def test_rules_author_replied_caps():
    assert analyze_by_rules("Когда концерт?", author_replied=True).priority <= 20


# --- ссылки и время ---


def test_comment_links():
    assert comment_link("pluit_club", -1001, -1002000000002, 10, 55) == "https://t.me/pluit_club/10?comment=55"
    assert comment_link("", -1002000000001, -1002000000002, 10, 55) == "https://t.me/c/2000000001/10?comment=55"
    assert comment_link("pluit_club", -1001, -1002000000002, None, 55, 40) == "https://t.me/c/2000000002/55?thread=40"


def test_quiet_hours():
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Europe/Moscow")
    assert in_quiet_hours(datetime(2026, 1, 1, 21, 0, tzinfo=UTC), tz, 23, 9)  # 00:00 МСК
    assert not in_quiet_hours(datetime(2026, 1, 1, 6, 7, tzinfo=UTC), tz, 23, 9)  # 09:07 МСК


def test_quota_day_pacific():
    dt = datetime(2026, 11, 24, 7, 0, tzinfo=UTC)  # 23:00 PST 23.11
    assert quota_day(dt) == "2026-11-23"
    assert next_quota_reset(dt) > dt


# --- импорт ---


def test_import_formats():
    from zoneinfo import ZoneInfo

    tz = ZoneInfo("Europe/Moscow")
    simple = [{"id": 1, "date": "2026-10-01T12:00:00+03:00", "text": "Пост"}]
    assert parse_import(simple, tz)[0]["channel_post_id"] == 1
    desktop = {
        "messages": [
            {
                "id": 2,
                "type": "message",
                "date": "2026-10-02T12:00:00",
                "date_unixtime": "1790000000",
                "text": ["Новый ", {"type": "bold", "text": "трек"}],
            },
            {"id": 3, "type": "service", "text": ""},
        ]
    }
    posts = parse_import(desktop, tz)
    assert len(posts) == 1 and posts[0]["text"] == "Новый трек"


def test_import_into_archive(h, tmp_path):
    path = tmp_path / "import.json"
    path.write_text(
        json.dumps([{"id": 11, "date": "2026-10-01T12:00:00+03:00", "text": "Старый пост"}]), encoding="utf-8"
    )
    h.run(import_file=path)
    h.run(import_file=path)
    assert h.last_ctx.db.scalar("SELECT COUNT(*) FROM posts WHERE source='import'") == 1


# --- getUpdates пакетами ---


def test_updates_fetched_in_batches_with_checkpoint(h, monkeypatch):
    thread = h.channel_post()
    for i in range(230):
        h.comment(f"Норм {i}", thread=thread, user_id=8000 + i)
    saves = []
    from app.storage import state_manager

    original = state_manager.StateManager.save

    def spy(self, data):
        saves.append(len(data))
        return original(self, data)

    monkeypatch.setattr(state_manager.StateManager, "save", spy)
    h.run()
    assert h.last_ctx.db.scalar("SELECT COUNT(*) FROM messages") == 230
    assert h.last_ctx.stats.updates == 231
    assert len(saves) >= 3  # промежуточные сохранения перед подтверждением следующих пакетов
    assert h.tg.queue  # последний пакет подтверждается только следующим запуском
    h.run()
    assert h.tg.queue == []
