"""위기·안전 이벤트 익명 사전집계 카운터.

user_id를 저장하지 않는다 — (event_type, day_bucket)당 1행, count만 누적.
정신건강 데이터와 물리적으로 분리된 순수 집계 테이블.
"""
import uuid
from datetime import date

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class SafetyEventCounter(Base, TimestampMixin):
    __tablename__ = "safety_event_counters"
    __table_args__ = (
        UniqueConstraint("event_type", "day_bucket", name="uq_safety_event_type_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
