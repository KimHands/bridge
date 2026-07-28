# backend/tests/test_auth_upgrade.py
"""POST /v1/auth/upgrade, /v1/auth/verify-email, /v1/auth/resend-verification 라이브 E2E.

익명 계정 승격은 같은 user.id에 email_hash/password_hash를 세팅하는 것이 핵심이라
(FK로 연결된 일기 등 기존 데이터가 그대로 보존돼야 함) SQLite 모킹보다 실제
컨테이너(bridge-api-1, Postgres, Redis) 대상 httpx 호출로 검증한다. 인증코드는
콘솔(로거) 백엔드로 발송되므로 Redis pending 상태를 AsyncSessionLocal 대응 방식으로
직접 조회해 확인한다.
"""
import uuid

import httpx
from sqlalchemy import select

from app.core import redis as redis_module
from app.core.database import AsyncSessionLocal, engine
from app.models.diary import DiaryEntry
from app.models.user import User

BASE_URL = "http://localhost:8000"


async def _get_pending_verify(user_id: str) -> dict | None:
    """검증 전용 pending 조회. app.core.redis의 모듈 전역 커넥션은 pytest-asyncio가
    테스트마다 새 이벤트 루프를 만들면서 이전 루프에 묶인다(DB 커넥션과 동일한 문제).
    조회 후 커넥션을 닫고 전역 참조를 비워 다음 테스트가 현재 루프에서 새로
    연결하도록 한다."""
    try:
        return await redis_module.get_pending_verify(user_id)
    finally:
        if redis_module._redis is not None:
            await redis_module._redis.aclose()
            redis_module._redis = None


async def _fetch_user(user_id: uuid.UUID) -> User:
    """검증 전용 DB 조회. pytest-asyncio가 테스트마다 새 이벤트 루프를 만들므로
    앱 전역 엔진의 풀링된 커넥션이 이전 루프에 묶여 재사용 시 충돌한다. 조회 후
    dispose로 풀을 비워 다음 테스트가 현재 루프에서 새 커넥션을 맺도록 한다."""
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one()
    finally:
        await engine.dispose()


async def _fetch_diary_count(user_id: uuid.UUID) -> int:
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(DiaryEntry).where(DiaryEntry.user_id == user_id)
            )
            return len(result.scalars().all())
    finally:
        await engine.dispose()


async def _create_anonymous_user() -> tuple[str, str]:
    """익명 사용자 생성 후 (user_id, access_token) 반환."""
    device_secret = f"dev-{uuid.uuid4()}"
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/v1/auth/anonymous", json={"device_secret": device_secret}
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    return data["user_id"], data["access_token"]


async def _create_diary(access_token: str) -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/diaries",
            json={
                "mood_score": 3,
                "emotion_keywords": ["평온한"],
                "memo": "승격 테스트 일기",
            },
            headers={"Authorization": f"Bearer {access_token}"},
        )


async def _upgrade(access_token: str, email: str, password: str = "pw12345678") -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/auth/upgrade",
            json={"email": email, "password": password},
            headers={"Authorization": f"Bearer {access_token}"},
        )


async def _verify_email(access_token: str, code: str) -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/auth/verify-email",
            json={"code": code},
            headers={"Authorization": f"Bearer {access_token}"},
        )


async def _resend_verification(access_token: str) -> httpx.Response:
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        return await client.post(
            "/v1/auth/resend-verification",
            headers={"Authorization": f"Bearer {access_token}"},
        )


async def test_upgrade_preserves_existing_data_and_sets_email_hash():
    """(a) 익명 사용자 → 일기 작성 → upgrade → email_hash 세팅·is_anonymous=false·
    email_verified=false, 기존 일기 데이터 보존(같은 user.id)."""
    user_id, access_token = await _create_anonymous_user()

    diary_resp = await _create_diary(access_token)
    assert diary_resp.status_code == 201

    before = await _fetch_diary_count(uuid.UUID(user_id))
    assert before == 1

    email = f"upgrade-{uuid.uuid4()}@example.com"
    resp = await _upgrade(access_token, email)

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email_verified"] is False

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_hash is not None
    assert user.password_hash is not None
    assert user.is_anonymous is False
    assert user.email_verified is False

    # 데이터 보존 — 승격 전/후 동일 user_id로 일기가 그대로 남아 있어야 한다
    after = await _fetch_diary_count(uuid.UUID(user_id))
    assert after == before == 1


