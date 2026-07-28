import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.redis import get_redis
from app.dependencies.auth import get_current_user
from app.models.assessment import Assessment
from app.models.routine import Routine, RoutineLog, UserRoutine
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.routine import (
    RoutineAddRequest,
    RoutineAddResponse,
    RoutineCompleteRequest,
    RoutineCompleteResponse,
    RoutineItem,
    RoutineLibraryItem,
    RoutineLibraryResponse,
    RoutineListResponse,
    RoutineOut,
    RoutineRequestResponse,
)
from app.services.request_rate_limiter import check_and_count
from app.services.routine_selector import select_on_demand_routine
from app.services.trigger_metrics import (
    REQUEST_ABUSE,
    REQUEST_COOLDOWN,
    REQUEST_ESCALATION_OFFERED,
    REQUEST_FIRED,
    REQUEST_NO_ROUTINE,
    record_trigger_decision,
)

router = APIRouter(prefix="/routines", tags=["routines"])


# /me 경로를 /{user_routine_id} 보다 먼저 정의
@router.get("/me", response_model=SuccessResponse[RoutineListResponse])
async def list_my_routines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ur_result = await db.execute(
        select(UserRoutine, Routine)
        .join(Routine, Routine.id == UserRoutine.routine_id)
        .where(UserRoutine.user_id == current_user.id, UserRoutine.is_active == True)
        .order_by(UserRoutine.assigned_at.asc())
    )
    rows = ur_result.all()

    today = date.today()
    # N+1 제거: 활성 루틴들의 오늘 완료 로그를 한 번에 조회.
    ur_ids = [ur.id for ur, _ in rows]
    completed_ids: set = set()
    if ur_ids:
        log_rows = await db.execute(
            select(RoutineLog.user_routine_id).where(
                RoutineLog.user_routine_id.in_(ur_ids),
                RoutineLog.completed_date == today,
            )
        )
        completed_ids = set(log_rows.scalars().all())

    routines = []
    for ur, routine in rows:
        is_completed_today = ur.id in completed_ids

        routines.append(RoutineItem(
            user_routine_id=str(ur.id),
            routine_id=routine.id,
            title=routine.title,
            description=routine.description,
            source=ur.source,
            is_completed_today=is_completed_today,
            assigned_at=ur.assigned_at.isoformat(),
        ))

    return {
        "success": True,
        "data": RoutineListResponse(routines=routines),
        "message": "ok",
    }


