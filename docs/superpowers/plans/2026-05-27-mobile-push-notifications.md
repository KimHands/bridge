# Mobile Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge 모바일 앱에 5개 시나리오 푸시 알림(루틴 리마인더·일기 미작성·트리거·주간 미션·자가평가 재진행)을 구현한다.

**Architecture:** Expo Push Service + APScheduler 인라인 발송 (접근법 A). 백엔드는 `notification_settings`/`device_tokens`/`notification_logs` 3개 테이블 + 4개 API + 5개 cron job + `routine_trigger.py` 통합. 모바일은 `expo-notifications`로 토큰 발급·권한·딥링크 처리.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 async, APScheduler, httpx, Expo Push API, React Native 0.74, Expo SDK 51, expo-notifications, expo-device, TanStack Query v5, React Navigation v6, pytest (신규 도입).

**Spec:** [docs/superpowers/specs/2026-05-27-mobile-push-notifications-design.md](../specs/2026-05-27-mobile-push-notifications-design.md)

---

## File Structure

### Backend 신규
- `backend/app/models/notification.py` — DeviceToken, NotificationSetting, NotificationLog ORM 모델
- `backend/app/schemas/notification.py` — Pydantic 요청/응답 스키마
- `backend/app/api/v1/notifications.py` — 4개 엔드포인트 (push-token POST/DELETE, settings GET/PATCH)
- `backend/app/services/__init__.py` — 빈 파일
- `backend/app/services/notification.py` — Expo Push 클라이언트 + 5개 시나리오 발송 함수 + 도메인 금지어 가드
- `backend/alembic/versions/<auto>_add_notification_tables.py` — 마이그레이션
- `backend/tests/__init__.py` — 빈 파일
- `backend/tests/conftest.py` — pytest 공통 설정
- `backend/tests/test_notification_messages.py` — 도메인 금지어 가드 단위 테스트
- `backend/tests/test_notification_scheduling.py` — 시간 윈도우·8주 경과 조건 단위 테스트
- `backend/pytest.ini` — pytest 설정

### Backend 수정
- `backend/app/scheduler.py` — 4개 cron job + Hygiene cron 추가
- `backend/app/routine_trigger.py` — `run_trigger()` 끝에 시나리오 3 발송 호출 추가
- `backend/app/main.py` — notifications 라우터 등록
- `backend/requirements.txt` — `httpx`, `pytest`, `pytest-asyncio` 추가

### Mobile 신규
- `mobile/src/types/notification.ts` — NotificationSettings, PushTokenRequest 타입
- `mobile/src/lib/notifications.ts` — 권한·토큰·채널 설정 헬퍼
- `mobile/src/hooks/usePushNotifications.ts` — 권한 + 등록 + 리스너 통합 훅
- `mobile/src/hooks/useNotificationDeepLink.ts` — payload → 화면 라우팅 훅
- `mobile/src/screens/my/NotificationSettingsScreen.tsx` — 설정 화면

### Mobile 수정
- `mobile/package.json` — `expo-notifications`, `expo-device` 추가
- `mobile/app.json` — plugins에 `expo-notifications`, iOS `UIBackgroundModes` 추가
- `mobile/App.tsx` — `usePushNotifications()` 호출
- `mobile/src/lib/api.ts` — `notifications` 클라이언트 메서드 추가
- `mobile/src/navigation/Navigation.tsx` — NotificationSettings 라우트 등록 + ref 노출
- `mobile/src/screens/main/MyPageScreen.tsx` — "알림 설정" 메뉴 항목 추가
- `mobile/src/screens/auth/LoginScreen.tsx` — 로그인 성공 시 토큰 등록 호출
- `mobile/src/screens/auth/SplashScreen.tsx` — 자동 로그인 시 토큰 등록 호출

---

## Task 1: Add Backend Dependencies

**Files:**
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Append dependencies to requirements.txt**

기존 파일 끝에 추가:

```
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.23.8
```

- [ ] **Step 2: Rebuild Docker container with new deps**

Run: `docker compose up -d --build api`
Expected: `bridge-api-1` 컨테이너가 새 이미지로 재시작, healthcheck `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "chore(backend): add httpx + pytest for notification feature"
```

---

## Task 2: Create Notification Models

**Files:**
- Create: `backend/app/models/notification.py`

- [ ] **Step 1: Write the model file**

```python
# backend/app/models/notification.py
import uuid
from datetime import datetime, time, UTC

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, Time
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class DeviceToken(Base):
    __tablename__ = "device_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    expo_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(10), nullable=False)
    device_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_used_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_device_tokens_user_active", "user_id", "is_active"),
    )


class NotificationSetting(Base, TimestampMixin):
    __tablename__ = "notification_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    push_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    routine_reminder_time: Mapped[time] = mapped_column(
        Time,
        nullable=False,
        default=time(9, 0),
    )


class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    notification_type: Mapped[str] = mapped_column(String(30), nullable=False)
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    body: Mapped[str] = mapped_column(String(500), nullable=False)
    data_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_notification_logs_user_type_sent", "user_id", "notification_type", "sent_at"),
    )
```

- [ ] **Step 2: Import models in `app/main.py` indirectly via Alembic env**

`backend/alembic/env.py`에 import 추가 필요 — 다음 task에서 처리.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/notification.py
git commit -m "feat(backend): add notification ORM models (device_tokens, settings, logs)"
```

---

## Task 3: Generate Alembic Migration

**Files:**
- Modify: `backend/alembic/env.py` (import notification models)
- Create: `backend/alembic/versions/<auto>_add_notification_tables.py`

- [ ] **Step 1: Add import to alembic env.py**

Read `backend/alembic/env.py` first. 모델 import 영역에서 기존 패턴을 따라 추가:

```python
from app.models import notification  # noqa: F401
```

- [ ] **Step 2: Generate migration via autogenerate**

Run: `docker compose exec api alembic revision --autogenerate -m "add notification tables"`
Expected: `backend/alembic/versions/<rev>_add_notification_tables.py` 생성

- [ ] **Step 3: Review generated migration**

생성된 파일 열어서 다음 확인:
- `device_tokens`, `notification_settings`, `notification_logs` 3개 테이블 모두 포함
- 인덱스 2개 (`ix_device_tokens_user_active`, `ix_notification_logs_user_type_sent`)
- `notification_settings`의 `routine_reminder_time` 기본값 `09:00:00`

`op.execute(...)`로 기존 사용자에게 `notification_settings` INSERT 추가 (upgrade 함수 끝에):

```python
op.execute(
    """
    INSERT INTO notification_settings (user_id, push_enabled, routine_reminder_time, created_at, updated_at)
    SELECT id, TRUE, '09:00:00', NOW(), NOW() FROM users
    ON CONFLICT (user_id) DO NOTHING
    """
)
```

- [ ] **Step 4: Apply migration**

Run: `docker compose exec api alembic upgrade head`
Expected: `INFO  [alembic.runtime.migration] Running upgrade ... -> <rev>, add notification tables`

- [ ] **Step 5: Verify schema in DB**

Run: `docker compose exec db psql -U bridge -d bridge -c "\dt notification*"`
Expected: 3개 테이블 (`notification_logs`, `notification_settings`, `device_tokens`) 표시

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/env.py backend/alembic/versions/
git commit -m "feat(backend): alembic migration for notification tables"
```

