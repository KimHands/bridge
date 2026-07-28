# backend/tests/test_auth_anonymous.py
"""POST /v1/auth/anonymous 라이브 Postgres E2E.

User.device_secret_hash는 실제 컬럼(UNIQUE)이고 판정 로직은 DB 조회 그 자체라
SQLite 모킹보다 실제 컨테이너(bridge-api-1, Postgres) 대상 httpx 호출로 검증한다.
matched(재인증) 여부는 응답 user_id 동일성으로, 신규 생성/is_anonymous는
AsyncSessionLocal로 직접 조회해 확인한다. 각 테스트는 uuid4로 만든 고유
device_secret을 사용해 재실행 시에도 UNIQUE 제약과 충돌하지 않는다.
"""
import asyncio
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


async def _post_anonymous(
    device_secret: str, nickname: str | None = None, xff: str | None = None
) -> httpx.Response:
    payload = {"device_secret": device_secret}
    if nickname is not None:
        payload["nickname"] = nickname
    # 각 테스트의 생성을 고유 IP 버킷으로 격리한다(레이트리밋 누적으로 스위트가
    # 깨지지 않도록). 기본값은 device_secret — 같은 기기 재인증은 같은 버킷을 쓰되
    # 재인증은 카운트되지 않으므로 문제없다. 레이트리밋 자체 검증은 xff를 고정한다.
    headers = {"X-Forwarded-For": xff or device_secret}
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/auth/anonymous", json=payload, headers=headers
        )


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


async def test_concurrent_same_device_secret_yields_one_user_no_error():
    """(TOCTOU) 같은 device_secret 동시 요청 2건 → UNIQUE 충돌(500) 없이 둘 다 201,
    동일 user_id. 동시 생성 경쟁이 재인증으로 흡수돼야 한다."""
    device_secret = f"dev-{uuid.uuid4()}"

    r1, r2 = await asyncio.gather(
        _post_anonymous(device_secret),
        _post_anonymous(device_secret),
    )

    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.json()["data"]["user_id"] == r2.json()["data"]["user_id"]


async def test_new_account_creation_rate_limited_per_ip():
    """(레이트리밋 배선) 같은 IP에서 서로 다른 device_secret으로 신규 생성을 반복하면
    시간당 상한 초과 시 429가 나야 한다. 재인증은 대상이 아니므로 신규 생성만 카운트된다."""
    from app.services import anon_rate_limiter as arl

    fixed_ip = f"198.51.100.{uuid.uuid4().int % 200 + 1}"  # 테스트 전용 고정 버킷

    statuses = []
    for _ in range(arl.ANON_CREATE_PER_HOUR + 1):
        resp = await _post_anonymous(f"dev-{uuid.uuid4()}", xff=fixed_ip)
        statuses.append(resp.status_code)

    # 상한까지는 201, 마지막 한 건은 429
    assert statuses[:-1] == [201] * arl.ANON_CREATE_PER_HOUR
    assert statuses[-1] == 429
