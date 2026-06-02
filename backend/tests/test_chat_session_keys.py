from app.core.redis import _chat_session_key


def test_chat_session_key_format():
    assert _chat_session_key("u123") == "chat:session:u123"