---

## Task 4: Create Notification Schemas

**Files:**
- Create: `backend/app/schemas/notification.py`

- [ ] **Step 1: Write the schema file**

```python
# backend/app/schemas/notification.py
from datetime import time
from typing import Literal

from pydantic import BaseModel, Field


class PushTokenRegisterRequest(BaseModel):
    expo_token: str = Field(..., min_length=20, max_length=255)
    platform: Literal["ios", "android"]
    device_name: str | None = Field(default=None, max_length=100)


class PushTokenRegisterData(BaseModel):
    registered: bool


class PushTokenDeleteRequest(BaseModel):
    expo_token: str = Field(..., min_length=20, max_length=255)


class PushTokenDeleteData(BaseModel):
    deactivated: bool


class NotificationSettingsData(BaseModel):
    push_enabled: bool
    routine_reminder_time: time


class NotificationSettingsUpdateRequest(BaseModel):
    push_enabled: bool | None = None
    routine_reminder_time: time | None = None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/schemas/notification.py
git commit -m "feat(backend): add notification Pydantic schemas"
```

---

## Task 5: Setup pytest Infrastructure

**Files:**
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write pytest.ini**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
python_files = test_*.py
python_classes = Test*
python_functions = test_*
```

- [ ] **Step 2: Create empty `backend/tests/__init__.py`**

빈 파일.

- [ ] **Step 3: Write conftest.py**

```python
# backend/tests/conftest.py
import sys
from pathlib import Path

# Make `app` package importable when running pytest from backend/
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
```

- [ ] **Step 4: Run pytest to verify setup**

Run: `docker compose exec api pytest -v`
Expected: `no tests ran in 0.0Xs` (정상 종료)

- [ ] **Step 5: Commit**

```bash
git add backend/pytest.ini backend/tests/__init__.py backend/tests/conftest.py
git commit -m "chore(backend): add pytest configuration for notification tests"
```

---

## Task 6: Notification Service — Constants and Domain Guard

**Files:**
- Create: `backend/app/services/__init__.py` (empty)
- Create: `backend/app/services/notification.py`
- Create: `backend/tests/test_notification_messages.py`

- [ ] **Step 1: Create empty `app/services/__init__.py`**

빈 파일.

- [ ] **Step 2: Write notification.py with constants and guard**

```python
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
```

- [ ] **Step 3: Write domain guard tests**

```python
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
        assert_domain_safe("PHQ-9 점수가 변했어요")


def test_clean_text_passes():
    assert_domain_safe("오늘 하루는 어땠나요") is None


def test_get_message_returns_routine_reminder():
    msg = get_message("routine_reminder")
    assert msg["title"] == "오늘의 루틴 시간이에요"
```

- [ ] **Step 4: Run tests**

Run: `docker compose exec api pytest tests/test_notification_messages.py -v`
Expected: 5개 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/ backend/tests/test_notification_messages.py
git commit -m "feat(backend): notification message constants + domain banned-words guard"
```

---

## Task 7: Notification Service — Expo Push Client

**Files:**
- Modify: `backend/app/services/notification.py` (append)

- [ ] **Step 1: Append Expo Push client to notification.py**

기존 파일 끝에 추가:

```python
import logging

import httpx
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import DeviceToken, NotificationLog

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_BATCH_SIZE = 100


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
                # 실패한 chunk는 빈 ticket 채워서 sync 유지
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
    data_payload = {"type": deep_link_type, **(extra_data or {})}

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

    for token, ticket in zip(tokens, tickets):
        ticket_status = ticket.get("status", "error")
        if ticket_status == "ok":
            await _record_log(db, user_id, notification_type, msg["title"], msg["body"], data_payload, "sent")
            await db.execute(
                update(DeviceToken)
                .where(DeviceToken.id == token.id)
                .values(last_used_at=__import__("datetime").datetime.now(__import__("datetime").UTC))
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
```

- [ ] **Step 2: Quick syntax check**

Run: `docker compose exec api python -c "from app.services.notification import send_notification, get_message; print('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/notification.py
git commit -m "feat(backend): Expo Push client with batch send and DeviceNotRegistered handling"
```

---

## Task 8: Notification API Endpoints

**Files:**
- Create: `backend/app/api/v1/notifications.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write notifications router**

```python
# backend/app/api/v1/notifications.py
from datetime import datetime, UTC

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.notification import DeviceToken, NotificationSetting
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.notification import (
    NotificationSettingsData,
    NotificationSettingsUpdateRequest,
    PushTokenDeleteData,
    PushTokenDeleteRequest,
    PushTokenRegisterData,
    PushTokenRegisterRequest,
)

router = APIRouter(prefix="/users/me", tags=["notifications"])


@router.post("/push-token", response_model=SuccessResponse[PushTokenRegisterData])
async def register_push_token(
    body: PushTokenRegisterRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        pg_insert(DeviceToken)
        .values(
            user_id=current_user.id,
            expo_token=body.expo_token,
            platform=body.platform,
            device_name=body.device_name,
            is_active=True,
            last_used_at=datetime.now(UTC),
        )
        .on_conflict_do_update(
            index_elements=["expo_token"],
            set_={
                "user_id": current_user.id,
                "platform": body.platform,
                "device_name": body.device_name,
                "is_active": True,
                "last_used_at": datetime.now(UTC),
            },
        )
    )
    await db.execute(stmt)
    await db.commit()
    return SuccessResponse(data=PushTokenRegisterData(registered=True))


@router.delete("/push-token", response_model=SuccessResponse[PushTokenDeleteData])
async def deactivate_push_token(
    body: PushTokenDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        update(DeviceToken)
        .where(
            DeviceToken.expo_token == body.expo_token,
            DeviceToken.user_id == current_user.id,
        )
        .values(is_active=False)
    )
    await db.commit()
    return SuccessResponse(data=PushTokenDeleteData(deactivated=result.rowcount > 0))


@router.get("/notification-settings", response_model=SuccessResponse[NotificationSettingsData])
async def get_notification_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.user_id == current_user.id)
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        # 마이그레이션 이후 가입자 대비 자동 생성
        setting = NotificationSetting(user_id=current_user.id)
        db.add(setting)
        await db.commit()
        await db.refresh(setting)

    return SuccessResponse(
        data=NotificationSettingsData(
            push_enabled=setting.push_enabled,
            routine_reminder_time=setting.routine_reminder_time,
        )
    )


