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
            "/v1/auth/anonymous",
            json={"device_secret": device_secret},
            headers={"X-Forwarded-For": device_secret},  # 생성 레이트리밋 버킷 격리
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


async def _upgrade_and_verify(user_id: str, access_token: str, email: str) -> None:
    """upgrade → pending 코드 조회 → verify까지 완료해 계정을 실제 확정한다."""
    upgrade_resp = await _upgrade(access_token, email)
    assert upgrade_resp.status_code == 200
    pending = await _get_pending_verify(user_id)
    assert pending is not None
    verify_resp = await _verify_email(access_token, pending["code"])
    assert verify_resp.status_code == 200


async def test_upgrade_does_not_mutate_user_before_verification():
    """(a) 익명 사용자 → 일기 작성 → upgrade → 인증 전에는 User가 그대로여야 한다
    (email_hash=None·is_anonymous=true·email_verified=false, 미검증 이메일 선점 방지).
    기존 일기 데이터는 같은 user.id로 보존된다. 확정은 verify에서 이뤄진다."""
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

    # 인증 전 — User 행은 변경되지 않아야 한다(미검증 이메일 선점 방지)
    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_hash is None
    assert user.password_hash is None
    assert user.is_anonymous is True
    assert user.email_verified is False

    # 데이터 보존 — 동일 user_id로 일기가 그대로 남아 있어야 한다
    after = await _fetch_diary_count(uuid.UUID(user_id))
    assert after == before == 1


async def test_upgrade_with_verified_duplicate_email_returns_409():
    """(b) 이미 인증까지 마친 이메일로 upgrade → 409 EMAIL_ALREADY_EXISTS(조기 차단)."""
    email = f"dup-{uuid.uuid4()}@example.com"

    first_id, first_token = await _create_anonymous_user()
    await _upgrade_and_verify(first_id, first_token, email)

    _, second_token = await _create_anonymous_user()
    second_resp = await _upgrade(second_token, email)

    assert second_resp.status_code == 409
    assert second_resp.json()["detail"]["code"] == "EMAIL_ALREADY_EXISTS"


async def test_concurrent_unverified_upgrade_same_email_resolves_at_verify():
    """미검증 upgrade는 이메일을 선점하지 않는다 — 두 익명 사용자가 같은 이메일로
    upgrade하면 둘 다 200(pending)이고, 먼저 verify한 쪽이 이기며 나중 쪽은
    verify에서 409 EMAIL_ALREADY_EXISTS로 해소된다(선점/락아웃 없음)."""
    email = f"race-{uuid.uuid4()}@example.com"

    first_id, first_token = await _create_anonymous_user()
    second_id, second_token = await _create_anonymous_user()

    # 둘 다 미검증 upgrade 성공 — 어느 쪽도 email_hash를 선점하지 않는다
    assert (await _upgrade(first_token, email)).status_code == 200
    assert (await _upgrade(second_token, email)).status_code == 200

    # 먼저 verify한 쪽이 이메일을 확정
    first_pending = await _get_pending_verify(first_id)
    assert (await _verify_email(first_token, first_pending["code"])).status_code == 200

    # 나중 쪽은 verify 시점 유니크 재검사에서 409
    second_pending = await _get_pending_verify(second_id)
    late_resp = await _verify_email(second_token, second_pending["code"])
    assert late_resp.status_code == 409
    assert late_resp.json()["detail"]["code"] == "EMAIL_ALREADY_EXISTS"

    # 진 쪽 계정은 여전히 익명 상태로 남아야 한다(부분 확정 없음)
    loser = await _fetch_user(uuid.UUID(second_id))
    assert loser.email_hash is None
    assert loser.is_anonymous is True


