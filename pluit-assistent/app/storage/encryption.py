"""Аутентифицированное шифрование состояния: zlib + AES-256-GCM (библиотека cryptography)."""

from __future__ import annotations

import base64
import binascii
import os
import zlib

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"PLUIT\x01"
NONCE_SIZE = 12


class EncryptionError(RuntimeError):
    pass


def generate_key() -> str:
    return base64.b64encode(AESGCM.generate_key(bit_length=256)).decode("ascii")


def decode_key(key: str) -> bytes:
    raw = key.strip()
    padded = raw + "=" * (-len(raw) % 4)
    try:
        if "-" in raw or "_" in raw:
            padded = padded.replace("-", "+").replace("_", "/")
        data = base64.b64decode(padded, validate=True)
    except (binascii.Error, ValueError):
        raise EncryptionError("STATE_ENCRYPTION_KEY должен быть 32 байтами в base64.") from None
    if len(data) != 32:
        raise EncryptionError("STATE_ENCRYPTION_KEY должен быть 32 байтами в base64.")
    return data


def encrypt(plaintext: bytes, key: bytes) -> bytes:
    nonce = os.urandom(NONCE_SIZE)
    return MAGIC + nonce + AESGCM(key).encrypt(nonce, zlib.compress(plaintext, 9), MAGIC)


def decrypt(blob: bytes, key: bytes) -> bytes:
    if not blob.startswith(MAGIC) or len(blob) < len(MAGIC) + NONCE_SIZE + 16:
        raise EncryptionError("Файл состояния повреждён или имеет неизвестный формат.")
    nonce = blob[len(MAGIC) : len(MAGIC) + NONCE_SIZE]
    try:
        compressed = AESGCM(key).decrypt(nonce, blob[len(MAGIC) + NONCE_SIZE :], MAGIC)
    except InvalidTag:
        raise EncryptionError("Не удалось расшифровать состояние: неверный ключ или файл изменён.") from None
    return zlib.decompress(compressed)