@router.patch("/notification-settings", response_model=SuccessResponse[NotificationSettingsData])
async def update_notification_settings(
    body: NotificationSettingsUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(NotificationSetting).where(NotificationSetting.user_id == current_user.id)
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        setting = NotificationSetting(user_id=current_user.id)
        db.add(setting)

    if body.push_enabled is not None:
        setting.push_enabled = body.push_enabled
    if body.routine_reminder_time is not None:
        setting.routine_reminder_time = body.routine_reminder_time

    await db.commit()
    await db.refresh(setting)

    return SuccessResponse(
        data=NotificationSettingsData(
            push_enabled=setting.push_enabled,
            routine_reminder_time=setting.routine_reminder_time,
        )
    )
```

- [ ] **Step 2: Register router in main.py**

`backend/app/main.py` 상단 import 영역에 추가:

```python
from app.api.v1 import notifications as notifications_router
```

라우터 등록 영역에 추가 (다른 `app.include_router` 호출들과 같은 자리):

```python
app.include_router(notifications_router.router, prefix="/v1")
```

- [ ] **Step 3: Restart API container**

Run: `docker compose restart api`
Expected: 컨테이너 재시작, `/docs` 페이지에서 4개 신규 엔드포인트 확인 가능

- [ ] **Step 4: Manual smoke test**

테스트 사용자로 로그인 후 access_token 획득. 다음 curl 실행:

```bash
TOKEN=<access_token>
curl -X GET http://localhost:8000/v1/users/me/notification-settings \
  -H "Authorization: Bearer $TOKEN"
```

Expected: `{"success":true,"data":{"push_enabled":true,"routine_reminder_time":"09:00:00"}}`

```bash
curl -X POST http://localhost:8000/v1/users/me/push-token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"expo_token":"ExponentPushToken[test_dummy_token_12345]","platform":"ios","device_name":"Test"}'
```

Expected: `{"success":true,"data":{"registered":true}}`

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/notifications.py backend/app/main.py
git commit -m "feat(backend): notification API endpoints (token + settings)"
```

---

## Task 9: Scheduler — 시나리오 2 (일기 미작성)

**Files:**
- Modify: `backend/app/services/notification.py` (append send_diary_nudges)
- Modify: `backend/app/scheduler.py` (register job)

- [ ] **Step 1: Append send_diary_nudges to notification.py**

기존 파일 끝에 추가:

```python
from datetime import date as date_cls

from sqlalchemy import and_

from app.models.diary import DiaryEntry


async def send_diary_nudges() -> None:
    """매일 21:00 KST — 당일 일기 미작성자에게 알림."""
    today = date_cls.today()
    from app.core.database import AsyncSessionLocal
    from app.models.notification import NotificationSetting
    from app.models.user import User

    async with AsyncSessionLocal() as db:
        # push_enabled=TRUE 사용자 중 당일 diary_entries 없는 사용자
        result = await db.execute(
            select(User.id).join(NotificationSetting, NotificationSetting.user_id == User.id)
            .where(NotificationSetting.push_enabled == True)  # noqa: E712
        )
        candidate_user_ids = result.scalars().all()

        for user_id in candidate_user_ids:
            diary_check = await db.execute(
                select(DiaryEntry.id).where(
                    and_(DiaryEntry.user_id == user_id, DiaryEntry.recorded_date == today)
                ).limit(1)
            )
            if diary_check.scalar_one_or_none() is not None:
                continue  # 이미 작성됨 → skip

            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(DeviceToken.user_id == user_id, DeviceToken.is_active == True)  # noqa: E712
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
```

- [ ] **Step 2: Register cron job in scheduler.py**

`backend/app/scheduler.py` 끝에 추가 (기존 `weekly_mission_aggregate` 등록 후):

```python
from app.services.notification import send_diary_nudges

# 시나리오 2: 일기 미작성 — 매일 21:00 KST = UTC 12:00
scheduler.add_job(
    send_diary_nudges,
    CronTrigger(hour=12, minute=0, timezone="UTC"),
    id="diary_nudge",
    replace_existing=True,
)
```

- [ ] **Step 3: Restart API and verify scheduler loaded**

Run: `docker compose restart api && docker compose logs api --tail 30`
Expected: `Adding job tentatively -- it will be properly scheduled when the scheduler starts` 또는 `Scheduler started`

- [ ] **Step 4: Manual trigger test**

```bash
docker compose exec api python -c "
import asyncio
from app.services.notification import send_diary_nudges
asyncio.run(send_diary_nudges())
"
```
Expected: 에러 없이 종료. `notification_logs` 테이블에 발송 시도 기록 확인:
`docker compose exec db psql -U bridge -d bridge -c "SELECT user_id, notification_type, status FROM notification_logs ORDER BY sent_at DESC LIMIT 5"`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/notification.py backend/app/scheduler.py
git commit -m "feat(backend): scenario 2 - diary nudge cron at 21:00 KST"
```

---

## Task 10: Scheduler — 시나리오 1 (루틴 리마인더)

**Files:**
- Modify: `backend/app/services/notification.py` (append send_routine_reminders)
- Modify: `backend/app/scheduler.py` (register job)
- Create: `backend/tests/test_notification_scheduling.py` (시간 윈도우 단위 테스트)

- [ ] **Step 1: Append send_routine_reminders to notification.py**

```python
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

KST = ZoneInfo("Asia/Seoul")
ROUTINE_REMINDER_WINDOW_MINUTES = 2.5


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
    from app.core.database import AsyncSessionLocal
    from app.models.notification import NotificationSetting

    now_kst = datetime.now(KST)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(NotificationSetting).where(NotificationSetting.push_enabled == True)  # noqa: E712
        )
        settings = result.scalars().all()

        for setting in settings:
            if not is_within_reminder_window(setting.routine_reminder_time, now_kst):
                continue

            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(
                        DeviceToken.user_id == setting.user_id,
                        DeviceToken.is_active == True,  # noqa: E712
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
```

- [ ] **Step 2: Write unit test for time window**

```python
# backend/tests/test_notification_scheduling.py
from datetime import datetime, time
from zoneinfo import ZoneInfo

from app.services.notification import is_within_reminder_window

KST = ZoneInfo("Asia/Seoul")


def test_within_window_exact_match():
    now = datetime(2026, 5, 27, 9, 0, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is True


def test_within_window_plus_2_minutes():
    now = datetime(2026, 5, 27, 9, 2, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is True


def test_outside_window_5_minutes():
    now = datetime(2026, 5, 27, 9, 5, 0, tzinfo=KST)
    assert is_within_reminder_window(time(9, 0), now) is False


def test_midnight_boundary():
    now = datetime(2026, 5, 27, 23, 59, 0, tzinfo=KST)
    assert is_within_reminder_window(time(0, 0), now) is True
```

- [ ] **Step 3: Run tests**

Run: `docker compose exec api pytest tests/test_notification_scheduling.py -v`
Expected: 4개 테스트 PASS

- [ ] **Step 4: Register cron job in scheduler.py**

```python
from app.services.notification import send_routine_reminders

# 시나리오 1: 루틴 리마인더 — 매 5분
scheduler.add_job(
    send_routine_reminders,
    CronTrigger(minute="*/5", timezone="UTC"),
    id="routine_reminder",
    replace_existing=True,
)
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/notification.py backend/app/scheduler.py backend/tests/test_notification_scheduling.py
git commit -m "feat(backend): scenario 1 - routine reminder cron with 2.5min KST window"
```

---

## Task 11: Scheduler — 시나리오 4 (주간 미션) + 시나리오 5 (자가평가 8주)

**Files:**
- Modify: `backend/app/services/notification.py` (append 2 functions)
- Modify: `backend/app/scheduler.py` (register 2 jobs)
- Modify: `backend/tests/test_notification_scheduling.py` (append 8-week test)

- [ ] **Step 1: Append send_weekly_mission_notifications**

```python
from datetime import date as date_cls, timedelta

from app.models.mission import MissionPoint


async def send_weekly_mission_notifications() -> None:
    """월요일 09:00 KST — 직전 주 mission_points가 있는 사용자에게 발송."""
    from app.core.database import AsyncSessionLocal
    from app.models.notification import NotificationSetting

    today = date_cls.today()
    last_week_start = today - timedelta(days=today.weekday() + 7)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(MissionPoint.user_id)
            .join(NotificationSetting, NotificationSetting.user_id == MissionPoint.user_id)
            .where(
                and_(
                    MissionPoint.week_start == last_week_start,
                    NotificationSetting.push_enabled == True,  # noqa: E712
                )
            )
        )
        user_ids = result.scalars().all()

        for user_id in user_ids:
            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(DeviceToken.user_id == user_id, DeviceToken.is_active == True)  # noqa: E712
                )
            )
            tokens = token_result.scalars().all()
            await send_notification(
                db=db,
                user_id=user_id,
                tokens=list(tokens),
                notification_type="weekly_mission",
                deep_link_type="weekly_mission",
            )
