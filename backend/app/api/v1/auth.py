from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import (
    blacklist_token,
    del_pending_verify,
    delete_refresh_session,
    get_pending_verify,
    get_refresh_session,
    is_blacklisted,
    set_pending_verify,
    set_refresh_session,
)
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_verification_code,
    hash_device_secret,
    hash_email,
    hash_password,
    verify_password,
)
from app.dependencies.auth import bearer_scheme, get_current_user
from app.models.assessment import Assessment
from app.models.user import User
from app.schemas.auth import (
    AnonymousRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RefreshResponse,
    RegisterRequest,
    SuccessResponse,
    TokenResponse,
    UpgradeRequest,
    VerifyEmailRequest,
)
from app.services.email_sender import get_email_sender

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=201, response_model=SuccessResponse[TokenResponse])
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    email_hash = hash_email(body.email)

    result = await db.execute(select(User).where(User.email_hash == email_hash))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 가입된 이메일입니다"},
        )

    user = User(
        email_hash=email_hash,
        password_hash=hash_password(body.password),
        nickname=body.nickname,
        is_anonymous=False,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token, _ = create_access_token(str(user.id))
    refresh_token, _ = create_refresh_token(str(user.id))
    await set_refresh_session(str(user.id), refresh_token)

    return {
        "success": True,
        "data": TokenResponse(
            user_id=str(user.id),
            nickname=user.nickname,
            access_token=access_token,
            refresh_token=refresh_token,
            requires_assessment=True,
        ),
        "message": "ok",
    }


@router.post("/anonymous", status_code=201, response_model=SuccessResponse[TokenResponse])
async def anonymous(body: AnonymousRequest, db: AsyncSession = Depends(get_db)):
    dsh = hash_device_secret(body.device_secret)

    result = await db.execute(select(User).where(User.device_secret_hash == dsh))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            nickname=body.nickname or "익명",
            is_anonymous=True,
            device_secret_hash=dsh,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    result = await db.execute(select(Assessment).where(Assessment.user_id == user.id).limit(1))
    requires_assessment = result.scalars().first() is None

    access_token, _ = create_access_token(str(user.id))
    refresh_token, _ = create_refresh_token(str(user.id))
    await set_refresh_session(str(user.id), refresh_token)

    return {
        "success": True,
        "data": TokenResponse(
            user_id=str(user.id),
            nickname=user.nickname,
            access_token=access_token,
            refresh_token=refresh_token,
            requires_assessment=requires_assessment,
        ),
        "message": "ok",
    }


@router.post("/login", response_model=SuccessResponse[TokenResponse])
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    email_hash = hash_email(body.email)

    result = await db.execute(select(User).where(User.email_hash == email_hash))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=401,
            detail={"code": "USER_NOT_FOUND", "message": "가입되지 않은 이메일입니다"},
        )

    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_CREDENTIALS", "message": "이메일 또는 비밀번호가 올바르지 않습니다"},
        )

    result = await db.execute(select(Assessment).where(Assessment.user_id == user.id).limit(1))
    requires_assessment = result.scalars().first() is None

    access_token, _ = create_access_token(str(user.id))
    refresh_token, _ = create_refresh_token(str(user.id))
    await set_refresh_session(str(user.id), refresh_token)

    return {
        "success": True,
        "data": TokenResponse(
            user_id=str(user.id),
            nickname=user.nickname,
            access_token=access_token,
            refresh_token=refresh_token,
            requires_assessment=requires_assessment,
        ),
        "message": "ok",
    }


@router.post("/refresh", response_model=SuccessResponse[RefreshResponse])
async def refresh(body: RefreshRequest):
    try:
        payload = decode_token(body.refresh_token)
    except JWTError:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "유효하지 않은 Refresh Token입니다"},
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "Refresh Token이 아닙니다"},
        )

    old_jti = payload.get("jti")
    if old_jti and await is_blacklisted(old_jti):
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "이미 무효화된 Refresh Token입니다"},
        )

    user_id = payload["sub"]

    # Redis 저장 세션과 대조 — 회전된(폐기된) Refresh Token 재사용 차단
    stored_token = await get_refresh_session(user_id)
    if stored_token != body.refresh_token:
        raise HTTPException(
            status_code=401,
            detail={"code": "INVALID_REFRESH_TOKEN", "message": "유효하지 않은 Refresh Token입니다"},
        )

    exp = payload["exp"]
    remaining_ttl = max(0, exp - int(datetime.now(timezone.utc).timestamp()))

    new_access_token, _ = create_access_token(user_id)
    new_refresh_token, _ = create_refresh_token(user_id)

    if old_jti:
        await blacklist_token(old_jti, remaining_ttl)
    await set_refresh_session(user_id, new_refresh_token)

    return {
        "success": True,
        "data": RefreshResponse(
            access_token=new_access_token,
            refresh_token=new_refresh_token,
        ),
        "message": "ok",
    }


