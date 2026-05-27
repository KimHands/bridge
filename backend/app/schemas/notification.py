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
