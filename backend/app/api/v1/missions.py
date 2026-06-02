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


def compute_weekly_score(routine_days: int, diary_days: int) -> tuple[int, bool]:
    """구성요소별 3일 게이트: 루틴 3일+이면 루틴점수(70%분), 일기 3일+이면 일기점수(30%분)을 각각 적립.

    한쪽만 달성해도 그 구성요소는 보상한다. 양쪽 미달이면 0(차감 없음).
    """
    routine_component = round(routine_days / 7 * 70) if routine_days >= 3 else 0
    diary_component = round(diary_days / 7 * 30) if diary_days >= 3 else 0
    weekly_score = routine_component + diary_component
    is_achieved = routine_days >= 3 or diary_days >= 3
    return weekly_score, is_achieved


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

    mp_rows = await db.execute(
        select(MissionPoint.total_score).where(
            MissionPoint.user_id == current_user.id,
            MissionPoint.routine_score >= _ACHIEVE_ROUTINE_MIN,
            MissionPoint.diary_score >= _ACHIEVE_DIARY_MIN,
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