@router.get("/me", response_model=SuccessResponse[dict])
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Assessment).where(Assessment.user_id == current_user.id).limit(1)
    )
    has_assessment = result.scalar_one_or_none() is not None
    return {
        "success": True,
        "data": {
            "user_id": str(current_user.id),
            "nickname": current_user.nickname,
            "email": "",
            "requires_assessment": not has_assessment,
        },
        "message": "ok",
    }


@router.post("/logout")
async def logout(
    body: LogoutRequest,
    current_user: User = Depends(get_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
):
    now_ts = int(datetime.now(timezone.utc).timestamp())

    # 현재 Access Token 무효화 — jti 블랙리스트 (만료까지 남은 TTL 동안)
    try:
        access_payload = decode_token(credentials.credentials)
        access_jti = access_payload.get("jti")
        access_ttl = max(0, access_payload.get("exp", 0) - now_ts)
        if access_jti:
            await blacklist_token(access_jti, access_ttl)
    except JWTError:
        pass

    # Refresh Token 무효화 — jti 블랙리스트
    try:
        payload = decode_token(body.refresh_token)
        jti = payload.get("jti")
        remaining_ttl = max(0, payload.get("exp", 0) - now_ts)
        if jti:
            await blacklist_token(jti, remaining_ttl)
    except JWTError:
        pass

    try:
        await delete_refresh_session(str(current_user.id))
    except Exception:
        pass

    return {"success": True, "data": None, "message": "로그아웃 완료"}


@router.post("/upgrade", response_model=SuccessResponse[dict])
async def upgrade(
    body: UpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """익명 계정을 이메일·비밀번호 계정으로 승격한다. 같은 user.id를 그대로
    사용해 FK로 연결된 기존 데이터(일기 등)를 보존한다."""
    if current_user.email_hash is not None:
        raise HTTPException(
            status_code=409,
            detail={"code": "ALREADY_UPGRADED", "message": "이미 계정이 연결돼 있어요"},
        )

    email_hash = hash_email(body.email)
    result = await db.execute(select(User).where(User.email_hash == email_hash))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 사용 중인 이메일이에요"},
        )

    current_user.email_hash = email_hash
    current_user.password_hash = hash_password(body.password)
    current_user.is_anonymous = False
    await db.commit()

    code = generate_verification_code()
    await set_pending_verify(str(current_user.id), body.email, code, ttl=600)
    await get_email_sender().send_code(body.email, code)

    return {"success": True, "data": {"email_verified": False}, "message": "인증 코드를 보냈어요"}


@router.post("/verify-email", response_model=SuccessResponse[dict])
async def verify_email(
    body: VerifyEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pending = await get_pending_verify(str(current_user.id))
    if not pending or pending["code"] != body.code:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_CODE", "message": "코드가 올바르지 않거나 만료됐어요"},
        )

    current_user.email_verified = True
    await db.commit()
    await del_pending_verify(str(current_user.id))

    return {"success": True, "data": {"email_verified": True}, "message": "확인됐어요"}


@router.post("/resend-verification", response_model=SuccessResponse[dict])
async def resend_verification(current_user: User = Depends(get_current_user)):
    pending = await get_pending_verify(str(current_user.id))
    if not pending:
        raise HTTPException(
            status_code=400,
            detail={"code": "NO_PENDING_VERIFICATION", "message": "진행 중인 인증 요청이 없어요"},
        )

    code = generate_verification_code()
    await set_pending_verify(str(current_user.id), pending["email"], code, ttl=600)
    await get_email_sender().send_code(pending["email"], code)

    return {"success": True, "data": {"email_verified": False}, "message": "인증 코드를 다시 보냈어요"}
