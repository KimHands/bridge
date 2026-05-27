# backend/app/services/notification.py
from typing import Literal

NotificationType = Literal[
    "routine_reminder",
    "diary_nudge",
    "trigger",
    "weekly_mission",
    "assessment_reminder",
]

# 도메인 금지어 — 알림 문구에 절대 포함 금지 (CLAUDE.md 규제 표현 가이드)
_BANNED_TERMS = {
    "치료", "진단", "개선", "효과", "장애", "병원", "의사",
    "우울", "중등도", "PHQ", "GAD",
    "구간", "점수",
}

# 시나리오별 정적 알림 문구
NOTIFICATION_MESSAGES: dict[NotificationType, dict[str, str]] = {
    "routine_reminder": {
        "title": "오늘의 루틴 시간이에요",
        "body": "잠시 멈추고 루틴 하나 함께해요",
    },
    "diary_nudge": {
        "title": "오늘 하루는 어땠나요?",
        "body": "한 줄로 가볍게 기록해볼까요",
    },
    "trigger": {
        "title": "새 루틴이 도착했어요",
        "body": "요즘 마음에 맞는 루틴을 준비했어요",
    },
    "weekly_mission": {
        "title": "이번 주 기록을 모았어요",
        "body": "한 주를 차분히 돌아볼 시간",
    },
    "assessment_reminder": {
        "title": "마음 상태를 확인해볼까요",
        "body": "8주 만에 다시 살펴보는 시간",
    },
}


def assert_domain_safe(text: str) -> None:
    """알림 문구에 도메인 금지어가 포함되어 있으면 예외."""
    for term in _BANNED_TERMS:
        if term in text:
            raise ValueError(f"도메인 금지어 포함: '{term}'")


def get_message(notification_type: NotificationType) -> dict[str, str]:
    """시나리오별 정적 알림 문구 반환 (금지어 가드 통과 확인)."""
    msg = NOTIFICATION_MESSAGES[notification_type]
    assert_domain_safe(msg["title"])
    assert_domain_safe(msg["body"])
    return msg
