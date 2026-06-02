import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ChatMemory(Base, TimestampMixin):
    """사용자의 지속적 특징(선호·상황·관심사) 메모리. AES-256-GCM 암호화 저장."""

    __tablename__ = "chat_memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    encrypted_content: Mapped[str] = mapped_column(Text, nullable=False)
