# backend/tests/test_security.py
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_verification_code,
    hash_device_secret,
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


def test_hash_device_secret_sha256_hex():
    """device_secret은 SHA-256 hex(64자)로 결정적 해시되어야 함."""
    secret = "device-secret-256bit-example"
    hashed = hash_device_secret(secret)
    # SHA-256 hex는 정확히 64자
    assert len(hashed) == 64
    # 모두 hex 문자
    assert all(c in "0123456789abcdef" for c in hashed)


def test_hash_device_secret_deterministic():
    """동일 입력은 동일 해시를 생성."""
    secret = "device-secret-example"
    hash1 = hash_device_secret(secret)
    hash2 = hash_device_secret(secret)
    assert hash1 == hash2


def test_generate_verification_code_is_6digit_string():
    """인증코드는 6자리 숫자 문자열."""
    code = generate_verification_code()
    assert isinstance(code, str)
    assert len(code) == 6
    assert code.isdigit()


def test_generate_verification_code_range():
    """인증코드는 000000 ~ 999999 범위."""
    for _ in range(100):
        code = generate_verification_code()
        num = int(code)
        assert 0 <= num < 1_000_000
