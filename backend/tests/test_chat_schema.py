import pytest
from pydantic import ValidationError

from app.schemas.chat import ChatMessageRequest, ChatMessageResponse


def test_message_request_rejects_empty():
    with pytest.raises(ValidationError):
        ChatMessageRequest(message="   ")


def test_message_request_rejects_too_long():
    with pytest.raises(ValidationError):
        ChatMessageRequest(message="가" * 1001)


def test_message_request_strips_whitespace():
    req = ChatMessageRequest(message="  안녕  ")
    assert req.message == "안녕"


def test_message_response_shape():
    r = ChatMessageResponse(reply="안녕", is_crisis=False, crisis_info=None)
    assert r.reply == "안녕"
    assert r.is_crisis is False