```

- [ ] **Step 2: Append send_assessment_reminders**

```python
from app.models.assessment import Assessment


ASSESSMENT_REMINDER_DAYS = 56  # 8주
ASSESSMENT_DEDUPE_DAYS = 14  # 직전 14일 내 알림 발송 시 skip


def is_assessment_due(last_assessment_date: date_cls, today: date_cls) -> bool:
    """마지막 평가 후 8주(56일) 경과 여부."""
    return (today - last_assessment_date).days >= ASSESSMENT_REMINDER_DAYS


async def send_assessment_reminders() -> None:
    """매일 10:00 KST — 마지막 평가 후 8주 경과 + 직전 14일 알림 미발송자."""
    from app.core.database import AsyncSessionLocal
    from app.models.notification import NotificationLog, NotificationSetting
    from sqlalchemy import func

    today = date_cls.today()
    dedupe_cutoff = datetime.now(UTC) - timedelta(days=ASSESSMENT_DEDUPE_DAYS)

    async with AsyncSessionLocal() as db:
        # 각 사용자의 마지막 assessment 날짜
        subq = (
            select(
                Assessment.user_id,
                func.max(Assessment.created_at).label("last_at"),
            )
            .group_by(Assessment.user_id)
            .subquery()
        )

        result = await db.execute(
            select(subq.c.user_id, subq.c.last_at)
            .join(NotificationSetting, NotificationSetting.user_id == subq.c.user_id)
            .where(NotificationSetting.push_enabled == True)  # noqa: E712
        )
        rows = result.all()

        for user_id, last_at in rows:
            if not is_assessment_due(last_at.date(), today):
                continue

            # 직전 14일 dedupe
            dedupe_check = await db.execute(
                select(NotificationLog.id).where(
                    and_(
                        NotificationLog.user_id == user_id,
                        NotificationLog.notification_type == "assessment_reminder",
                        NotificationLog.sent_at >= dedupe_cutoff,
                        NotificationLog.status == "sent",
                    )
                ).limit(1)
            )
            if dedupe_check.scalar_one_or_none() is not None:
                continue

            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(DeviceToken.user_id == user_id, DeviceToken.is_active == True)  # noqa: E712
                )
            )
            tokens = token_result.scalars().all()
            await send_notification(
                db=db,
                user_id=user_id,
                tokens=list(tokens),
                notification_type="assessment_reminder",
                deep_link_type="assessment_reminder",
            )
```

추가 import 필요 (파일 상단에 없으면 추가):
```python
from datetime import UTC
```

- [ ] **Step 3: Add 8-week condition test**

`backend/tests/test_notification_scheduling.py`에 추가:

```python
from datetime import date

from app.services.notification import is_assessment_due


def test_assessment_due_exactly_8_weeks():
    last = date(2026, 4, 1)
    today = date(2026, 5, 27)  # 56 days later
    assert is_assessment_due(last, today) is True


def test_assessment_not_due_7_weeks():
    last = date(2026, 4, 8)
    today = date(2026, 5, 27)  # 49 days later
    assert is_assessment_due(last, today) is False


def test_assessment_due_overdue():
    last = date(2026, 1, 1)
    today = date(2026, 5, 27)
    assert is_assessment_due(last, today) is True
```

Run: `docker compose exec api pytest tests/test_notification_scheduling.py -v`
Expected: 7개 테스트 모두 PASS

- [ ] **Step 4: Register cron jobs in scheduler.py**

```python
from app.services.notification import (
    send_assessment_reminders,
    send_weekly_mission_notifications,
)

# 시나리오 4: 주간 미션 결과 — 월 09:00 KST = UTC 일 00:00
scheduler.add_job(
    send_weekly_mission_notifications,
    CronTrigger(day_of_week="sun", hour=0, minute=0, timezone="UTC"),
    id="weekly_mission_notification",
    replace_existing=True,
)

# 시나리오 5: 자가평가 — 매일 10:00 KST = UTC 01:00
scheduler.add_job(
    send_assessment_reminders,
    CronTrigger(hour=1, minute=0, timezone="UTC"),
    id="assessment_reminder",
    replace_existing=True,
)
```

- [ ] **Step 5: Restart and verify**

Run: `docker compose restart api && docker compose logs api --tail 20`
Expected: 4개 신규 job 모두 로드

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/notification.py backend/app/scheduler.py backend/tests/test_notification_scheduling.py
git commit -m "feat(backend): scenarios 4 + 5 - weekly mission + assessment reminders"
```

---

## Task 12: Scheduler — Hygiene Cleanup

**Files:**
- Modify: `backend/app/services/notification.py` (append cleanup_stale_tokens_and_logs)
- Modify: `backend/app/scheduler.py` (register job)

- [ ] **Step 1: Append cleanup function**

