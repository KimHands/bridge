from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.safety_metric import SafetyEventCounter
from app.services.safety_metrics import (
    assessment_crisis_events,
    record_safety_event,
    today_kst,
)


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(SafetyEventCounter.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


async def _count(factory, event_type) -> int:
    async with factory() as db:
        row = (
            await db.execute(
                select(SafetyEventCounter).where(
                    SafetyEventCounter.event_type == event_type
                )
            )
        ).scalar_one_or_none()
        return row.count if row else 0


def test_today_kst_returns_seoul_date():
    expected = datetime.now(ZoneInfo("Asia/Seoul")).date()
    assert today_kst() == expected
    assert isinstance(today_kst(), date)


@pytest.mark.asyncio
async def test_upsert_is_idempotent_increment(session_factory):
    await record_safety_event("crisis_flag_phq9", session_factory=session_factory)
    await record_safety_event("crisis_flag_phq9", session_factory=session_factory)
    assert await _count(session_factory, "crisis_flag_phq9") == 2

    async with session_factory() as db:
        rows = (await db.execute(select(SafetyEventCounter))).scalars().all()
    assert len(rows) == 1  # 하루·종류당 1행


@pytest.mark.asyncio
async def test_distinct_event_types_separate_rows(session_factory):
    await record_safety_event("crisis_flag_phq9", session_factory=session_factory)
    await record_safety_event("chat_guard_input", session_factory=session_factory)
    assert await _count(session_factory, "crisis_flag_phq9") == 1
    assert await _count(session_factory, "chat_guard_input") == 1


@pytest.mark.asyncio
async def test_record_swallows_errors():
    # 세션 생성 시 예외를 던지는 가짜 factory — 호출자는 절대 터지지 않는다
    def broken_factory():
        raise RuntimeError("db down")

    await record_safety_event("crisis_flag_phq9", session_factory=broken_factory)
    # 예외가 전파되지 않으면 통과


def test_assessment_crisis_events_mapping():
    assert assessment_crisis_events(needs_professional_flag=True, phq_tier=4) == [
        "crisis_flag_phq9",
        "crisis_tier4",
    ]
    assert assessment_crisis_events(needs_professional_flag=True, phq_tier=2) == [
        "crisis_flag_phq9"
    ]
    assert assessment_crisis_events(needs_professional_flag=False, phq_tier=4) == [
        "crisis_tier4"
    ]
    assert assessment_crisis_events(needs_professional_flag=False, phq_tier=1) == []
