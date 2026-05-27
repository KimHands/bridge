# backend/app/api/v1/notifications.py
from datetime import datetime, UTC

from fastapi import APIRouter, Depends
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
    now_utc = datetime.now(UTC)
    stmt = (
        pg_insert(DeviceToken)
        .values(
            user_id=current_user.id,
            expo_token=body.expo_token,
            platform=body.platform,
            device_name=body.device_name,
            is_active=True,
            last_used_at=now_utc,
        )
        .on_conflict_do_update(
            index_elements=["expo_token"],
            set_={
                "user_id": current_user.id,
                "platform": body.platform,
                "device_name": body.device_name,
                "is_active": True,
                "last_used_at": now_utc,
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
