from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import (
    blacklist_token,
    delete_chat_session,
    delete_refresh_session,
)
from app.core.security import decode_token, verify_password
from app.dependencies.auth import bearer_scheme, get_current_user
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.user import DeleteAccountData, DeleteAccountRequest

router = APIRouter(prefix="/users/me", tags=["users"])


@router.delete("", response_model=SuccessResponse[DeleteAccountData])
async def delete_account(
    body: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    """회원 탈퇴 — 비밀번호 재확인 후 모든 개인정보를 즉시 영구 파기한다.

    개인정보처리방침 7조('탈퇴 후 7일 이내 파기') 이행. 즉시 파기이므로 7일 이내에 포함된다.
    user 행 삭제 시 DB의 ON DELETE CASCADE로 일기·자가평가·루틴·미션·알림·챗봇 메모리가
    연쇄 삭제되며, Redis의 리프레시 세션과 챗봇 대화 세션은 명시적으로 삭제한다.
    """
    # 1) 비밀번호 재확인 — 오삭제·탈취 토큰 악용 방지
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "비밀번호가 올바르지 않습니다"},
        )

    user_id = str(current_user.id)

    # 2) 현재 Access Token 즉시 무효화 — jti 블랙리스트(만료까지 남은 TTL 동안)
    try:
        payload = decode_token(credentials.credentials)
        jti = payload.get("jti")
        ttl = max(0, payload.get("exp", 0) - int(datetime.now(timezone.utc).timestamp()))
        if jti:
            await blacklist_token(jti, ttl)
    except JWTError:
        pass

    # 3) Redis 잔존 데이터 파기 — 리프레시 세션 + 챗봇 대화 세션(평문 사각지대)
    try:
        await delete_refresh_session(user_id)
        await delete_chat_session(user_id)
    except Exception:
        pass

    # 4) DB 사용자 삭제 — CASCADE로 전 민감데이터 영구 파기
    await db.execute(delete(User).where(User.id == current_user.id))
    await db.commit()

    return SuccessResponse(data=DeleteAccountData(deleted=True), message="회원 탈퇴가 완료되었습니다")
