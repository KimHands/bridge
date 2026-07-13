from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.diary import DiaryEntry
from app.models.mission import MissionPoint
from app.models.routine import RoutineLog, UserRoutine
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.mission import TotalMissionData, WeeklyHistoryItem, WeeklyMissionData
from app.services.mission_scoring import (  # noqa: F401 (compute_weekly_score re-exported)
    compute_weekly_score,
    is_week_achieved,
    sum_awarded,
)

router = APIRouter(prefix="/missions", tags=["missions"])


def _iso_week_year(d: date) -> str:
    iso = d.isocalendar()
    return f"{iso[0]}-W{iso[1]:02d}"


@router.get("/weekly", response_model=SuccessResponse[WeeklyMissionData])
async def get_weekly_mission(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    rl_rows = await db.execute(
        select(RoutineLog.completed_date)
        .join(UserRoutine, RoutineLog.user_routine_id == UserRoutine.id)
        .where(
            UserRoutine.user_id == current_user.id,
            RoutineLog.completed_date >= week_start,
            RoutineLog.completed_date <= week_end,
        )
        .distinct()
    )
    routine_days = len(rl_rows.scalars().all())

    de_rows = await db.execute(
        select(DiaryEntry.recorded_date).where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date >= week_start,
            DiaryEntry.recorded_date <= week_end,
        )
    )
    diary_days = len(de_rows.scalars().all())

    weekly_score, is_achieved = compute_weekly_score(routine_days, diary_days)

    # 저장값이 이미 게이트되어(미달 구성요소=0) 재게이트 없이 전체 합산한다.
    # (구 AND 게이트는 한쪽만 달성한 주를 통째로 누락시켜 누적 총점이 감소했다 — H1)
    mp_rows = await db.execute(
        select(MissionPoint.total_score).where(
            MissionPoint.user_id == current_user.id,
        )
    )
    historical_total = sum(mp_rows.scalars().all())
    total_score = historical_total + weekly_score

    return SuccessResponse(
        data=WeeklyMissionData(
            week_year=_iso_week_year(week_start),
            routine_days=routine_days,
            diary_days=diary_days,
            weekly_score=weekly_score,
            total_score=total_score,
            is_achieved=is_achieved,
        )
    )


@router.get("/total", response_model=SuccessResponse[TotalMissionData])
async def get_total_mission(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    mp_rows = await db.execute(
        select(MissionPoint)
        .where(MissionPoint.user_id == current_user.id)
        .order_by(MissionPoint.week_start.asc())
    )
    all_points = mp_rows.scalars().all()

    total_score = sum_awarded(all_points)
    weekly_history: list[WeeklyHistoryItem] = [
        WeeklyHistoryItem(
            week_year=_iso_week_year(mp.week_start),
            weekly_score=mp.total_score,
            is_achieved=is_week_achieved(mp.routine_score, mp.diary_score),
        )
        for mp in all_points
    ]

    return SuccessResponse(
        data=TotalMissionData(
            total_score=total_score,
            weekly_history=weekly_history,
        )
    )
