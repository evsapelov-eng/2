"""Генерирует ключ STATE_ENCRYPTION_KEY (32 байта, base64).

Запуск: python scripts/generate_key.py
Скопируйте вывод в GitHub: Settings → Secrets and variables → Actions → New repository secret.
Ключ не пересылайте в чатах и не храните в репозитории. Без ключа состояние восстановить нельзя.
"""

import base64
import os

print(base64.b64encode(os.urandom(32)).decode())