async def test_upgrade_with_duplicate_email_returns_409():
    """(b) 이미 사용 중인 이메일로 upgrade → 409 EMAIL_ALREADY_EXISTS."""
    email = f"dup-{uuid.uuid4()}@example.com"

    _, first_token = await _create_anonymous_user()
    first_resp = await _upgrade(first_token, email)
    assert first_resp.status_code == 200

    _, second_token = await _create_anonymous_user()
    second_resp = await _upgrade(second_token, email)

    assert second_resp.status_code == 409
    assert second_resp.json()["detail"]["code"] == "EMAIL_ALREADY_EXISTS"


async def test_verify_email_with_matching_code_marks_verified_and_clears_pending():
    """(c) verify-email 코드 일치 → email_verified=true·Redis pending 삭제."""
    user_id, access_token = await _create_anonymous_user()
    email = f"verify-{uuid.uuid4()}@example.com"

    upgrade_resp = await _upgrade(access_token, email)
    assert upgrade_resp.status_code == 200

    pending = await _get_pending_verify(user_id)
    assert pending is not None
    assert pending["email"] == email
    code = pending["code"]

    verify_resp = await _verify_email(access_token, code)

    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["email_verified"] is True

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_verified is True

    assert await _get_pending_verify(user_id) is None


async def test_verify_email_with_wrong_code_returns_400():
    """잘못된 코드 → 400 INVALID_CODE, email_verified는 그대로 false."""
    user_id, access_token = await _create_anonymous_user()
    email = f"wrongcode-{uuid.uuid4()}@example.com"

    upgrade_resp = await _upgrade(access_token, email)
    assert upgrade_resp.status_code == 200

    resp = await _verify_email(access_token, "000000")

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "INVALID_CODE"

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_verified is False


async def test_upgrade_on_already_upgraded_account_returns_409():
    """(d) 이미 승격된 계정 upgrade 재호출 → 409 ALREADY_UPGRADED."""
    _, access_token = await _create_anonymous_user()
    first_email = f"already-{uuid.uuid4()}@example.com"

    first_resp = await _upgrade(access_token, first_email)
    assert first_resp.status_code == 200

    second_email = f"another-{uuid.uuid4()}@example.com"
    second_resp = await _upgrade(access_token, second_email)

    assert second_resp.status_code == 409
    assert second_resp.json()["detail"]["code"] == "ALREADY_UPGRADED"


async def test_resend_verification_issues_new_code_for_same_email():
    """pending 있을 때 resend-verification → 새 코드 발급, 이메일은 동일."""
    user_id, access_token = await _create_anonymous_user()
    email = f"resend-{uuid.uuid4()}@example.com"

    upgrade_resp = await _upgrade(access_token, email)
    assert upgrade_resp.status_code == 200

    first_pending = await _get_pending_verify(user_id)
    assert first_pending is not None

    resend_resp = await _resend_verification(access_token)
    assert resend_resp.status_code == 200

    second_pending = await _get_pending_verify(user_id)
    assert second_pending is not None
    assert second_pending["email"] == email

    # 새로 발급된 코드로 verify-email이 통과해야 한다
    verify_resp = await _verify_email(access_token, second_pending["code"])
    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["email_verified"] is True


async def test_resend_verification_without_pending_returns_400():
    """pending 없이 resend-verification 호출 → 400 NO_PENDING_VERIFICATION."""
    _, access_token = await _create_anonymous_user()

    resp = await _resend_verification(access_token)

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "NO_PENDING_VERIFICATION"


async def test_register_sets_is_anonymous_false():
    """/auth/register(직접 가입) 회귀 가드 — is_anonymous=false로 세팅돼야 한다
    (server_default='true' 때문에 미세팅 시 익명으로 오표시되는 회귀 방지)."""
    email = f"register-{uuid.uuid4()}@example.com"
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        resp = await client.post(
            "/v1/auth/register",
            json={"email": email, "password": "pw12345678", "nickname": "직가입"},
        )

    assert resp.status_code == 201
    user_id = resp.json()["data"]["user_id"]

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.is_anonymous is False
    assert user.email_hash is not None
