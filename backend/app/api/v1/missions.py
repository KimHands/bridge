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

router = APIRouter(prefix="/missions", tags=["missions"])

# 3일 기준 역산: round(3/7*70)=30, round(3/7*30)=13
_ACHIEVE_ROUTINE_MIN = 30
_ACHIEVE_DIARY_MIN = 13


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

    weekly_score = round(routine_days / 7 * 70) + round(diary_days / 7 * 30)
    is_achieved = routine_days >= 3 and diary_days >= 3

    mp_rows = await db.execute(
        select(MissionPoint.total_score).where(
            MissionPoint.user_id == current_user.id,
            MissionPoint.routine_score >= _ACHIEVE_ROUTINE_MIN,
            MissionPoint.diary_score >= _ACHIEVE_DIARY_MIN,
        )
    )
    historical_total = sum(mp_rows.scalars().all())
    total_score = historical_total + (weekly_score if is_achieved else 0)

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

    total_score = 0
    weekly_history: list[WeeklyHistoryItem] = []

    for mp in all_points:
        is_achieved = mp.routine_score >= _ACHIEVE_ROUTINE_MIN and mp.diary_score >= _ACHIEVE_DIARY_MIN
        if is_achieved:
            total_score += mp.total_score
        weekly_history.append(
            WeeklyHistoryItem(
                week_year=_iso_week_year(mp.week_start),
                weekly_score=mp.total_score,
                is_achieved=is_achieved,
            )
        )

    return SuccessResponse(
        data=TotalMissionData(
            total_score=total_score,
            weekly_history=weekly_history,
        )
    )
