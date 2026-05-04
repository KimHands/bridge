import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class EmotionKeyword(Base):
    __tablename__ = "emotion_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(100), nullable=False)


class DiaryEmotionKeyword(Base):
    __tablename__ = "diary_emotion_keywords"

    diary_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("diary_entries.id", ondelete="CASCADE"),
        primary_key=True,
    )
    keyword_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("emotion_keywords.id", ondelete="CASCADE"),
        primary_key=True,
    )


class SituationKeyword(Base, TimestampMixin):
    __tablename__ = "situation_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    diary_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("diary_entries.id", ondelete="CASCADE"), nullable=False
    )
    keyword_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("emotion_keywords.id"), nullable=False
    )
    answer_text: Mapped[str] = mapped_column(String(100), nullable=False)