@router.get("/library", response_model=SuccessResponse[RoutineLibraryResponse])
async def list_routine_library(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 같은 title이 phq_tier 별로 시드된 경우 중복 노출 방지.
    # user_tier에 적합한 항목 1개만 선택, 적합한 게 없으면 가장 낮은 ID(첫 번째) 유지.
    asmt_result = await db.execute(
        select(Assessment.phq_tier)
        .where(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    user_tier = asmt_result.scalar_one_or_none()

    routines_result = await db.execute(
        select(Routine).order_by(Routine.id.asc())
    )
    all_routines = list(routines_result.scalars().all())

    def fits_user(r: Routine) -> bool:
        return user_tier is not None and r.phq_tier_min <= user_tier <= r.phq_tier_max

    by_title: dict[str, Routine] = {}
    for r in all_routines:
        existing = by_title.get(r.title)
        if existing is None or (fits_user(r) and not fits_user(existing)):
            by_title[r.title] = r
    deduped = sorted(by_title.values(), key=lambda r: r.id)

    added_result = await db.execute(
        select(UserRoutine.routine_id).where(
            UserRoutine.user_id == current_user.id,
            UserRoutine.is_active == True,
        )
    )
    added_ids = set(added_result.scalars().all())

    items = [
        RoutineLibraryItem(
            routine_id=routine.id,
            title=routine.title,
            description=routine.description,
            target_keywords=routine.target_keywords or [],
            is_already_added=routine.id in added_ids,
        )
        for routine in deduped
    ]

    return {
        "success": True,
        "data": RoutineLibraryResponse(routines=items),
        "message": "ok",
    }


@router.post("/me", status_code=201, response_model=SuccessResponse[RoutineAddResponse])
async def add_routine(
    body: RoutineAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    routine_result = await db.execute(
        select(Routine).where(Routine.id == body.routine_id)
    )
    routine = routine_result.scalar_one_or_none()
    if not routine:
        raise HTTPException(
            status_code=404,
            detail={"code": "ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )

    existing_result = await db.execute(
        select(UserRoutine).where(
            UserRoutine.user_id == current_user.id,
            UserRoutine.routine_id == body.routine_id,
            UserRoutine.is_active == True,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "ROUTINE_ALREADY_ASSIGNED", "message": "이미 추가된 루틴입니다"},
        )

    now = datetime.now(timezone.utc)
    ur = UserRoutine(
        user_id=current_user.id,
        routine_id=routine.id,
        source="manual",
        is_active=True,
        assigned_at=now,
    )
    db.add(ur)
    await db.commit()
    await db.refresh(ur)

    return {
        "success": True,
        "data": RoutineAddResponse(
            user_routine_id=str(ur.id),
            routine_id=routine.id,
            title=routine.title,
            source=ur.source,
            assigned_at=ur.assigned_at.isoformat(),
        ),
        "message": "ok",
    }


@router.patch("/{user_routine_id}/complete", response_model=SuccessResponse[RoutineCompleteResponse])
async def complete_routine(
    user_routine_id: str,
    body: RoutineCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ur_result = await db.execute(
        select(UserRoutine).where(UserRoutine.id == uuid.UUID(user_routine_id))
    )
    ur = ur_result.scalar_one_or_none()
    if not ur:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )
    if ur.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 루틴만 수정할 수 있습니다"},
        )

    today = date.today()
    now = datetime.now(timezone.utc)

    log_result = await db.execute(
        select(RoutineLog).where(
            RoutineLog.user_routine_id == ur.id,
            RoutineLog.completed_date == today,
        )
    )
    existing = log_result.scalar_one_or_none()

    # completed=false → 완료 취소(오늘 로그 삭제, 멱등). 미션·리포트 집계에서 제외된다.
    if not body.completed:
        if existing:
            await db.delete(existing)
            await db.commit()
        return {
            "success": True,
            "data": RoutineCompleteResponse(
                user_routine_id=str(ur.id),
                completed=False,
                logged_at=now.isoformat(),
            ),
            "message": "ok",
        }

    # completed=true → 완료 처리(하루 1회, 유니크 제약).
    if existing:
        raise HTTPException(
            status_code=409,
            detail={"code": "ROUTINE_ALREADY_COMPLETED_TODAY", "message": "오늘 이미 완료 처리된 루틴입니다"},
        )

    db.add(RoutineLog(
        user_routine_id=ur.id,
        completed_date=today,
        created_at=now,
    ))
    try:
        await db.commit()
    except IntegrityError:
        # 동시 더블탭 race — 위 SELECT를 둘 다 통과해도 유니크 제약이 막는다.
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail={"code": "ROUTINE_ALREADY_COMPLETED_TODAY", "message": "오늘 이미 완료 처리된 루틴입니다"},
        )

    return {
        "success": True,
        "data": RoutineCompleteResponse(
            user_routine_id=str(ur.id),
            completed=True,
            logged_at=now.isoformat(),
        ),
        "message": "ok",
    }


# 사용자 요청 경로 노출 문구 — 금지어(치료/진단/개선/효과 등) 가드 테스트 대상.
_MSG_REQUEST_COOLDOWN = "방금 대처 루틴을 받으셨어요. 잠시 후 다시 찾아주세요."
_MSG_REQUEST_NO_ROUTINE = "잠시 호흡을 고르며 쉬어가도 괜찮아요."
_MSG_REQUEST_ASSIGNED = "이 작은 루틴 하나로 시작해볼까요?"


async def _latest_tier(db: AsyncSession, user_id) -> int:
    result = await db.execute(
        select(Assessment.phq_tier)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    tier = result.scalar_one_or_none()
    return tier if tier is not None else 2


async def _active_routine_ids(db: AsyncSession, user_id) -> set:
    result = await db.execute(
        select(UserRoutine.routine_id).where(
            UserRoutine.user_id == user_id,
            UserRoutine.is_active == True,
        )
    )
    return set(result.scalars().all())


def _envelope(*, assigned: Routine | None, state: str, offer_connection: bool, nudge: bool, message: str) -> dict:
    routine_out = None
    if assigned is not None:
        routine_out = RoutineOut(
            routine_id=assigned.id,
            title=assigned.title,
            description=assigned.description,
        )
    return {
        "success": True,
        "data": RoutineRequestResponse(
            assigned=routine_out,
            state=state,
            offer_connection=offer_connection,
            nudge=nudge,
        ),
        "message": message,
    }


@router.post("/request", status_code=201, response_model=SuccessResponse[RoutineRequestResponse])
async def request_routine(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """사용자 요청형(on-demand) 가벼운 대처 루틴 배정.

    위기 분기는 여기서 다루지 않는다 — 모바일 2단계 시트에서 사용자가
    "지금 많이 힘들어요"를 고르면 SupportConnect로 이동하고 이 엔드포인트는
    호출되지 않는다. 이 경로는 게이트(G1~G5)·주간상한 미적용, Redis 레이트리밋만 적용.
    """
    r = await get_redis()
    state = await check_and_count(r, str(current_user.id))

    if state.reason == "abuse":
        await record_trigger_decision(REQUEST_ABUSE)
        raise HTTPException(
            status_code=429,
            detail={"code": "TOO_MANY_REQUESTS", "message": "잠시 후 다시 시도해주세요"},
        )

    if not state.allowed_new:  # cooldown
        await record_trigger_decision(REQUEST_COOLDOWN)
        return _envelope(
            assigned=None,
            state="cooldown",
            offer_connection=state.offer_connection,
            nudge=state.nudge,
            message=_MSG_REQUEST_COOLDOWN,
        )

    tier = await _latest_tier(db, current_user.id)
    active_ids = await _active_routine_ids(db, current_user.id)
    routine = await select_on_demand_routine(db, current_user.id, tier, active_ids)

    if routine is None:
        await record_trigger_decision(REQUEST_NO_ROUTINE)
        return _envelope(
            assigned=None,
            state="no_routine",
            offer_connection=state.offer_connection,
            nudge=state.nudge,
            message=_MSG_REQUEST_NO_ROUTINE,
        )

    now = datetime.now(timezone.utc)
    db.add(UserRoutine(
        user_id=current_user.id,
        routine_id=routine.id,
        source="request",
        is_active=True,
        assigned_at=now,
    ))
    await db.commit()

    await record_trigger_decision(
        REQUEST_ESCALATION_OFFERED if state.offer_connection else REQUEST_FIRED
    )
    return _envelope(
        assigned=routine,
        state="assigned",
        offer_connection=state.offer_connection,
        nudge=state.nudge,
        message=_MSG_REQUEST_ASSIGNED,
    )


@router.delete("/{user_routine_id}", response_model=SuccessResponse[None])
async def delete_routine(
    user_routine_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ur_result = await db.execute(
        select(UserRoutine).where(UserRoutine.id == uuid.UUID(user_routine_id))
    )
    ur = ur_result.scalar_one_or_none()
    if not ur:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )
    if ur.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 루틴만 삭제할 수 있습니다"},
        )

    ur.is_active = False
    await db.commit()

    return {
        "success": True,
        "data": None,
        "message": "루틴이 삭제되었습니다.",
    }
