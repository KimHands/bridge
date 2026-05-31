# backend/tests/test_security.py
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_email,
    hash_password,
    verify_password,
)


def test_password_hash_roundtrip():
    hashed = hash_password("s3cret-pw")
    assert hashed != "s3cret-pw"
    assert verify_password("s3cret-pw", hashed)


def test_password_wrong_rejected():
    hashed = hash_password("correct-pw")
    assert not verify_password("wrong-pw", hashed)


def test_email_hash_deterministic_and_normalized():
    a = hash_email("User@Example.com")
    b = hash_email("user@example.com")
    assert a == b  # 대소문자 정규화
    assert len(a) == 64  # SHA-256 hex


def test_access_token_contains_jti_and_type():
    # 로그아웃/블랙리스트가 Access Token에도 적용되려면 jti가 필수.
    token, jti = create_access_token("user-123")
    payload = decode_token(token)
    assert payload["sub"] == "user-123"
    assert payload["type"] == "access"
    assert payload["jti"] == jti


def test_access_tokens_have_unique_jti():
    _, jti1 = create_access_token("user-1")
    _, jti2 = create_access_token("user-1")
    assert jti1 != jti2


def test_refresh_token_contains_jti_and_type():
    token, jti = create_refresh_token("user-9")
    payload = decode_token(token)
    assert payload["sub"] == "user-9"
    assert payload["type"] == "refresh"
    assert payload["jti"] == jti
