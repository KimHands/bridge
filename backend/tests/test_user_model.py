import uuid

import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models.user import User


@pytest_asyncio.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(User.__table__.create)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


def test_user_table_and_columns():
    cols = User.__table__.columns
    assert "email_hash" in cols
    assert "password_hash" in cols
    assert "is_anonymous" in cols
    assert "device_secret_hash" in cols
    assert "email_verified" in cols
    # email_hash/password_hash는 익명 사용자를 위해 nullable
    assert cols["email_hash"].nullable is True
    assert cols["password_hash"].nullable is True
    assert cols["is_anonymous"].nullable is False
    assert cols["email_verified"].nullable is False
    assert cols["device_secret_hash"].unique is True


@pytest.mark.asyncio
async def test_anonymous_user_defaults(session_factory):
    """이메일 없이 생성된 사용자는 is_anonymous=True, email_verified=False 기본값을 가진다."""
    user = User(id=uuid.uuid4(), nickname="익명123")
    async with session_factory() as db:
        db.add(user)
        await db.commit()
        await db.refresh(user)

    assert user.email_hash is None
    assert user.password_hash is None
    assert user.is_anonymous is True
    assert user.email_verified is False
    assert user.device_secret_hash is None


@pytest.mark.asyncio
async def test_email_user_can_override_defaults(session_factory):
    """이메일 가입 사용자는 is_anonymous=False, email_verified=True로 명시 생성 가능."""
    user = User(
        id=uuid.uuid4(),
        nickname="가입자",
        email_hash="a" * 64,
        password_hash="b" * 60,
        is_anonymous=False,
        email_verified=True,
    )
    async with session_factory() as db:
        db.add(user)
        await db.commit()
        await db.refresh(user)

    assert user.is_anonymous is False
    assert user.email_verified is True


@pytest.mark.asyncio
async def test_device_secret_hash_unique(session_factory):
    """device_secret_hash는 UNIQUE 제약을 가진다."""
    dup_hash = "c" * 64
    async with session_factory() as db:
        db.add(User(id=uuid.uuid4(), nickname="기기1", device_secret_hash=dup_hash))
        await db.commit()

    async with session_factory() as db:
        db.add(User(id=uuid.uuid4(), nickname="기기2", device_secret_hash=dup_hash))
        with pytest.raises(IntegrityError):
            await db.commit()
