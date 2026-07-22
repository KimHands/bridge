"""M2 운영자용 익명 사용 지표 집계 테스트.

SQLite에 필요한 __table__만 생성한다(ARRAY 보유 routines 테이블 회피, FK off).
KST 경계·source 분리·tier 분리·빈 구간을 단언한다.
"""
import uuid
from datetime import date, datetime, timezone

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.assessment import Assessment
from app.models.mission import TriggerLog
from app.models.routine import RoutineLog, UserRoutine
from app.models.trigger_metric import TriggerDecisionCounter
from app.services.usage_metrics import (
    assessment_tier_distribution,
    routine_completion_stats,
    trigger_activity_stats,
    trigger_decision_stats,
)

_UTC = timezone.utc


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        for model in (UserRoutine, RoutineLog, Assessment, TriggerLog, TriggerDecisionCounter):
            await conn.run_sync(model.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        yield session
    await engine.dispose()


def _user_routine(*, source: str, assigned_at: datetime, is_active: bool = True) -> UserRoutine:
    return UserRoutine(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        routine_id=1,
        source=source,
        is_active=is_active,
        assigned_at=assigned_at,
    )


@pytest.mark.asyncio
async def test_routine_completion_counts_and_rate(db):
    # routine_logs는 (user_routine_id, completed_date) UNIQUE — 루틴당 하루 1회.
    # 같은 날 2회를 보려면 서로 다른 루틴 2개가 필요하다.
    ur1 = _user_routine(source="initial", assigned_at=datetime(2026, 6, 1, tzinfo=_UTC))
    ur2 = _user_routine(source="initial", assigned_at=datetime(2026, 6, 1, tzinfo=_UTC))
    db.add_all([ur1, ur2])
    # 6/10: ur1·ur2 각 1회(=2), 6/11: ur1 1회
    db.add(RoutineLog(id=uuid.uuid4(), user_routine_id=ur1.id,
                      completed_date=date(2026, 6, 10), created_at=datetime(2026, 6, 10, tzinfo=_UTC)))
    db.add(RoutineLog(id=uuid.uuid4(), user_routine_id=ur2.id,
                      completed_date=date(2026, 6, 10), created_at=datetime(2026, 6, 10, tzinfo=_UTC)))
    db.add(RoutineLog(id=uuid.uuid4(), user_routine_id=ur1.id,
                      completed_date=date(2026, 6, 11), created_at=datetime(2026, 6, 11, tzinfo=_UTC)))
    await db.commit()

    res = await routine_completion_stats(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["total_completions"] == 3
    assert res["daily_completions"] == {date(2026, 6, 10): 2, date(2026, 6, 11): 1}
    assert res["distinct_completed_routines"] == 2
    assert res["active_routines_now"] == 2
    assert res["approx_completion_rate"] == 3 / (2 * 30)


@pytest.mark.asyncio
async def test_routine_completion_excludes_out_of_range_and_no_active(db):
    ur = _user_routine(source="manual", assigned_at=datetime(2026, 6, 1, tzinfo=_UTC),
                       is_active=False)
    db.add(ur)
    db.add(RoutineLog(id=uuid.uuid4(), user_routine_id=ur.id,
                      completed_date=date(2026, 5, 1),  # 구간 밖
                      created_at=datetime(2026, 5, 1, tzinfo=_UTC)))
    await db.commit()

    res = await routine_completion_stats(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["total_completions"] == 0
    assert res["active_routines_now"] == 0
    assert res["approx_completion_rate"] is None


@pytest.mark.asyncio
async def test_trigger_activity_by_source_and_keyword(db):
    db.add(_user_routine(source="initial", assigned_at=datetime(2026, 6, 5, tzinfo=_UTC)))
    db.add(_user_routine(source="trigger", assigned_at=datetime(2026, 6, 6, tzinfo=_UTC)))
    db.add(_user_routine(source="trigger", assigned_at=datetime(2026, 6, 7, tzinfo=_UTC)))
    db.add(_user_routine(source="manual", assigned_at=datetime(2026, 5, 1, tzinfo=_UTC)))  # 구간 밖
    for kw, day in (("불안한", 6), ("불안한", 7), ("우울한", 8)):
        db.add(TriggerLog(id=uuid.uuid4(), user_id=uuid.uuid4(),
                          triggered_keyword=kw, routine_id=1,
                          cooldown_until=datetime(2026, 6, day + 3, tzinfo=_UTC),
                          created_at=datetime(2026, 6, day, 3, tzinfo=_UTC)))
    await db.commit()

    res = await trigger_activity_stats(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["assignments_by_source"] == {"initial": 1, "trigger": 2, "manual": 0}
    assert res["total_triggers"] == 3
    assert res["triggers_by_keyword"] == {"불안한": 2, "우울한": 1}


@pytest.mark.asyncio
async def test_trigger_kst_boundary_bucketing(db):
    # UTC 2026-06-09 15:30 = KST 2026-06-10 00:30 → 6/10 버킷
    db.add(TriggerLog(id=uuid.uuid4(), user_id=uuid.uuid4(),
                      triggered_keyword="초조한", routine_id=1,
                      cooldown_until=datetime(2026, 6, 13, tzinfo=_UTC),
                      created_at=datetime(2026, 6, 9, 15, 30, tzinfo=_UTC)))
    await db.commit()

    res = await trigger_activity_stats(db, date(2026, 6, 10), date(2026, 6, 10))
    assert res["daily_triggers"] == {date(2026, 6, 10): 1}


@pytest.mark.asyncio
async def test_assessment_tier_distribution(db):
    for tier, day in ((1, 5), (3, 6), (3, 6), (4, 20)):
        db.add(Assessment(id=uuid.uuid4(), user_id=uuid.uuid4(),
                          encrypted_result="x", phq_tier=tier,
                          created_at=datetime(2026, 6, day, 3, tzinfo=_UTC)))
    await db.commit()

    res = await assessment_tier_distribution(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["by_tier"] == {1: 1, 2: 0, 3: 2, 4: 1}
    assert res["total"] == 4
    assert res["daily_by_tier"][date(2026, 6, 6)] == {3: 2}


@pytest.mark.asyncio
async def test_empty_range_returns_zeros(db):
    res = await assessment_tier_distribution(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["total"] == 0
    assert res["by_tier"] == {1: 0, 2: 0, 3: 0, 4: 0}
    assert res["daily_by_tier"] == {}


@pytest.mark.asyncio
async def test_trigger_decision_stats_excludes_coldstart_bypass_from_total(db):
    # coldstart_bypass는 종료 결정이 아닌 비종료 마커라 total·fire_rate 분모에서 빠지고
    # 별도 카운트로만 보고되어야 한다(F2/F4).
    db.add(TriggerDecisionCounter(outcome="fired", day_bucket=date(2026, 6, 10), count=3))
    db.add(TriggerDecisionCounter(outcome="no_candidate", day_bucket=date(2026, 6, 11), count=2))
    db.add(TriggerDecisionCounter(outcome="coldstart_bypass", day_bucket=date(2026, 6, 12), count=5))
    await db.commit()

    res = await trigger_decision_stats(db, date(2026, 6, 1), date(2026, 6, 30))
    assert res["total"] == 5
    assert res["fire_rate"] == 3 / 5
    assert res["coldstart_bypass_count"] == 5
    assert "coldstart_bypass" not in res["by_outcome"]
