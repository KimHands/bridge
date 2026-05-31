# backend/tests/test_encryption.py
import pytest

from app.core.encryption import decrypt_json, encrypt_json


def test_encrypt_decrypt_roundtrip():
    data = {"memo": "오늘은 조금 지쳤어요", "score": 3}
    encrypted = encrypt_json(data)
    assert decrypt_json(encrypted) == data


def test_ciphertext_has_iv_ct_format():
    encrypted = encrypt_json({"a": 1})
    parts = encrypted.split(":")
    assert len(parts) == 2
    assert parts[0] and parts[1]


def test_same_plaintext_yields_different_ciphertext():
    # IV(nonce)를 매번 새로 생성하므로 동일 입력도 암호문이 달라야 한다.
    data = {"memo": "동일한 내용"}
    e1 = encrypt_json(data)
    e2 = encrypt_json(data)
    assert e1 != e2
    assert decrypt_json(e1) == decrypt_json(e2) == data


def test_tampered_ciphertext_fails():
    encrypted = encrypt_json({"x": "y"})
    iv, ct = encrypted.split(":", 1)
    tampered_ct = ("A" if ct[0] != "A" else "B") + ct[1:]
    with pytest.raises(Exception):
        decrypt_json(f"{iv}:{tampered_ct}")
