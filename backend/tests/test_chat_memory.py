import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.models.chat import ChatMemory
from app.services.chat_memory import (
    should_extract,
    _build_extract_messages,
    load_memories,
    _store_memory,
    _enforce_limit,
)


def test_should_extract_only_on_interval():
    # _MEMORY_EXTRACT_EVERY = 3: 턴 수 6,9 → True / 4,0 → False
    assert should_extract(turn_count=6) is True
    assert should_extract(turn_count=9) is True
    assert should_extract(turn_count=4) is False
    assert should_extract(turn_count=0) is False


def test_build_extract_messages_includes_instruction():
    session = [{"role": "user", "content": "나는 강아지를 키워"}]
    msgs = _build_extract_messages(session)
    assert msgs[0]["role"] == "system"
    assert "특징" in msgs[0]["content"]
    assert "제외" in msgs[0]["content"]  # 위기·감정 발화 제외 지시


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(ChatMemory.__table__.create)  # only this table
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_store_and_load_roundtrip(db: AsyncSession):
    uid = uuid.uuid4()
    await _store_memory(db, uid, "강아지를 키우고 캠핑을 좋아함")
    await db.commit()
    memories = await load_memories(db, uid)
    assert "강아지" in memories[0]


@pytest.mark.asyncio
async def test_enforce_limit_keeps_recent(db: AsyncSession, monkeypatch):
    monkeypatch.setattr(
        "app.services.chat_memory.settings.chat_memory_max", 2, raising=False
    )
    uid = uuid.uuid4()
    for i in range(4):
        await _store_memory(db, uid, f"특징{i}")
        await db.commit()
    await _enforce_limit(db, uid)
    await db.commit()
    memories = await load_memories(db, uid)
    assert len(memories) == 2
