"""익명 계정 생성 레이트리밋(anon_rate_limiter) 단위 테스트.

IP 기준 신규 생성 카운트의 경계·격리·fail-open을 fakeredis로 검증한다.
엔드포인트 429 배선은 라이브 E2E(test_auth_anonymous)에서 다룬다.
"""
import pytest
import fakeredis.aioredis

from app.services import anon_rate_limiter as arl


@pytest.fixture
async def r():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_within_hourly_limit_allowed(r):
    """시간당 상한까지는 모두 허용된다."""
    for _ in range(arl.ANON_CREATE_PER_HOUR):
        assert await arl.check_anon_creation(r, "1.1.1.1") is True


@pytest.mark.asyncio
async def test_over_hourly_limit_blocked(r):
    """시간당 상한을 넘는 (n+1)번째 생성은 차단된다."""
    for _ in range(arl.ANON_CREATE_PER_HOUR):
        await arl.check_anon_creation(r, "2.2.2.2")
    assert await arl.check_anon_creation(r, "2.2.2.2") is False


@pytest.mark.asyncio
async def test_separate_ip_has_independent_bucket(r):
    """IP가 다르면 버킷이 분리돼 서로 영향을 주지 않는다(공유 NAT 아닌 별개 사용자)."""
    for _ in range(arl.ANON_CREATE_PER_HOUR + 5):
        await arl.check_anon_creation(r, "3.3.3.3")
    # 다른 IP는 여전히 첫 요청부터 허용
    assert await arl.check_anon_creation(r, "4.4.4.4") is True


@pytest.mark.asyncio
async def test_daily_limit_blocks_even_within_hour(r):
    """일 상한 초과 시, 시간 카운터가 만료돼도 하루 동안 차단이 유지된다."""
    k = "rl:anon:5.5.5.5"
    # 일 카운터를 상한까지 채우고 시간 카운터는 비운 상태를 모사
    await r.set(f"{k}:day", arl.ANON_CREATE_PER_DAY)
    assert await arl.check_anon_creation(r, "5.5.5.5") is False


@pytest.mark.asyncio
async def test_fail_open_on_redis_error():
    """Redis 예외 시 허용(fail-open) — 온보딩 차단이 남용보다 나쁨."""

    class BrokenRedis:
        async def incr(self, *a, **k):
            raise RuntimeError("redis down")

    assert await arl.check_anon_creation(BrokenRedis(), "6.6.6.6") is True
