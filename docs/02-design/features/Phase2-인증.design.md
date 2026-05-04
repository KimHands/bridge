# [Design] Phase 2 — Auth Service (인증 서비스)

> 작성일: 2026-04-13
> Phase: 2 / 8
> 상태: Design
> 참조: `docs/01-plan/features/Phase2-인증.plan.md`

---

## 1. 디렉토리 구조 (추가분)

```
backend/app/
├── schemas/
│   ├── __init__.py
│   └── auth.py            # 요청/응답 Pydantic 모델
├── core/
│   ├── config.py          # (기존) jwt_secret_key 등 이미 정의됨
│   ├── database.py        # (기존)
│   ├── security.py        # 신규: bcrypt, JWT, email_hash 유틸
│   └── redis.py           # 신규: Redis 클라이언트 + 세션/블랙리스트 헬퍼
├── api/
│   └── v1/
│       ├── __init__.py
│       └── auth.py        # 신규: 4개 엔드포인트 라우터
├── dependencies/
│   ├── __init__.py
│   └── auth.py            # 신규: get_current_user 의존성
└── main.py                # (수정) /v1/auth 라우터 등록
```

---

## 2. Pydantic 스키마 설계 (`app/schemas/auth.py`)

```python
from pydantic import BaseModel, EmailStr, field_validator
import re

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


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    user_id: str
    nickname: str
    access_token: str
    refresh_token: str
    requires_assessment: bool


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str


# 공통 응답 래퍼
class SuccessResponse(BaseModel):
    success: bool = True
    data: dict | None = None
    message: str = "ok"


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    error: ErrorDetail
```

---

## 3. 보안 유틸 설계 (`app/core/security.py`)

```python
import hashlib
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_email(email: str) -> str:
    """이메일을 SHA-256으로 해시하여 반환 (소문자 정규화 후)"""
    return hashlib.sha256(email.lower().encode()).hexdigest()


def hash_password(plain: str) -> str:
    """bcrypt(cost=12)로 비밀번호 해시"""
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """bcrypt 검증"""
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    """Access Token 생성 (TTL: 1시간)"""
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Refresh Token 생성 (TTL: 14일). (token, jti) 반환"""
    import uuid
    jti = str(uuid.uuid4())
    expire = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)
    payload = {"sub": user_id, "exp": expire, "jti": jti, "type": "refresh"}
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti


def decode_token(token: str) -> dict:
    """JWT 디코딩. 실패 시 JWTError 발생"""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
```

---

## 4. Redis 클라이언트 설계 (`app/core/redis.py`)

```python
from datetime import timedelta

import redis.asyncio as aioredis

from app.core.config import settings

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


# 세션 키: session:{user_id}
# 블랙리스트 키: blacklist:{jti}

async def set_refresh_session(user_id: str, refresh_token: str) -> None:
    r = await get_redis()
    ttl = timedelta(days=settings.refresh_token_expire_days)
    await r.setex(f"session:{user_id}", int(ttl.total_seconds()), refresh_token)


async def delete_refresh_session(user_id: str) -> None:
    r = await get_redis()
    await r.delete(f"session:{user_id}")


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    """토큰 jti를 블랙리스트에 등록 (TTL = 토큰 잔여 만료 시간)"""
    r = await get_redis()
    await r.setex(f"blacklist:{jti}", ttl_seconds, "1")


async def is_blacklisted(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"blacklist:{jti}") == 1
```

---

## 5. 인증 엔드포인트 설계 (`app/api/v1/auth.py`)

### 5.1 라우터 구조

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest, LogoutRequest,
    TokenResponse, RefreshResponse
)

router = APIRouter(prefix="/auth", tags=["auth"])
```

### 5.2 회원가입 (POST /auth/register)

```
1. RegisterRequest 유효성 검사 (Pydantic 자동)
2. hash_email(email) → email_hash 생성
3. DB 조회: email_hash 중복 확인
   → 존재 시 409 EMAIL_ALREADY_EXISTS
4. hash_password(password) → password_hash
5. User 객체 생성 후 DB 저장 (commit)
6. create_access_token(user_id) + create_refresh_token(user_id)
7. set_refresh_session(user_id, refresh_token) → Redis 세션 저장
8. 201 + TokenResponse(requires_assessment=True)
```

### 5.3 로그인 (POST /auth/login)

```
1. LoginRequest 유효성 검사
2. hash_email(email) → email_hash
3. DB 조회: email_hash로 User 조회
   → 없으면 401 USER_NOT_FOUND
