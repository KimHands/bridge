# backend/app/services/email_sender.py
"""이메일 발송 어댑터 — 익명-우선 인증(승격 이메일 인증) 코드 발송용.

현재는 콘솔(로거) 백엔드만 구현한다. 운영 SMTP 전환 시 SmtpEmailSender를
추가하고 get_email_sender()의 분기만 넓히면 되도록 Protocol로 인터페이스를 고정한다.
"""
import logging
from typing import Protocol

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailSender(Protocol):
    """이메일 발송기 공통 인터페이스."""

    async def send_code(self, email: str, code: str) -> None:
        """인증코드를 email 주소로 발송한다."""
        ...


class ConsoleEmailSender:
    """실제 발송 없이 인증코드를 로거로 출력한다(로컬/개발용)."""

    async def send_code(self, email: str, code: str) -> None:
        logger.info("email verification code for %s: %s", email, code)


# 향후 운영 전환용 자리 — 아직 구현하지 않는다(범위 밖).
# class SmtpEmailSender:
#     """SMTP로 실제 이메일을 발송하는 백엔드. 운영 전환 시 구현."""
#     async def send_code(self, email: str, code: str) -> None: ...


def get_email_sender() -> EmailSender:
    """config.email_backend 값에 따라 EmailSender 구현체를 반환한다."""
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    # elif settings.email_backend == "smtp":
    #     return SmtpEmailSender()
    raise ValueError(f"지원하지 않는 email_backend: {settings.email_backend}")
