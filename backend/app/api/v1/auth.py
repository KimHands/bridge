from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import (
    blacklist_token,
    del_pending_verify,
    delete_refresh_session,
    get_pending_verify,
    get_redis,
    get_refresh_session,
    incr_verify_attempts,
    is_blacklisted,
    reset_verify_attempts,
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
from app.services.anon_rate_limiter import check_anon_creation
from app.services.email_sender import get_email_sender

router = APIRouter(prefix="/auth", tags=["auth"])

# 이메일 인증 대기 TTL과 코드 시도 상한(브루트포스 방어). 임상 근거 없는 운영값.
VERIFY_TTL_SECONDS = 600
VERIFY_MAX_ATTEMPTS = 5


def _client_ip(request: Request) -> str:
    """레이트리밋 키로 쓸 출처 IP. 프록시 뒤라면 X-Forwarded-For 첫 홉을 쓴다.
    (ALB 배포 시 신뢰 홉 고정 하드닝은 후속 과제 — anon_rate_limiter 주석 참조.)"""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


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
async def anonymous(
    body: AnonymousRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    dsh = hash_device_secret(body.device_secret)

    result = await db.execute(select(User).where(User.device_secret_hash == dsh))
    user = result.scalar_one_or_none()
    if user is None:
        # 신규 계정 생성만 IP 기준 레이트리밋(재인증은 대상 아님)
        r = await get_redis()
        if not await check_anon_creation(r, _client_ip(request)):
            raise HTTPException(
                status_code=429,
                detail={"code": "TOO_MANY_REQUESTS", "message": "잠시 후 다시 시도해주세요"},
            )
        user = User(
            nickname=body.nickname or "익명",
            is_anonymous=True,
            device_secret_hash=dsh,
        )
        db.add(user)
        try:
            await db.commit()
            await db.refresh(user)
        except IntegrityError:
            # 동시 요청이 같은 device_secret으로 먼저 생성한 경우(UNIQUE 충돌) →
            # 재조회해 그 사용자로 재인증 처리(get-or-create의 경쟁 흡수, TOCTOU 해소).
            await db.rollback()
            result = await db.execute(
                select(User).where(User.device_secret_hash == dsh)
            )
            user = result.scalar_one()

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
    """익명 계정 승격을 시작한다. 이메일 인증 전에는 User를 바꾸지 않고(미검증
    이메일 선점 방지) 이메일·비밀번호 해시·코드를 Redis pending에만 보관한다.
    실제 email_hash/password_hash/is_anonymous 확정은 /verify-email에서 이뤄진다.
    같은 user.id를 유지하므로 FK로 연결된 기존 데이터(일기 등)는 그대로 보존된다."""
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

    code = generate_verification_code()
    await set_pending_verify(
        str(current_user.id),
        body.email,
        code,
        hash_password(body.password),
        ttl=VERIFY_TTL_SECONDS,
    )
    await reset_verify_attempts(str(current_user.id))
    await get_email_sender().send_code(body.email, code)

    return {"success": True, "data": {"email_verified": False}, "message": "인증 코드를 보냈어요"}


@router.post("/verify-email", response_model=SuccessResponse[dict])
async def verify_email(
    body: VerifyEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attempts = await incr_verify_attempts(str(current_user.id), ttl=VERIFY_TTL_SECONDS)
    if attempts > VERIFY_MAX_ATTEMPTS:
        await del_pending_verify(str(current_user.id))
        raise HTTPException(
            status_code=429,
            detail={
                "code": "TOO_MANY_ATTEMPTS",
                "message": "시도가 너무 많아요. 코드를 다시 요청해 주세요",
            },
        )

    pending = await get_pending_verify(str(current_user.id))
    if not pending or pending["code"] != body.code:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_CODE", "message": "코드가 올바르지 않거나 만료됐어요"},
        )

    # 코드 일치 — 확정 직전에 이메일 유니크를 다시 검사한다(pending 윈도 동안 다른
    # 사용자가 같은 이메일을 먼저 인증했을 수 있음). 이 시점의 email_hash가 권위 있는 검사.
    email_hash = hash_email(pending["email"])
    taken = await db.execute(
        select(User).where(User.email_hash == email_hash, User.id != current_user.id)
    )
    if taken.scalar_one_or_none():
        await del_pending_verify(str(current_user.id))
        await reset_verify_attempts(str(current_user.id))
        raise HTTPException(
            status_code=409,
            detail={"code": "EMAIL_ALREADY_EXISTS", "message": "이미 사용 중인 이메일이에요"},
        )

    current_user.email_hash = email_hash
    current_user.password_hash = pending["password_hash"]
    current_user.is_anonymous = False
    current_user.email_verified = True
    await db.commit()
    await del_pending_verify(str(current_user.id))
    await reset_verify_attempts(str(current_user.id))

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
    await set_pending_verify(
        str(current_user.id),
        pending["email"],
        code,
        pending["password_hash"],
        ttl=VERIFY_TTL_SECONDS,
    )
    await reset_verify_attempts(str(current_user.id))
    await get_email_sender().send_code(pending["email"], code)

    return {"success": True, "data": {"email_verified": False}, "message": "인증 코드를 다시 보냈어요"}
