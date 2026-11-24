"""Сводка по расшифрованному состоянию — только счётчики, без текстов комментариев.

Запуск локально:
  git fetch origin bot-state && git show origin/bot-state:state.enc > /tmp/state.enc
  STATE_ENCRYPTION_KEY=... python scripts/inspect_state.py /tmp/state.enc
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.storage.database import Database
from app.storage.encryption import decode_key, decrypt


def main() -> int:
    if len(sys.argv) != 2 or not os.environ.get("STATE_ENCRYPTION_KEY"):
        print(__doc__)
        return 1
    db = Database(decrypt(Path(sys.argv[1]).read_bytes(), decode_key(os.environ["STATE_ENCRYPTION_KEY"])))
    for table in ("posts", "messages", "analyses", "recommendations", "ideas", "outbox", "raw_updates", "runs"):
        print(f"{table}: {db.scalar(f'SELECT COUNT(*) FROM {table}')}")
    for key in ("update_offset", "collection_started_at", "last_success_at"):
        print(f"{key}: {db.scalar('SELECT value FROM meta WHERE key=?', (key,))}")
    last = db.one("SELECT * FROM runs ORDER BY id DESC LIMIT 1")
    if last:
        print("последний запуск:", dict(last))
    return 0


if __name__ == "__main__":
    sys.exit(main())