```python
async def cleanup_stale_tokens_and_logs() -> None:
    """매일 03:00 KST — 90일 미사용 device_tokens 비활성 + 90일 지난 notification_logs 삭제."""
    from app.core.database import AsyncSessionLocal
    from sqlalchemy import delete

    cutoff = datetime.now(UTC) - timedelta(days=90)

    async with AsyncSessionLocal() as db:
        await db.execute(
            update(DeviceToken)
            .where(
                and_(
                    DeviceToken.last_used_at < cutoff,
                    DeviceToken.is_active == True,  # noqa: E712
                )
            )
            .values(is_active=False)
        )
        await db.execute(delete(NotificationLog).where(NotificationLog.sent_at < cutoff))
        await db.commit()
```

- [ ] **Step 2: Register cron job**

```python
from app.services.notification import cleanup_stale_tokens_and_logs

# Hygiene: 매일 03:00 KST = UTC 18:00
scheduler.add_job(
    cleanup_stale_tokens_and_logs,
    CronTrigger(hour=18, minute=0, timezone="UTC"),
    id="notification_cleanup",
    replace_existing=True,
)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/notification.py backend/app/scheduler.py
git commit -m "feat(backend): hygiene cron for stale tokens and 90-day log cleanup"
```

---

## Task 13: routine_trigger.py — 시나리오 3 (트리거 즉시 발송)

**Files:**
- Modify: `backend/app/routine_trigger.py`

- [ ] **Step 1: Read current run_trigger function**

Read: `backend/app/routine_trigger.py` (전체)

- [ ] **Step 2: Add notification call after new UserRoutine INSERT**

`routine_trigger.py`에서 새 `UserRoutine`를 `db.add()`하고 `db.commit()`한 직후 (정확한 위치는 파일 읽고 결정):

```python
from app.models.notification import DeviceToken, NotificationSetting
from app.services.notification import send_notification
from sqlalchemy import and_

# (... 기존 새 UserRoutine 생성 후 commit 직후 ...)

setting_result = await db.execute(
    select(NotificationSetting).where(NotificationSetting.user_id == user_id)
)
setting = setting_result.scalar_one_or_none()
if setting and setting.push_enabled:
    token_result = await db.execute(
        select(DeviceToken).where(
            and_(DeviceToken.user_id == user_id, DeviceToken.is_active == True)  # noqa: E712
        )
    )
    tokens = token_result.scalars().all()
    await send_notification(
        db=db,
        user_id=user_id,
        tokens=list(tokens),
        notification_type="trigger",
        deep_link_type="trigger",
        extra_data={"routine_id": str(new_user_routine.routine_id)},
    )
```

- [ ] **Step 3: Manual verification — simulate trigger**

Bridge 메모리 라인 323-327 패턴 활용: 핸즈 사용자 + "외로운" 일기 3회 누적 → `run_trigger(uuid)` 호출 → `notification_logs` 테이블에 `notification_type='trigger'` 기록 확인

```bash
docker compose exec db psql -U bridge -d bridge -c "SELECT * FROM notification_logs WHERE notification_type='trigger' ORDER BY sent_at DESC LIMIT 3"
```
Expected: 발송 이력 1건 이상

- [ ] **Step 4: Commit**

```bash
git add backend/app/routine_trigger.py
git commit -m "feat(backend): scenario 3 - send trigger notification after new user_routine"
```

---

## Task 14: Mobile — Install Dependencies and Configure app.json

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`

- [ ] **Step 1: Install expo-notifications and expo-device**

Run: `cd mobile && npx expo install expo-notifications expo-device`
Expected: `package.json`에 `expo-notifications`, `expo-device` 추가

- [ ] **Step 2: Update app.json plugins**

기존 `mobile/app.json`을 다음과 같이 수정 (`plugins` 배열 확장 + iOS infoPlist + Android meta):

```json
{
  "expo": {
    "name": "Bridge",
    "slug": "bridge",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#FAF8FF"
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "app.bridge.mobile",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "android": {
      "package": "app.bridge.mobile",
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#FAF8FF"
      }
    },
    "plugins": [
      "expo-secure-store",
      "expo-font",
      [
        "expo-notifications",
        {
          "color": "#5B558E"
        }
      ]
    ]
  }
}
```

**메모**: `icon` 옵션은 `notification-icon.png` 자산 디자인 후 추가 (Section 15 미결정 사항, MVP에는 미포함). 색상은 Bridge 브랜드 primary.

- [ ] **Step 3: Verify install with tsc**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**

```bash
git add mobile/package.json mobile/package-lock.json mobile/app.json
git commit -m "chore(mobile): install expo-notifications + expo-device, configure plugin"
```

---

## Task 15: Mobile — Notification Types and API Client

**Files:**
- Create: `mobile/src/types/notification.ts`
- Modify: `mobile/src/lib/api.ts`

- [ ] **Step 1: Write types file**

```typescript
// mobile/src/types/notification.ts
export type NotificationType =
  | 'routine_reminder'
  | 'diary_nudge'
  | 'trigger'
  | 'weekly_mission'
  | 'assessment_reminder';

export interface NotificationPayload {
  type: NotificationType;
  routine_id?: string;
}

export interface PushTokenRegisterRequest {
  expo_token: string;
  platform: 'ios' | 'android';
  device_name?: string;
}

export interface NotificationSettings {
  push_enabled: boolean;
  routine_reminder_time: string; // "HH:MM:SS"
}

export interface NotificationSettingsUpdateRequest {
  push_enabled?: boolean;
  routine_reminder_time?: string;
}
```

- [ ] **Step 2: Add notifications client methods to api.ts**

`mobile/src/lib/api.ts` 끝(다른 도메인 객체들과 같은 자리)에 추가:

```typescript
import type {
  NotificationSettings,
  NotificationSettingsUpdateRequest,
  PushTokenRegisterRequest,
} from '@/types/notification';

export const notifications = {
  registerToken: async (body: PushTokenRegisterRequest) => {
    const { data } = await api.post<{ registered: boolean }>('/users/me/push-token', body);
    return data;
  },
  deactivateToken: async (expo_token: string) => {
    const { data } = await api.delete<{ deactivated: boolean }>('/users/me/push-token', {
      data: { expo_token },
    });
    return data;
  },
  getSettings: async () => {
    const { data } = await api.get<NotificationSettings>('/users/me/notification-settings');
    return data;
  },
  updateSettings: async (body: NotificationSettingsUpdateRequest) => {
    const { data } = await api.patch<NotificationSettings>('/users/me/notification-settings', body);
    return data;
  },
};
```

- [ ] **Step 3: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**

```bash
git add mobile/src/types/notification.ts mobile/src/lib/api.ts
git commit -m "feat(mobile): notification types + API client methods"
```

---

## Task 16: Mobile — Notifications Library Helper

**Files:**
- Create: `mobile/src/lib/notifications.ts`

- [ ] **Step 1: Write notifications.ts**

```typescript
// mobile/src/lib/notifications.ts
// Expo Push 토큰 발급·권한 요청·Android 채널 설정 헬퍼.
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// 포그라운드 알림 표시 동작
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bridge 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#5B558E',
  });
}

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function getPermissionStatus(): Promise<PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionStatus;
}