async def test_verify_email_with_matching_code_commits_account_and_clears_pending():
    """(c) verify-email 코드 일치 → 이 시점에 email_hash·password_hash·
    is_anonymous=false·email_verified=true가 일괄 확정되고 Redis pending은 삭제된다.
    확정된 비밀번호로 이후 로그인이 되어야 한다(pending의 password_hash가 정상 반영)."""
    user_id, access_token = await _create_anonymous_user()
    email = f"verify-{uuid.uuid4()}@example.com"

    upgrade_resp = await _upgrade(access_token, email, password="pw12345678")
    assert upgrade_resp.status_code == 200

    pending = await _get_pending_verify(user_id)
    assert pending is not None
    assert pending["email"] == email
    code = pending["code"]

    verify_resp = await _verify_email(access_token, code)

    assert verify_resp.status_code == 200
    assert verify_resp.json()["data"]["email_verified"] is True

    # 이 시점에 전 필드가 확정돼야 한다
    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_hash is not None
    assert user.password_hash is not None
    assert user.is_anonymous is False
    assert user.email_verified is True

    assert await _get_pending_verify(user_id) is None

    # 확정된 이메일+비밀번호로 로그인 가능 — pending의 password_hash가 정상 반영됐는지 확인
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        login_resp = await client.post(
            "/v1/auth/login", json={"email": email, "password": "pw12345678"}
        )
    assert login_resp.status_code == 200


async def test_verify_email_with_wrong_code_returns_400_and_leaves_user_untouched():
    """잘못된 코드 → 400 INVALID_CODE. 확정이 일어나지 않아 User는 익명 그대로여야 한다."""
    user_id, access_token = await _create_anonymous_user()
    email = f"wrongcode-{uuid.uuid4()}@example.com"

    upgrade_resp = await _upgrade(access_token, email)
    assert upgrade_resp.status_code == 200

    resp = await _verify_email(access_token, "000000")

    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "INVALID_CODE"

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_hash is None
    assert user.is_anonymous is True
    assert user.email_verified is False


async def test_verify_email_brute_force_returns_429_after_max_attempts():
    """코드 오입력이 상한(5회)을 넘으면 429 TOO_MANY_ATTEMPTS로 잠기고 pending이
    파기된다(브루트포스 방어). 이후 정답 코드도 통하지 않아야 한다."""
    user_id, access_token = await _create_anonymous_user()
    email = f"brute-{uuid.uuid4()}@example.com"

    assert (await _upgrade(access_token, email)).status_code == 200
    pending = await _get_pending_verify(user_id)
    correct_code = pending["code"]

    # 5회까지는 400(오답), 6회째부터 429
    for _ in range(5):
        r = await _verify_email(access_token, "000000")
        assert r.status_code == 400

    locked = await _verify_email(access_token, "000000")
    assert locked.status_code == 429
    assert locked.json()["detail"]["code"] == "TOO_MANY_ATTEMPTS"

    # pending 파기 확인 — 원래 정답 코드도 이제 무효(재발급 필요)
    assert await _get_pending_verify(user_id) is None
    after = await _verify_email(access_token, correct_code)
    assert after.status_code in (400, 429)

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_verified is False
    assert user.is_anonymous is True


async def test_upgrade_on_verified_account_returns_409():
    """(d) 이미 인증까지 마친(email_hash 확정) 계정이 upgrade 재호출 → 409 ALREADY_UPGRADED.
    (인증 전 재호출은 이메일 변경으로 허용되므로 여기선 verify까지 마친 상태를 검증)."""
    user_id, access_token = await _create_anonymous_user()
    first_email = f"already-{uuid.uuid4()}@example.com"

    await _upgrade_and_verify(user_id, access_token, first_email)

    second_email = f"another-{uuid.uuid4()}@example.com"
    second_resp = await _upgrade(access_token, second_email)

    assert second_resp.status_code == 409
    assert second_resp.json()["detail"]["code"] == "ALREADY_UPGRADED"


async def test_reupgrade_before_verification_replaces_pending_email():
    """인증 전 upgrade 재호출은 허용 — pending 이메일을 새 값으로 교체할 수 있어야 한다
    (오타 정정 UX). User는 여전히 미변경."""
    user_id, access_token = await _create_anonymous_user()

    first_email = f"typo-{uuid.uuid4()}@example.com"
    assert (await _upgrade(access_token, first_email)).status_code == 200

    corrected = f"correct-{uuid.uuid4()}@example.com"
    assert (await _upgrade(access_token, corrected)).status_code == 200

    pending = await _get_pending_verify(user_id)
    assert pending is not None
    assert pending["email"] == corrected

    user = await _fetch_user(uuid.UUID(user_id))
    assert user.email_hash is None
    assert user.is_anonymous is True


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
