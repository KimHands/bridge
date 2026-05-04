import base64
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_key() -> bytes:
    return base64.b64decode(settings.encryption_key)


def encrypt_json(data: dict) -> str:
    key = _get_key()
    iv = os.urandom(12)
    aesgcm = AESGCM(key)
    plaintext = json.dumps(data, ensure_ascii=False).encode()
    ciphertext = aesgcm.encrypt(iv, plaintext, None)
    iv_b64 = base64.b64encode(iv).decode()
    ct_b64 = base64.b64encode(ciphertext).decode()
    return f"{iv_b64}:{ct_b64}"


def decrypt_json(encrypted: str) -> dict:
    key = _get_key()
    iv_b64, ct_b64 = encrypted.split(":", 1)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ct_b64)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return json.loads(plaintext.decode())
