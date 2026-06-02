import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, SmallInteger, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class MissionPoint(Base, TimestampMixin):
    __tablename__ = "mission_points"
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    routine_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    diary_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)


class TriggerLog(Base, TimestampMixin):
    __tablename__ = "trigger_logs"
    __table_args__ = (
        Index("ix_trigger_logs_user_keyword_created", "user_id", "triggered_keyword", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    triggered_keyword: Mapped[str] = mapped_column(String(20), nullable=False)
    routine_id: Mapped[int] = mapped_column(Integer, ForeignKey("routines.id"), nullable=False)
    cooldown_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
