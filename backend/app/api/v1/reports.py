from calendar import monthrange
from collections import Counter
from datetime import date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword, SituationKeyword
from app.models.routine import RoutineLog, UserRoutine
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.report import MoodPoint, MoodTrendData, MonthlyReportData, WeeklyReportData

router = APIRouter(prefix="/reports", tags=["reports"])


def _week_bounds(ref: date) -> tuple[date, date]:
    """주어진 날짜가 속한 주의 월요일~일요일 반환."""
    week_start = ref - timedelta(days=ref.weekday())
    week_end = week_start + timedelta(days=6)
    return week_start, week_end


async def _routine_completion_rate(
    db: AsyncSession,
    user_id,
    start: date,
    end: date,
    total_days: int,
) -> float:
    """기간 내 루틴 완료 일수 / total_days * 100."""
    rows = await db.execute(
        select(RoutineLog.completed_date)
        .join(UserRoutine, RoutineLog.user_routine_id == UserRoutine.id)
        .where(
            UserRoutine.user_id == user_id,
            RoutineLog.completed_date >= start,
            RoutineLog.completed_date <= end,
        )
        .distinct()
    )
    completed_days = len(rows.scalars().all())
    return round(completed_days / total_days * 100, 1)


@router.get("/weekly", response_model=SuccessResponse[WeeklyReportData])
async def get_weekly_report(
    date_param: Optional[date] = Query(default=None, alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ref = date_param or date.today()
    week_start, week_end = _week_bounds(ref)

    # 일기 조회
    diary_rows = await db.execute(
        select(DiaryEntry)
        .where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date >= week_start,
            DiaryEntry.recorded_date <= week_end,
        )
        .order_by(DiaryEntry.recorded_date)
    )
    diaries = diary_rows.scalars().all()
    diary_ids = [d.id for d in diaries]

    # mood_scores 7개 슬롯 (미기록 None)
    mood_scores: list[Optional[int]] = [None] * 7
    for entry in diaries:
        idx = (entry.recorded_date - week_start).days
        mood_scores[idx] = entry.mood_score

    recorded_scores = [s for s in mood_scores if s is not None]
    mood_average = round(sum(recorded_scores) / len(recorded_scores), 1) if recorded_scores else None

    # 감정 키워드 TOP 3
    top_emotion: list[str] = []
    if diary_ids:
        ek_rows = await db.execute(
            select(EmotionKeyword.name)
            .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
            .where(DiaryEmotionKeyword.diary_id.in_(diary_ids))
        )
        keyword_names = ek_rows.scalars().all()
        top_emotion = [kw for kw, _ in Counter(keyword_names).most_common(3)]

    # 상황 키워드 TOP 3
    top_situation: list[str] = []
    if diary_ids:
        sk_rows = await db.execute(
            select(SituationKeyword.answer_text).where(SituationKeyword.diary_id.in_(diary_ids))
        )
        answers = sk_rows.scalars().all()
        top_situation = [ans for ans, _ in Counter(answers).most_common(3)]

    # 루틴 달성률
    rate = await _routine_completion_rate(db, current_user.id, week_start, week_end, 7)

    return SuccessResponse(
        data=WeeklyReportData(
            week_start=week_start,
            week_end=week_end,
            routine_completion_rate=rate,
            mood_average=mood_average,
            mood_scores=mood_scores,
            top_emotion_keywords=top_emotion,
            top_situation_keywords=top_situation,
            diary_count=len(diaries),
        )
    )


@router.get("/monthly", response_model=SuccessResponse[MonthlyReportData])
async def get_monthly_report(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    year = year or today.year
    month = month or today.month

    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_YEAR_MONTH", "message": "month는 1~12 사이여야 합니다."},
        )

    _, last_day = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    # 일기 조회
    diary_rows = await db.execute(
        select(DiaryEntry)
        .where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date >= month_start,
            DiaryEntry.recorded_date <= month_end,
        )
        .order_by(DiaryEntry.recorded_date)
    )
    diaries = diary_rows.scalars().all()
    diary_ids = [d.id for d in diaries]

    mood_trend = [MoodPoint(date=d.recorded_date, mood_score=d.mood_score) for d in diaries]
    scores = [d.mood_score for d in diaries]
    mood_average = round(sum(scores) / len(scores), 1) if scores else None

    # 감정 키워드 분포
    emotion_dist: dict[str, int] = {}
    if diary_ids:
        ek_rows = await db.execute(
            select(EmotionKeyword.name)
            .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
            .where(DiaryEmotionKeyword.diary_id.in_(diary_ids))
        )
        for name in ek_rows.scalars().all():
            emotion_dist[name] = emotion_dist.get(name, 0) + 1

    rate = await _routine_completion_rate(db, current_user.id, month_start, month_end, last_day)

    return SuccessResponse(
        data=MonthlyReportData(
            year=year,
            month=month,
            routine_completion_rate=rate,
            mood_average=mood_average,
            mood_trend=mood_trend,
            emotion_keyword_distribution=emotion_dist,
            diary_count=len(diaries),
        )
    )


@router.get("/mood-trend", response_model=SuccessResponse[MoodTrendData])
async def get_mood_trend(
    from_date: date = Query(alias="from"),
    to_date: date = Query(alias="to"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if from_date > to_date:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_DATE_RANGE", "message": "from은 to보다 이전이어야 합니다."},
        )
    if (to_date - from_date).days > 90:
        raise HTTPException(
            status_code=400,
            detail={"code": "DATE_RANGE_TOO_LARGE", "message": "최대 90일 범위까지 조회 가능합니다."},
        )

    rows = await db.execute(
        select(DiaryEntry)
        .where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date >= from_date,
            DiaryEntry.recorded_date <= to_date,
        )
        .order_by(DiaryEntry.recorded_date)
    )
    diaries = rows.scalars().all()
    trend = [MoodPoint(date=d.recorded_date, mood_score=d.mood_score) for d in diaries]

    return SuccessResponse(data=MoodTrendData(trend=trend))