export async function requestPermission(): Promise<PermissionStatus> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export async function getExpoPushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // 시뮬레이터/에뮬레이터는 푸시 토큰 발급 안 됨
    return null;
  }
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[notifications] EAS projectId not configured. Skipping token fetch.');
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('[notifications] getExpoPushTokenAsync failed:', e);
    return null;
  }
}

export function getPlatform(): 'ios' | 'android' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}
```

- [ ] **Step 2: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add mobile/src/lib/notifications.ts
git commit -m "feat(mobile): notification helpers (permission, token, Android channel)"
```

---

## Task 17: Mobile — usePushNotifications Hook

**Files:**
- Create: `mobile/src/hooks/usePushNotifications.ts`

- [ ] **Step 1: Inspect auth store shape first**

Read: `mobile/src/store/auth.ts` — 인증 상태를 표현하는 정확한 필드 확인 (예: `accessToken`, `user`, `isAuthenticated` 중 무엇인지).

- [ ] **Step 2: Write hook (auth field 이름은 위에서 확인한 실제 store shape으로 교체)**

```typescript
// mobile/src/hooks/usePushNotifications.ts
// 로그인 직후 권한 요청 + 토큰 백엔드 등록 + 알림 응답 리스너 통합.
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/store/auth';
import {
  ensureAndroidChannel,
  getExpoPushToken,
  getPermissionStatus,
  getPlatform,
  requestPermission,
} from '@/lib/notifications';
import { notifications } from '@/lib/api';
import type { NotificationPayload } from '@/types/notification';

export function usePushNotifications(
  onNotificationResponse?: (payload: NotificationPayload) => void
) {
  // 실제 store 필드명에 맞춰 교체 (Step 1에서 확인한 값)
  const isAuthed = useAuth(s => Boolean(s.user));
  const lastTokenRef = useRef<string | null>(null);

  // 1. 권한 + 토큰 등록 (인증된 사용자만)
  useEffect(() => {
    if (!isAuthed) return;
    let cancelled = false;

    (async () => {
      await ensureAndroidChannel();

      let status = await getPermissionStatus();
      if (status === 'undetermined') {
        status = await requestPermission();
      }
      if (status !== 'granted' || cancelled) return;

      const token = await getExpoPushToken();
      if (!token || cancelled || token === lastTokenRef.current) return;

      try {
        await notifications.registerToken({
          expo_token: token,
          platform: getPlatform(),
        });
        lastTokenRef.current = token;
      } catch (e) {
        console.warn('[usePushNotifications] register failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthed]);

  // 2. 알림 응답 리스너 (탭 시)
  useEffect(() => {
    if (!onNotificationResponse) return;

    const responseSub = Notifications.addNotificationResponseReceivedListener(response => {
      const payload = response.notification.request.content.data as unknown as NotificationPayload;
      if (payload?.type) onNotificationResponse(payload);
    });

    // 앱 종료 상태에서 알림 탭으로 진입한 경우
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const payload = response.notification.request.content.data as unknown as NotificationPayload;
      if (payload?.type) onNotificationResponse(payload);
    });

    return () => responseSub.remove();
  }, [onNotificationResponse]);
}
```

- [ ] **Step 3: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**

```bash
git add mobile/src/hooks/usePushNotifications.ts
git commit -m "feat(mobile): usePushNotifications hook (permission, registration, listener)"
```

---

## Task 18: Mobile — Deep Link Handler Hook

**Files:**
- Create: `mobile/src/hooks/useNotificationDeepLink.ts`

- [ ] **Step 1: Write deep link handler**

```typescript
// mobile/src/hooks/useNotificationDeepLink.ts
// payload.type → React Navigation 화면 이동.
import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NotificationPayload } from '@/types/notification';
import type { RootStackParamList } from '@/navigation/Navigation';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useNotificationDeepLink() {
  const navigation = useNavigation<Nav>();

  return useCallback(
    (payload: NotificationPayload) => {
      switch (payload.type) {
        case 'routine_reminder':
        case 'trigger':
          // MainTabs → Routine 탭
          navigation.navigate('Main');
          // BottomTab 진입은 Main 진입 후 사용자가 처리 — MVP는 Main까지만 보장
          break;
        case 'diary_nudge':
          navigation.navigate('DiaryMood');
          break;
        case 'weekly_mission':
          navigation.navigate('Main');
          // Report 탭 진입은 Main 내부에서 처리
          break;
        case 'assessment_reminder':
          navigation.navigate('Assessment', undefined);
          break;
      }
    },
    [navigation]
  );
}
```

**메모**: BottomTab 정확한 진입은 navigation ref 통해 nested screen 호출 필요 — 후속 개선 항목. MVP는 Main까지만 보장.

- [ ] **Step 2: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add mobile/src/hooks/useNotificationDeepLink.ts
git commit -m "feat(mobile): notification deep link routing hook"
```

---

## Task 19: Mobile — Integrate Hooks in App.tsx and Navigation

**Files:**
- Modify: `mobile/App.tsx`
- Modify: `mobile/src/navigation/Navigation.tsx`

- [ ] **Step 1: Wrap navigation with notification handler**

`mobile/src/navigation/Navigation.tsx`에서 — 기존 컴포넌트 내부에 deep link + push notifications 통합:

```typescript
// 기존 import 영역에 추가
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationDeepLink } from '@/hooks/useNotificationDeepLink';

// Navigation 컴포넌트 내부, NavigationContainer 안쪽에 새 컴포넌트 추가 또는 Inner wrapper 생성
// 기존 NavigationContainer가 navigation context 제공하므로 그 안에서만 훅 사용 가능
function NotificationBridge() {
  const handleDeepLink = useNotificationDeepLink();
  usePushNotifications(handleDeepLink);
  return null;
}

// Navigation 컴포넌트 JSX에서 NavigationContainer 자식으로 추가:
// <NavigationContainer>
//   <NotificationBridge />
//   ... 기존 Stack/Tab ...
// </NavigationContainer>
```

- [ ] **Step 2: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 3: Commit**

```bash
git add mobile/src/navigation/Navigation.tsx
git commit -m "feat(mobile): integrate push notifications + deep link in Navigation"
```

---

## Task 20: Mobile — Logout Token Deactivation

**Files:**
- Modify: `mobile/src/store/auth.ts` (또는 logout 구현 파일)

- [ ] **Step 1: Locate logout function**

Read: `mobile/src/store/auth.ts` (Zustand auth store)

- [ ] **Step 2: Add token deactivation before clearing local state**

logout 함수 내부, `clearToken()` 호출 전에 추가:

```typescript
import { notifications } from '@/lib/api';
import { getExpoPushToken } from '@/lib/notifications';

