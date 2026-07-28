# backend/tests/test_email_sender.py
import logging

from app.core.config import settings
from app.services.email_sender import ConsoleEmailSender, get_email_sender


async def test_console_email_sender_logs_code(caplog):
    """ConsoleEmailSender.send_code는 실제 발송 없이 인증코드를 로거로 남긴다."""
    sender = ConsoleEmailSender()

    with caplog.at_level(logging.INFO, logger="app.services.email_sender"):
        await sender.send_code("user@example.com", "123456")

    assert any(
        "user@example.com" in record.message and "123456" in record.message
        for record in caplog.records
    )


def test_get_email_sender_returns_console_by_default(monkeypatch):
    """config.email_backend가 'console'이면 ConsoleEmailSender 인스턴스를 반환한다."""
    monkeypatch.setattr(settings, "email_backend", "console")

    sender = get_email_sender()

    assert isinstance(sender, ConsoleEmailSender)
