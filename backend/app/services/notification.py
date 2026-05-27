# backend/app/services/notification.py
import logging
from datetime import UTC, date as date_cls, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

import httpx
from sqlalchemy import and_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.diary import DiaryEntry
from app.models.notification import DeviceToken, NotificationLog, NotificationSetting
from app.models.user import User

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


logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_SIZE = 100
KST = ZoneInfo("Asia/Seoul")
ROUTINE_REMINDER_WINDOW_MINUTES = 2.5


async def _send_to_expo(messages: list[dict]) -> list[dict]:
    """Expo Push API에 chunk POST. 응답 ticket 리스트 반환."""
    if not messages:
        return []

    async with httpx.AsyncClient(timeout=30.0) as client:
        tickets: list[dict] = []
        for i in range(0, len(messages), EXPO_BATCH_SIZE):
            chunk = messages[i : i + EXPO_BATCH_SIZE]
            try:
                resp = await client.post(
                    EXPO_PUSH_URL,
                    json=chunk,
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                resp.raise_for_status()
                tickets.extend(resp.json().get("data", []))
            except httpx.HTTPError as e:
                logger.error(f"Expo Push API error: {e}")
                tickets.extend([{"status": "error", "message": str(e)}] * len(chunk))
        return tickets


async def _record_log(
    db: AsyncSession,
    user_id,
    notification_type: NotificationType,
    title: str,
    body: str,
    data_payload: dict,
    status: str,
    error_message: str | None = None,
) -> None:
    log = NotificationLog(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        body=body,
        data_payload=data_payload,
        status=status,
        error_message=error_message,
    )
    db.add(log)


async def send_notification(
    db: AsyncSession,
    user_id,
    tokens: list[DeviceToken],
    notification_type: NotificationType,
    deep_link_type: str,
    extra_data: dict | None = None,
) -> None:
    """단일 사용자의 활성 토큰들에 알림 발송 + 로그 기록."""
    if not tokens:
        return

    msg = get_message(notification_type)
    data_payload = {**(extra_data or {}), "type": deep_link_type}

    messages = [
        {
            "to": t.expo_token,
            "title": msg["title"],
            "body": msg["body"],
            "data": data_payload,
            "sound": "default",
            "priority": "high",
        }
        for t in tokens
    ]

    tickets = await _send_to_expo(messages)

    now_utc = datetime.now(UTC)

    assert len(tokens) == len(tickets), f"token/ticket count mismatch: {len(tokens)} vs {len(tickets)}"
    for token, ticket in zip(tokens, tickets):
        ticket_status = ticket.get("status", "error")
        if ticket_status == "ok":
            await _record_log(db, user_id, notification_type, msg["title"], msg["body"], data_payload, "sent")
            await db.execute(
                update(DeviceToken)
                .where(DeviceToken.id == token.id)
                .values(last_used_at=now_utc)
            )
        else:
            error_code = ticket.get("details", {}).get("error", "")
            if error_code == "DeviceNotRegistered":
                await db.execute(
                    update(DeviceToken).where(DeviceToken.id == token.id).values(is_active=False)
                )
            await _record_log(
                db, user_id, notification_type, msg["title"], msg["body"], data_payload,
                "failed", error_message=ticket.get("message", error_code),
            )

    await db.commit()


async def send_diary_nudges() -> None:
    """매일 21:00 KST — 당일 일기 미작성자에게 알림."""
    today = date_cls.today()

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User.id)
            .join(NotificationSetting, NotificationSetting.user_id == User.id)
            .where(NotificationSetting.push_enabled.is_(True))
        )
        candidate_user_ids = result.scalars().all()

        for user_id in candidate_user_ids:
            diary_check = await db.execute(
                select(DiaryEntry.id)
                .where(
                    and_(DiaryEntry.user_id == user_id, DiaryEntry.recorded_date == today)
                )
                .limit(1)
            )
            if diary_check.scalar_one_or_none() is not None:
                continue  # 이미 작성됨 → skip

            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(DeviceToken.user_id == user_id, DeviceToken.is_active.is_(True))
                )
            )
            tokens = token_result.scalars().all()
            await send_notification(
                db=db,
                user_id=user_id,
                tokens=list(tokens),
                notification_type="diary_nudge",
                deep_link_type="diary_nudge",
            )


def is_within_reminder_window(reminder_time: time, now_kst: datetime) -> bool:
    """reminder_time이 now_kst ± 2.5분 윈도우 안에 있는지 확인."""
    now_minutes = now_kst.hour * 60 + now_kst.minute + now_kst.second / 60
    reminder_minutes = reminder_time.hour * 60 + reminder_time.minute
    diff = abs(now_minutes - reminder_minutes)
    # 자정 경계 처리
    diff = min(diff, 24 * 60 - diff)
    return diff <= ROUTINE_REMINDER_WINDOW_MINUTES


async def send_routine_reminders() -> None:
    """5분마다 호출 — routine_reminder_time이 현재 ± 2.5분 사용자에게 발송."""
    now_kst = datetime.now(KST)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(NotificationSetting).where(NotificationSetting.push_enabled.is_(True))
        )
        settings = result.scalars().all()

        for setting in settings:
            if not is_within_reminder_window(setting.routine_reminder_time, now_kst):
                continue

            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(
                        DeviceToken.user_id == setting.user_id,
                        DeviceToken.is_active.is_(True),
                    )
                )
            )
            tokens = token_result.scalars().all()
            await send_notification(
                db=db,
                user_id=setting.user_id,
                tokens=list(tokens),
                notification_type="routine_reminder",
                deep_link_type="routine_reminder",
            )
