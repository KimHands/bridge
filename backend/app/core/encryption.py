import base64
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_key() -> bytes:
    key = base64.b64decode(settings.encryption_key)
    if len(key) != 32:  # AES-256 — 잘못된 키는 명확히 실패시킨다(L3)
        raise ValueError("ENCRYPTION_KEY must decode to 32 bytes (AES-256)")
    return key


def encrypt_json(data: dict, *, aad: str) -> str:
    """AES-256-GCM 암호화. aad(user_id)로 암호문을 특정 사용자에 묶어
    교차행 치환 공격을 차단한다(H5). 복호화 시 동일 aad가 필요하다.
    """
    key = _get_key()
    iv = os.urandom(12)
    aesgcm = AESGCM(key)
    plaintext = json.dumps(data, ensure_ascii=False).encode()
    ciphertext = aesgcm.encrypt(iv, plaintext, aad.encode())
    iv_b64 = base64.b64encode(iv).decode()
    ct_b64 = base64.b64encode(ciphertext).decode()
    return f"{iv_b64}:{ct_b64}"


def decrypt_json(encrypted: str, *, aad: str) -> dict:
    """복호화. 암호화 때와 다른 aad면 인증 태그 검증에 실패해 예외를 던진다."""
    key = _get_key()
    iv_b64, ct_b64 = encrypted.split(":", 1)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ct_b64)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, aad.encode())
    return json.loads(plaintext.decode())