// (... logout 함수 내부 ...)
try {
  const token = await getExpoPushToken();
  if (token) {
    await notifications.deactivateToken(token);
  }
} catch (e) {
  console.warn('[auth] failed to deactivate push token:', e);
  // logout 자체는 계속 진행
}
```

- [ ] **Step 3: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**

```bash
git add mobile/src/store/auth.ts
git commit -m "feat(mobile): deactivate push token on logout"
```

---

## Task 21: Mobile — NotificationSettingsScreen

**Files:**
- Create: `mobile/src/screens/my/NotificationSettingsScreen.tsx`
- Modify: `mobile/src/navigation/Navigation.tsx` (라우트 등록)

- [ ] **Step 1: Write settings screen**

```typescript
// mobile/src/screens/my/NotificationSettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import { Alert, Linking, StyleSheet, Switch, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import DateTimePicker from '@react-native-community/datetimepicker';
import TopBar from '@/components/TopBar';
import { palette } from '@/theme/tokens';
import { notifications } from '@/lib/api';
import { getPermissionStatus, requestPermission } from '@/lib/notifications';
import type { NotificationSettings } from '@/types/notification';

export default function NotificationSettingsScreen() {
  const qc = useQueryClient();
  const [permission, setPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [showPicker, setShowPicker] = useState(false);

  useEffect(() => {
    getPermissionStatus().then(setPermission);
  }, []);

  const { data: settings } = useQuery<NotificationSettings>({
    queryKey: ['notifications', 'settings'],
    queryFn: notifications.getSettings,
  });

  const updateMut = useMutation({
    mutationFn: notifications.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'settings'] }),
  });

  const onTogglePush = async (next: boolean) => {
    if (next && permission !== 'granted') {
      const status = await requestPermission();
      setPermission(status);
      if (status !== 'granted') {
        Alert.alert(
          '알림 권한이 필요해요',
          '설정 앱에서 알림을 허용해주세요',
          [
            { text: '취소', style: 'cancel' },
            { text: '설정 열기', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    updateMut.mutate({ push_enabled: next });
  };

  const onChangeTime = (_e: unknown, selected?: Date) => {
    setShowPicker(false);
    if (!selected) return;
    const hh = String(selected.getHours()).padStart(2, '0');
    const mm = String(selected.getMinutes()).padStart(2, '0');
    updateMut.mutate({ routine_reminder_time: `${hh}:${mm}:00` });
  };

  const reminderTimeDisplay = settings?.routine_reminder_time?.slice(0, 5) ?? '09:00';
  const pickerValue = (() => {
    const [hh, mm] = (settings?.routine_reminder_time ?? '09:00:00').split(':').map(Number);
    const d = new Date();
    d.setHours(hh, mm, 0, 0);
    return d;
  })();

  return (
    <View style={styles.container}>
      <TopBar title="알림 설정" />
      <View style={styles.body}>
        {permission === 'denied' && (
          <View style={styles.warnCard}>
            <Text style={styles.warnText}>
              알림 권한이 거부된 상태예요. 설정 앱에서 허용으로 변경해주세요.
            </Text>
            <Text style={styles.warnLink} onPress={() => Linking.openSettings()}>
              설정 열기
            </Text>
          </View>
        )}

        <View style={styles.row}>
          <Text style={styles.label}>푸시 알림 받기</Text>
          <Switch
            value={settings?.push_enabled ?? false}
            onValueChange={onTogglePush}
            disabled={updateMut.isPending}
          />
        </View>

        <View style={[styles.row, { opacity: settings?.push_enabled ? 1 : 0.4 }]}>
          <Text style={styles.label}>루틴 알림 시각</Text>
          <Text
            style={styles.timeValue}
            onPress={() => settings?.push_enabled && setShowPicker(true)}
          >
            {reminderTimeDisplay}
          </Text>
        </View>

        {showPicker && (
          <DateTimePicker
            value={pickerValue}
            mode="time"
            display="spinner"
            onChange={onChangeTime}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.bg },
  body: { padding: 16 },
  warnCard: {
    backgroundColor: '#FFEFE9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  warnText: { color: '#7A3A2B', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  warnLink: { color: palette.primary, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EFEDF7',
  },
  label: { fontSize: 16, color: palette.text },
  timeValue: { fontSize: 16, color: palette.primary, fontWeight: '600' },
});
```

**메모**: `@react-native-community/datetimepicker`가 의존성에 없을 수 있음. 다음 step에서 설치.

- [ ] **Step 2: Install datetimepicker if missing**

Run: `cd mobile && npx expo install @react-native-community/datetimepicker`
Expected: package.json에 의존성 추가

- [ ] **Step 3: Register route in Navigation.tsx**

`RootStackParamList`에 추가:
```typescript
NotificationSettings: undefined;
```

import 및 Stack.Screen 등록:
```typescript
import NotificationSettingsScreen from '@/screens/my/NotificationSettingsScreen';

// Stack.Navigator 내부에 추가:
<Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
```

- [ ] **Step 4: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 5: Commit**

```bash
git add mobile/src/screens/my/NotificationSettingsScreen.tsx mobile/src/navigation/Navigation.tsx mobile/package.json mobile/package-lock.json
git commit -m "feat(mobile): notification settings screen with toggle + time picker"
```

---

## Task 22: Mobile — MyPage Menu Entry

**Files:**
- Modify: `mobile/src/screens/main/MyPageScreen.tsx`

- [ ] **Step 1: Locate MyPageScreen settings group**

Read: `mobile/src/screens/main/MyPageScreen.tsx` — "알림", "설정" 영역 위치 파악

- [ ] **Step 2: Add "알림 설정" menu item**

기존 메뉴 항목들 사이에 추가. 메모리에 따르면 ICON_PROPS 패턴 + 13개 메뉴가 있음. "알림" 키워드 근처에 추가 (또는 적절한 위치):

```typescript
// 기존 import에 추가
import { Bell } from 'phosphor-react-native';

// JSX 메뉴 영역에 추가
<MenuRow
  icon={<Bell {...ICON_PROPS} />}
  label="알림 설정"
  onPress={() => navigation.navigate('NotificationSettings')}
/>
```

정확한 코드 형태는 기존 `MenuRow` 컴포넌트 props에 맞춰 조정.

- [ ] **Step 3: Tsc check**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 0

- [ ] **Step 4: Commit**

```bash
git add mobile/src/screens/main/MyPageScreen.tsx
git commit -m "feat(mobile): add notification settings entry to MyPage"
```

---

## Task 23: Backend Integration Smoke Test

**Files:** None (manual verification)

- [ ] **Step 1: Start fresh Docker environment**

Run: `docker compose down && docker compose up -d --build`
Expected: 3개 컨테이너 (`api`, `db`, `redis`) 정상 시작

- [ ] **Step 2: Verify scheduler jobs loaded**

Run: `docker compose logs api | grep "scheduler\|Adding job"`
Expected: 6개 job 로드 — `weekly_mission_aggregate` (기존) + `routine_reminder`, `diary_nudge`, `weekly_mission_notification`, `assessment_reminder`, `notification_cleanup` (신규 5개)

- [ ] **Step 3: Manual API smoke (4 endpoints)**

테스트 사용자 access_token으로:

```bash
# GET settings
curl -X GET http://localhost:8000/v1/users/me/notification-settings -H "Authorization: Bearer $TOKEN"
# → push_enabled:true, routine_reminder_time:"09:00:00"

# PATCH settings
curl -X PATCH http://localhost:8000/v1/users/me/notification-settings \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"routine_reminder_time":"08:30:00"}'
# → push_enabled:true, routine_reminder_time:"08:30:00"

# POST token
curl -X POST http://localhost:8000/v1/users/me/push-token \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"expo_token":"ExponentPushToken[test_dummy_xxxxxxxxxxxxxxxxxxxxxx]","platform":"ios"}'
# → registered:true

# DELETE token
curl -X DELETE http://localhost:8000/v1/users/me/push-token \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"expo_token":"ExponentPushToken[test_dummy_xxxxxxxxxxxxxxxxxxxxxx]"}'
# → deactivated:true
```

- [ ] **Step 4: Run full pytest**

Run: `docker compose exec api pytest -v`
Expected: 모든 단위 테스트 PASS (최소 9개)

- [ ] **Step 5: No commit (verification step)**

---

## Task 24: Mobile QA — Manual Verification

**Files:** None (manual verification with iOS Simulator)

- [ ] **Step 1: Start Metro and iOS Simulator**

Run: `cd mobile && npx expo start --clear --ios`
Expected: 시뮬레이터에서 앱 빌드 후 실행

- [ ] **Step 2: Login flow + Token registration check**

- 신규/기존 사용자로 로그인
- 알림 권한 다이얼로그 1회 노출 (최초 로그인 시) → "허용"
- 백엔드에서 토큰 등록 확인:
  ```bash
  docker compose exec db psql -U bridge -d bridge \
    -c "SELECT user_id, platform, is_active, created_at FROM device_tokens ORDER BY created_at DESC LIMIT 3"
  ```

**참고**: iOS Simulator는 실제 Expo 토큰 발급 안 됨 — `Device.isDevice=false`로 분기되어 토큰 fetch skip. 실제 토큰 검증은 EAS Development Build 필요 (Phase 9와 함께 진행 또는 별도 EAS 셋업).

- [ ] **Step 3: NotificationSettings screen 검증**

- MyPage → "알림 설정" 진입
- 토글 OFF → PATCH 호출 확인 (네트워크 탭 또는 `notification_settings` 테이블에서 `push_enabled=false`)
- 시각 변경 → PATCH 호출 확인
- 권한 거부 상태 시 경고 카드 + "설정 열기" 버튼 노출

- [ ] **Step 4: Expo Push Tool로 시나리오별 발송 시뮬레이션**

EAS Build 없는 MVP 단계에서는 Expo Push Tool (https://expo.dev/notifications)을 사용해서 수동 발송 가능. 단 실제 디바이스(혹은 EAS Build)에서만 토큰 발급되므로 이 단계는 **EAS 셋업 이후로 보류**.

대신 모바일 코드 동작 검증은 다음으로 대체:
- 시뮬레이터 콘솔에서 `[notifications] EAS projectId not configured. Skipping token fetch.` 로그 확인
- `lastTokenRef` 미설정으로 인한 무한 등록 시도 없음 확인

- [ ] **Step 5: Logout flow 검증**

- 로그아웃 → `device_tokens.is_active=false` 확인 (단, EAS 토큰 발급 안 되면 skip)
- 시뮬레이터 환경에서는 토큰 자체가 없으므로 logout 정상 진행만 확인 (warn 로그 OK)

- [ ] **Step 6: No commit (verification step)**

---

## Task 25: Update Documentation and Memory

**Files:**
- Modify: `docs/.pdca-status.json` (Phase 10 진행 상태)
- Create: `docs/04-report/Phase10-푸시알림-구현.md` (간단 리포트)

- [ ] **Step 1: Write Phase 10 implementation report**

```markdown
# Phase 10 — 모바일 푸시 알림 구현 리포트

**완료일**: <오늘 날짜>
**구현 범위**: 5개 시나리오 (루틴/일기/트리거/미션/자가평가) + Expo Push Service + APScheduler 통합

## 신규 자산
- 백엔드: 3개 테이블, 4개 API 엔드포인트, 5개 cron job, Expo Push 클라이언트
- 모바일: notifications 라이브러리, usePushNotifications/useNotificationDeepLink 훅, NotificationSettingsScreen

## 미완 / 보류
- EAS Development Build 셋업 — 실제 디바이스 토큰 발급 검증 필요 (Phase 9 배포와 묶어서 진행 권장)
- 알림 아이콘 자산 디자인
- BottomTab 정확한 진입 (현재 Main까지만 보장, 후속 ref 기반 nested navigation 필요)

## 후속 확장 후보 (스펙 섹션 13)
1. 루틴별 개별 시간 (`user_routines.reminder_time`)
2. 카테고리별 ON/OFF 토글
3. 방해금지 시간대
4. 알림 통계 대시보드
```

- [ ] **Step 2: Commit**

```bash
git add docs/04-report/Phase10-푸시알림-구현.md docs/.pdca-status.json
git commit -m "docs(phase-10): push notification implementation report"
```

---

## Final Verification

- [ ] **All commits pushed**: `git log --oneline origin/main..HEAD` shows ~21 commits
- [ ] **Tests pass**: `docker compose exec api pytest -v` → all PASS
- [ ] **Mobile tsc clean**: `cd mobile && npx tsc --noEmit` → 0 errors
- [ ] **Schedule jobs loaded**: `docker compose logs api | grep "Adding job"` → 6 jobs
- [ ] **All 5 scenarios reachable**: 코드 grep으로 5개 `notification_type` 모두 사용 확인
  ```bash
  grep -r "notification_type=" backend/app/ | grep -v test
  # 5개 모두 (routine_reminder, diary_nudge, trigger, weekly_mission, assessment_reminder)
  ```
- [ ] **MyPage 진입점 확인**: 시뮬레이터에서 "알림 설정" 메뉴 노출 + 진입 정상
- [ ] **EAS 셋업 후 토큰 발급 재검증** (별도 세션) — Phase 9 배포 또는 EAS Build 셋업 시점

---

## 후속 작업 (이 Plan 완료 후)

1. **EAS 프로젝트 셋업**: `eas init` + `eas build:configure` → `projectId` 발급 → app.json에 반영
2. **EAS Development Build**: 실제 디바이스에서 푸시 토큰 발급 + 발송 검증
3. **알림 아이콘 자산**: `notification-icon.png` (96x96 흑백 단색, Android용) → `app.json` `expo-notifications` plugin `icon` 옵션 추가
4. **BottomTab nested deep link**: NavigationRef + nested navigate 구현
5. **Phase 11 후속 확장**: 스펙 섹션 13 항목들 (루틴별 개별 시간 등)
