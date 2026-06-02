import uuid
from datetime import date, datetime

from sqlalchemy import (
    ARRAY, Boolean, Date, DateTime, ForeignKey, Index, Integer,
    SmallInteger, String, Text, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    target_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    phq_tier_min: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    phq_tier_max: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=4)


class UserRoutine(Base, TimestampMixin):
    __tablename__ = "user_routines"
    __table_args__ = (Index("ix_user_routines_user_active", "user_id", "is_active"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    routine_id: Mapped[int] = mapped_column(Integer, ForeignKey("routines.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False)  # initial / trigger / manual
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class RoutineLog(Base):
    __tablename__ = "routine_logs"
    # 하루 한 사용자루틴당 완료 1건 — 동시 더블탭 중복 삽입을 DB 레벨에서 방어.
    __table_args__ = (
        UniqueConstraint("user_routine_id", "completed_date", name="uq_routine_log_user_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_routine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("user_routines.id", ondelete="CASCADE"), nullable=False
    )
    completed_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
