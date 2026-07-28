# backend/tests/test_users_delete.py
"""DELETE /v1/users/me 라이브 E2E (실제 컨테이너 bridge-api-1, Postgres, Redis 대상).

B6 최종 리뷰 CRITICAL 회귀 가드: 익명 사용자(password_hash=NULL)가 비밀번호
재확인 로직에서 `verify_password(body.password, None)` 호출 → `None.encode()`로
500이 나던 버그. 익명은 비밀번호 없이(JWT 소유만으로) 탈퇴가 되어야 하고,
비익명은 기존처럼 올바른 비밀번호가 필요하며 틀리거나 없으면 401(500이 아님)이어야 한다.

계정이 실제로 파기됐는지는 raw SQLAlchemy 엔진을 직접 여는 대신(다른 테스트 파일들의
event-loop-bound 커넥션 풀과 얽혀 스위트 전체 실행 시 간헐적으로
"attached to a different loop"가 나는 것을 회피) API 자체의 관찰 가능한 부작용으로
검증한다 — 탈퇴한 토큰으로 /auth/me 호출 시 실패, 같은 device_secret/email로
재시도 시 "이미 존재" 충돌 없이 새로 생성/가입되는지.
"""
import uuid

import httpx

BASE_URL = "http://localhost:8000"


async def _create_anonymous_user(device_secret: str) -> tuple[str, str]:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/v1/auth/anonymous", json={"device_secret": device_secret}
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    return data["user_id"], data["access_token"]


async def _register_user(email: str, password: str = "pw12345678") -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/auth/register",
            json={"email": email, "password": password, "nickname": "탈퇴테스트"},
        )


async def _delete_account(access_token: str, password: str | None = None) -> httpx.Response:
    body = {"password": password} if password is not None else {}
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.request(
            "DELETE",
            "/v1/users/me",
            json=body,
            headers={"Authorization": f"Bearer {access_token}"},
        )


async def _get_me(access_token: str) -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.get(
            "/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
        )


async def test_anonymous_user_can_delete_account_without_password():
    """(CRITICAL 회귀) 익명 생성 → DELETE /v1/users/me(비번 없이) → 200 + 계정 실제 파기."""
    device_secret = f"dev-{uuid.uuid4()}"
    user_id, access_token = await _create_anonymous_user(device_secret)

    resp = await _delete_account(access_token, password=None)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["deleted"] is True

    # 토큰은 즉시 블랙리스트 처리 → 이후 호출은 실패해야 한다
    me_resp = await _get_me(access_token)
    assert me_resp.status_code == 401

    # 같은 device_secret으로 재인증 시 새 user가 생성돼야 한다
    # (기존 행이 남아있었다면 매칭돼 동일 user_id가 반환됐을 것)
    new_user_id, _ = await _create_anonymous_user(device_secret)
    assert new_user_id != user_id


async def test_registered_user_delete_with_correct_password_succeeds():
    """비익명 사용자는 기존대로 올바른 비밀번호로 탈퇴 가능해야 한다(회귀 없음)."""
    email = f"delete-ok-{uuid.uuid4()}@example.com"
    password = "pw12345678"
    reg_resp = await _register_user(email, password)
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["access_token"]

    resp = await _delete_account(access_token, password=password)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    # 같은 이메일로 재가입이 막히지 않아야 한다(기존 email_hash가 실제로 사라졌다는 증거)
    re_register = await _register_user(email, password)
    assert re_register.status_code == 201


async def test_registered_user_delete_with_wrong_password_returns_401():
    """비익명 사용자가 틀린 비밀번호로 탈퇴 시도 → 401(계정은 삭제되지 않음)."""
    email = f"delete-wrong-{uuid.uuid4()}@example.com"
    reg_resp = await _register_user(email, "pw12345678")
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["access_token"]

    resp = await _delete_account(access_token, password="wrong-password")

    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "INVALID_CREDENTIALS"

    # 계정은 그대로 남아 토큰이 계속 유효해야 한다
    me_resp = await _get_me(access_token)
    assert me_resp.status_code == 200


async def test_registered_user_delete_without_password_returns_401_not_500():
    """비익명 사용자가 비밀번호를 아예 안 보내면 500이 아니라 401이어야 한다
    (verify_password(None, hash)의 None.encode() AttributeError 회귀 가드)."""
    email = f"delete-nopw-{uuid.uuid4()}@example.com"
    reg_resp = await _register_user(email, "pw12345678")
    assert reg_resp.status_code == 201
    access_token = reg_resp.json()["data"]["access_token"]

    resp = await _delete_account(access_token, password=None)

    assert resp.status_code == 401
    assert resp.json()["detail"]["code"] == "INVALID_CREDENTIALS"

    me_resp = await _get_me(access_token)
    assert me_resp.status_code == 200