4. verify_password(password, user.password_hash)
   → 실패 시 401 INVALID_CREDENTIALS
5. create_access_token + create_refresh_token
6. set_refresh_session → Redis 세션 갱신
7. requires_assessment: assessments 테이블에 해당 user_id 존재 여부 확인
8. 200 + TokenResponse
```

### 5.4 토큰 갱신 (POST /auth/refresh)

```
1. decode_token(refresh_token)
   → JWTError 시 401 INVALID_REFRESH_TOKEN
2. payload["type"] == "refresh" 확인
3. is_blacklisted(jti) 확인
   → True 시 401 INVALID_REFRESH_TOKEN
4. create_access_token(user_id) + create_refresh_token(user_id) (새 jti)
5. blacklist_token(이전 jti, 잔여 TTL) → 이전 Refresh Token 무효화
6. set_refresh_session(user_id, 새 refresh_token)
7. 200 + RefreshResponse
```

### 5.5 로그아웃 (POST /auth/logout)

```
1. get_current_user(Authorization 헤더) → 유효한 사용자 확인
2. decode_token(refresh_token) → jti 추출
3. blacklist_token(jti, 잔여 TTL)
4. delete_refresh_session(user_id)
5. 200 + {"success": true, "data": null, "message": "로그아웃 완료"}
```

---

## 6. 인증 미들웨어 설계 (`app/dependencies/auth.py`)

```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.redis import is_blacklisted
from app.core.security import decode_token
from app.core.database import get_db
from app.models.user import User

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        payload = decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "유효하지 않은 토큰"})

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "Access Token이 아닙니다"})

    jti = payload.get("jti")
    if jti and await is_blacklisted(jti):
        raise HTTPException(status_code=401, detail={"code": "TOKEN_BLACKLISTED", "message": "블랙리스트에 등록된 토큰"})

    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail={"code": "INVALID_TOKEN", "message": "사용자를 찾을 수 없습니다"})

    return user
```

---

## 7. main.py 수정 내용

```python
# 추가할 내용
from app.api.v1 import auth as auth_router

app.include_router(auth_router.router, prefix="/v1")
```

최종 라우트: `POST /v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`

---

## 8. 에러 코드 일람

| HTTP | 에러 코드 | 발생 위치 |
|------|----------|---------|
| 409 | `EMAIL_ALREADY_EXISTS` | register: 이메일 중복 |
| 422 | `INVALID_PASSWORD_FORMAT` | register: Pydantic 유효성 실패 |
| 422 | `MISSING_REQUIRED_FIELD` | register/login: 필드 누락 |
| 401 | `USER_NOT_FOUND` | login: 이메일 없음 |
| 401 | `INVALID_CREDENTIALS` | login: 비밀번호 불일치 |
| 401 | `INVALID_REFRESH_TOKEN` | refresh: 만료·블랙리스트·서명 오류 |
| 401 | `INVALID_TOKEN` | 미들웨어: Access Token 오류 |
| 401 | `TOKEN_BLACKLISTED` | 미들웨어: 블랙리스트 토큰 |

---

## 9. 구현 순서 (체크리스트)

```
[ ] 1. app/schemas/__init__.py, app/schemas/auth.py
[ ] 2. app/core/security.py
[ ] 3. app/core/redis.py
[ ] 4. app/dependencies/__init__.py, app/dependencies/auth.py
[ ] 5. app/api/__init__.py, app/api/v1/__init__.py, app/api/v1/auth.py
[ ] 6. app/main.py — 라우터 등록
[ ] 7. Docker 재빌드 (requirements.txt 변경 없으므로 불필요)
[ ] 8. Swagger UI 테스트 (localhost:8000/docs)
```

---

## 10. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | 정상 회원가입 | 201, access_token + refresh_token 반환 |
| 2 | 동일 이메일 재가입 | 409 EMAIL_ALREADY_EXISTS |
| 3 | 비밀번호 7자리 | 422 INVALID_PASSWORD_FORMAT |
| 4 | 정상 로그인 | 200, 토큰 반환 |
| 5 | 틀린 비밀번호 | 401 INVALID_CREDENTIALS |
| 6 | 없는 이메일 | 401 USER_NOT_FOUND |
| 7 | 정상 토큰 갱신 | 200, 새 토큰 쌍 반환 |
| 8 | 로그아웃 후 Refresh Token 재사용 | 401 INVALID_REFRESH_TOKEN |
| 9 | 로그아웃 후 Access Token으로 보호 API 접근 | 401 TOKEN_BLACKLISTED |
| 10 | 만료된 Access Token | 401 INVALID_TOKEN |
