import pytest
import fakeredis.aioredis
from app.services import request_rate_limiter as rl


@pytest.fixture
async def r():
    return fakeredis.aioredis.FakeRedis(decode_responses=True)


@pytest.mark.asyncio
async def test_first_request_allowed_and_counts(r):
    s = await rl.check_and_count(r, "u1")
    assert s.allowed_new is True and s.reason == "allow"


@pytest.mark.asyncio
async def test_cooldown_blocks_new_routine_softly(r):
    await rl.check_and_count(r, "u1")
    s = await rl.check_and_count(r, "u1")  # 즉시 재요청 → 쿨다운
    assert s.allowed_new is False and s.reason == "cooldown" and s.nudge is True


@pytest.mark.asyncio
async def test_hard_per_min_blocks_abuse(r):
    for _ in range(rl.HARD_PER_MIN):
        await r.incr("rl:req:u2:min")
    s = await rl.check_and_count(r, "u2")
    assert s.allowed_new is False and s.reason == "abuse"


@pytest.mark.asyncio
async def test_weekly_threshold_offers_connection(r):
    await r.set("rl:req:u3:week", rl.ESCALATION_WEEKLY)
    s = await rl.check_and_count(r, "u3")
    assert s.offer_connection is True


@pytest.mark.asyncio
async def test_concurrent_requests_counted_atomically(r):
    import asyncio
    await asyncio.gather(*[rl.check_and_count(r, "u4") for _ in range(10)])
    assert int(await r.get("rl:req:u4:min")) == 10


@pytest.mark.asyncio
async def test_cooldown_race_exactly_one_allowed(r):
    """콜드 상태 동일 유저에 동시 요청 폭주 → allow는 정확히 1건이어야 함(TOCTOU 재현)."""
    import asyncio
    results = await asyncio.gather(*[rl.check_and_count(r, "u5") for _ in range(20)])
    allowed = [s for s in results if s.allowed_new is True]
    cooldown_blocked = [s for s in results if s.reason == "cooldown"]
    assert len(allowed) == 1
    assert len(cooldown_blocked) == 19
