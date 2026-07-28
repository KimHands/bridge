"""게이트 무관 루틴 선정 — 자동 트리거와 사용자 요청 경로가 공유.

선정 우선순위: 저에너지(무기력·우울)만 → 최소과제(effort_level=1) →
지배 키워드 매칭 → 기본 감정안정 세트(effort_level=1) 폴백.
"""
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword
from app.models.routine import Routine
from app.services.trigger_signal import (
    count_keyword_frequency,
    is_minimal_task_track,
    select_candidate_keywords,
)

LOOKBACK_DAYS = 7


def pick_track(candidate_keywords: list[str]) -> str:
    if not candidate_keywords:
        return "fallback"
    return "minimal" if is_minimal_task_track(candidate_keywords) else "keyword"


async def _recent_keywords(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    since = datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)
    rows = await db.execute(
        select(EmotionKeyword.name)
        .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
        .join(DiaryEntry, DiaryEntry.id == DiaryEmotionKeyword.diary_id)
        .where(DiaryEntry.user_id == user_id, DiaryEntry.created_at >= since)
    )
    logs = [{"emotion_keywords": [n]} for (n,) in rows.all()]
    return select_candidate_keywords(count_keyword_frequency(logs))


async def _first_free(db, stmt, active_ids: set) -> Routine | None:
    for routine in (await db.execute(stmt)).scalars().all():
        if routine.id not in active_ids:
            return routine
    return None


async def select_on_demand_routine(
    db: AsyncSession, user_id: uuid.UUID, phq_tier: int, active_ids: set
) -> Routine | None:
    kws = await _recent_keywords(db, user_id)
    track = pick_track(kws)
    tier_ok = (Routine.phq_tier_min <= phq_tier) & (Routine.phq_tier_max >= phq_tier)

    if track == "minimal":
        r = await _first_free(
            db, select(Routine).where(tier_ok, Routine.effort_level == 1).limit(5), active_ids
        )
        if r:
            return r
    elif track == "keyword":
        for kw in kws:
            r = await _first_free(
                db,
                select(Routine).where(tier_ok, kw == any_(Routine.target_keywords)).limit(3),
                active_ids,
            )
            if r:
                return r
    # 폴백: 감정안정(effort_level=1) 아무거나
    return await _first_free(
        db, select(Routine).where(tier_ok, Routine.effort_level == 1).limit(5), active_ids
    )
