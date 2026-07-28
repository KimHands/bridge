from typing import Any, Generic, TypeVar

from pydantic import BaseModel, EmailStr, field_validator

T = TypeVar("T")


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    nickname: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다")
        return v

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("닉네임은 필수 입력값입니다")
        return v.strip()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AnonymousRequest(BaseModel):
    device_secret: str
    nickname: str | None = None


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UpgradeRequest(BaseModel):
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("비밀번호는 8자 이상이어야 합니다")
        return v


class VerifyEmailRequest(BaseModel):
    code: str


class TokenResponse(BaseModel):
    user_id: str
    nickname: str
    access_token: str
    refresh_token: str
    requires_assessment: bool


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str


class ErrorDetail(BaseModel):
    code: str
    message: str


class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str = "ok"


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
