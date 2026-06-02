from app.models.chat import ChatMemory


def test_chat_memory_table_and_columns():
    assert ChatMemory.__tablename__ == "chat_memories"
    cols = ChatMemory.__table__.columns
    assert "id" in cols
    assert "user_id" in cols
    assert "encrypted_content" in cols
    assert "created_at" in cols
