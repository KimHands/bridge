from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import is_blacklisted
from app.core.security import decode_token
from app.models.user import User

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials

    try:
        payload = decode_token(token)
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "유효하지 않은 토큰입니다"},
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "Access Token이 아닙니다"},
        )

    jti = payload.get("jti")
    if jti and await is_blacklisted(jti):
        raise HTTPException(
            status_code=401,
            detail={"code": "TOKEN_BLACKLISTED", "message": "이미 무효화된 토큰입니다"},
        )

    user_id = payload.get("sub")
    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_TOKEN", "message": "사용자를 찾을 수 없습니다"},
        )

    return user
