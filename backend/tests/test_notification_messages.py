# backend/tests/test_notification_messages.py
import pytest

from app.services.notification import (
    NOTIFICATION_MESSAGES,
    assert_domain_safe,
    get_message,
)


def test_all_static_messages_pass_domain_guard():
    for notification_type, msg in NOTIFICATION_MESSAGES.items():
        assert_domain_safe(msg["title"])
        assert_domain_safe(msg["body"])


def test_banned_term_raises():
    with pytest.raises(ValueError, match="치료"):
        assert_domain_safe("치료 방법을 알려드려요")


def test_banned_phq_raises():
    with pytest.raises(ValueError, match="PHQ"):
        assert_domain_safe("PHQ-9 지수가 변했어요")


def test_clean_text_passes():
    assert assert_domain_safe("오늘 하루는 어땠나요") is None


def test_get_message_returns_routine_reminder():
    msg = get_message("routine_reminder")
    assert msg["title"] == "오늘의 루틴 시간이에요"
