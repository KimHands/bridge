import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.trigger_metric import TriggerDecisionCounter
from app.services.trigger_metrics import (
    DECISION_BLOCKED_MOOD,
    DECISION_FIRED,
    record_trigger_decision,
)


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(TriggerDecisionCounter.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest.mark.asyncio
async def test_records_counter_row(session_factory):
    await record_trigger_decision(DECISION_FIRED, session_factory=session_factory)
    async with session_factory() as db:
        rows = (await db.execute(select(TriggerDecisionCounter))).scalars().all()
    assert len(rows) == 1
    assert rows[0].outcome == DECISION_FIRED
    assert rows[0].count == 1


@pytest.mark.asyncio
async def test_same_outcome_same_day_increments(session_factory):
    await record_trigger_decision(DECISION_FIRED, session_factory=session_factory)
    await record_trigger_decision(DECISION_FIRED, session_factory=session_factory)
    async with session_factory() as db:
        rows = (await db.execute(select(TriggerDecisionCounter))).scalars().all()
    assert len(rows) == 1
    assert rows[0].count == 2


@pytest.mark.asyncio
async def test_distinct_outcomes_are_separate_rows(session_factory):
    await record_trigger_decision(DECISION_FIRED, session_factory=session_factory)
    await record_trigger_decision(DECISION_BLOCKED_MOOD, session_factory=session_factory)
    async with session_factory() as db:
        rows = (await db.execute(select(TriggerDecisionCounter))).scalars().all()
    assert {r.outcome for r in rows} == {DECISION_FIRED, DECISION_BLOCKED_MOOD}


@pytest.mark.asyncio
async def test_failure_is_swallowed(session_factory):
    # 계측 실패가 트리거 본 로직을 깨뜨리지 않아야 한다.
    def broken_factory():
        raise RuntimeError("db down")

    await record_trigger_decision(DECISION_FIRED, session_factory=broken_factory)


def test_no_user_id_column():
    # 익명 사전집계 — 개인 식별자를 저장하지 않는다.
    assert "user_id" not in TriggerDecisionCounter.__table__.columns
