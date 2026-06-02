import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
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
    if log_result.scalar_one_or_none():
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
            completed=body.completed,
            logged_at=now.isoformat(),
        ),
        "message": "ok",
    }


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
