import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, SmallInteger, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DiaryEntry(Base, TimestampMixin):
    __tablename__ = "diary_entries"
    __table_args__ = (UniqueConstraint("user_id", "recorded_date", name="uq_diary_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    mood_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    encrypted_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
