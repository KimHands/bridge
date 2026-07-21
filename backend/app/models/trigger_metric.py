"""트리거 결정 익명 사전집계 카운터.

user_id를 저장하지 않는다 — (outcome, day_bucket)당 1행, count만 누적.
무발동(provide nothing) 결정은 기존 테이블에서 유도할 수 없으므로 별도로 센다.
"""
import uuid
from datetime import date

from sqlalchemy import Date, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TriggerDecisionCounter(Base, TimestampMixin):
    __tablename__ = "trigger_decision_counters"
    __table_args__ = (
        UniqueConstraint("outcome", "day_bucket", name="uq_trigger_outcome_day"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    outcome: Mapped[str] = mapped_column(String(40), nullable=False)
    day_bucket: Mapped[date] = mapped_column(Date, nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
