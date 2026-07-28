# backend/tests/test_auth_anonymous.py
"""POST /v1/auth/anonymous 라이브 Postgres E2E.

User.device_secret_hash는 실제 컬럼(UNIQUE)이고 판정 로직은 DB 조회 그 자체라
SQLite 모킹보다 실제 컨테이너(bridge-api-1, Postgres) 대상 httpx 호출로 검증한다.
matched(재인증) 여부는 응답 user_id 동일성으로, 신규 생성/is_anonymous는
AsyncSessionLocal로 직접 조회해 확인한다. 각 테스트는 uuid4로 만든 고유
device_secret을 사용해 재실행 시에도 UNIQUE 제약과 충돌하지 않는다.
"""
import uuid

import httpx
from sqlalchemy import select

from app.core.database import AsyncSessionLocal, engine
from app.models.user import User

BASE_URL = "http://localhost:8000"


async def _fetch_user(user_id: uuid.UUID) -> User:
    """검증 전용 DB 조회. pytest-asyncio가 테스트마다 새 이벤트 루프를 만들므로
    앱 전역 엔진의 풀링된 커넥션이 이전 루프에 묶여 재사용 시 충돌한다
    (`RuntimeError: ... attached to a different loop`). 조회 후 dispose로
    풀을 비워 다음 테스트가 현재 루프에서 새 커넥션을 맺도록 한다."""
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one()
    finally:
        await engine.dispose()


async def _post_anonymous(device_secret: str, nickname: str | None = None) -> httpx.Response:
    payload = {"device_secret": device_secret}
    if nickname is not None:
        payload["nickname"] = nickname
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post("/v1/auth/anonymous", json=payload)


async def test_first_call_creates_anonymous_user():
    """(a) 최초 호출 → 201 + 익명 User 생성(is_anonymous=true)."""
    device_secret = f"dev-{uuid.uuid4()}"

    resp = await _post_anonymous(device_secret, nickname="첫기기")

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert data["nickname"] == "첫기기"
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["requires_assessment"] is True

    user = await _fetch_user(uuid.UUID(data["user_id"]))
    assert user.is_anonymous is True
    assert user.email_hash is None
    assert user.password_hash is None
    assert user.device_secret_hash is not None


async def test_same_device_secret_reauthenticates_same_user():
    """(b) 동일 device_secret 재호출 → 같은 user_id 반환(신규 생성 X)."""
    device_secret = f"dev-{uuid.uuid4()}"

    first = await _post_anonymous(device_secret)
    second = await _post_anonymous(device_secret)

    assert first.status_code == 201
    assert second.status_code == 201
    first_user_id = first.json()["data"]["user_id"]
    second_user_id = second.json()["data"]["user_id"]
    assert first_user_id == second_user_id

    user = await _fetch_user(uuid.UUID(first_user_id))
    assert user.device_secret_hash is not None


async def test_different_device_secret_creates_different_user():
    """(c) 다른 secret → 다른 user."""
    resp_a = await _post_anonymous(f"dev-{uuid.uuid4()}")
    resp_b = await _post_anonymous(f"dev-{uuid.uuid4()}")

    assert resp_a.status_code == 201
    assert resp_b.status_code == 201
    assert resp_a.json()["data"]["user_id"] != resp_b.json()["data"]["user_id"]


async def test_nickname_defaults_to_anonymous_label_when_omitted():
    """nickname 미전달 시 기본값 '익명'."""
    resp = await _post_anonymous(f"dev-{uuid.uuid4()}")

    assert resp.status_code == 201
    assert resp.json()["data"]["nickname"] == "익명"
