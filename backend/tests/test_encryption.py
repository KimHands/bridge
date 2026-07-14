# backend/tests/test_encryption.py
import pytest

from app.core.encryption import decrypt_json, encrypt_json

_UID = "11111111-1111-1111-1111-111111111111"
_OTHER = "22222222-2222-2222-2222-222222222222"


def test_encrypt_decrypt_roundtrip():
    data = {"memo": "오늘은 조금 지쳤어요", "score": 3}
    encrypted = encrypt_json(data, aad=_UID)
    assert decrypt_json(encrypted, aad=_UID) == data


def test_ciphertext_has_iv_ct_format():
    encrypted = encrypt_json({"a": 1}, aad=_UID)
    parts = encrypted.split(":")
    assert len(parts) == 2
    assert parts[0] and parts[1]


def test_same_plaintext_yields_different_ciphertext():
    # IV(nonce)를 매번 새로 생성하므로 동일 입력도 암호문이 달라야 한다.
    data = {"memo": "동일한 내용"}
    e1 = encrypt_json(data, aad=_UID)
    e2 = encrypt_json(data, aad=_UID)
    assert e1 != e2
    assert decrypt_json(e1, aad=_UID) == decrypt_json(e2, aad=_UID) == data


def test_tampered_ciphertext_fails():
    encrypted = encrypt_json({"x": "y"}, aad=_UID)
    iv, ct = encrypted.split(":", 1)
    tampered_ct = ("A" if ct[0] != "A" else "B") + ct[1:]
    with pytest.raises(Exception):
        decrypt_json(f"{iv}:{tampered_ct}", aad=_UID)


def test_wrong_aad_fails():
    # 다른 사용자의 aad로는 복호화 실패 — 교차행 치환 공격 차단(H5).
    encrypted = encrypt_json({"memo": "비밀"}, aad=_UID)
    with pytest.raises(Exception):
        decrypt_json(encrypted, aad=_OTHER)


def test_aad_is_required():
    # aad는 키워드 전용 필수 인자 — 누락 시 TypeError.
    with pytest.raises(TypeError):
        encrypt_json({"a": 1})  # type: ignore[call-arg]
