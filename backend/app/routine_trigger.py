import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword
from app.models.mission import TriggerLog
from app.models.routine import Routine, UserRoutine

logger = logging.getLogger(__name__)

TRIGGER_THRESHOLD = 3
COOLDOWN_DAYS = 3
LOOKBACK_DAYS = 7


def _calculate_trigger_score(
    diary_logs: list[dict],
) -> tuple[dict[str, float], dict[str, int]]:
    """
    diary_logs: [{"mood_score": int, "emotion_keywords": [str]}]
    Returns: (trigger_scores, keyword_freq)
    """
    if not diary_logs:
        return {}, {}

    keyword_freq: dict[str, int] = {}
    mood_sum = 0

    for log in diary_logs:
        mood_sum += log["mood_score"]
        for keyword in log["emotion_keywords"]:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1

    mood_avg = mood_sum / len(diary_logs)
    total_freq = sum(keyword_freq.values())

    trigger_scores: dict[str, float] = {}
    for keyword, freq in keyword_freq.items():
        mood_component = (5 - mood_avg) / 5 * 0.3
        keyword_component = (freq / total_freq) * 0.7
        trigger_scores[keyword] = mood_component + keyword_component

    return trigger_scores, keyword_freq


def _evaluate_triggers(
    trigger_scores: dict[str, float],
    keyword_freq: dict[str, int],
) -> list[str]:
    """
    TRIGGER_THRESHOLD 이상인 키워드를 점수 내림차순으로 최대 2개 반환.
    """
    triggered = [k for k, freq in keyword_freq.items() if freq >= TRIGGER_THRESHOLD]
    if not triggered:
        return []
    return sorted(triggered, key=lambda k: trigger_scores.get(k, 0), reverse=True)[:2]


async def run_trigger(user_id: uuid.UUID) -> None:
    """
    BackgroundTasks.add_task(run_trigger, user_id) 로 호출.
    독립 DB 세션 생성 — 요청 세션과 격리.
    """
    try:
        async with AsyncSessionLocal() as db:
            await _execute_trigger(user_id, db)
    except Exception:
        logger.exception("Trigger execution failed for user_id=%s", user_id)


async def _execute_trigger(user_id: uuid.UUID, db: AsyncSession) -> None:
    now = datetime.now(timezone.utc)
    lookback = now - timedelta(days=LOOKBACK_DAYS)

    # ① 최근 7일 일기 조회
    diary_result = await db.execute(
        select(DiaryEntry)
        .where(DiaryEntry.user_id == user_id, DiaryEntry.created_at >= lookback)
        .order_by(DiaryEntry.created_at.asc())
    )
    diaries = diary_result.scalars().all()
    if not diaries:
        return

    # ② 일기별 감정 키워드 수집
    diary_logs = []
    for diary in diaries:
        kw_result = await db.execute(
            select(EmotionKeyword)
            .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
            .where(DiaryEmotionKeyword.diary_id == diary.id)
        )
        kw_names = [kw.name for kw in kw_result.scalars().all()]
        diary_logs.append({"mood_score": diary.mood_score, "emotion_keywords": kw_names})

    # ③ 트리거 점수 계산 + 발동 키워드 판정
    trigger_scores, keyword_freq = _calculate_trigger_score(diary_logs)
    triggered_keywords = _evaluate_triggers(trigger_scores, keyword_freq)
    if not triggered_keywords:
        return

    # ④ 최신 PHQ 구간 조회 (없으면 기본값 2)
    assess_result = await db.execute(
        select(Assessment)
        .where(Assessment.user_id == user_id)
        .order_by(Assessment.created_at.desc())
        .limit(1)
    )
    latest = assess_result.scalar_one_or_none()
    phq_tier = latest.phq_tier if latest else 2

    # ⑤ 기존 활성 루틴 id 집합
    active_result = await db.execute(
        select(UserRoutine.routine_id)
        .where(UserRoutine.user_id == user_id, UserRoutine.is_active == True)
    )
    active_ids = {row[0] for row in active_result.all()}

    # ⑥ 키워드별 쿨다운 확인 + 루틴 배정
    any_assigned = False
    for keyword in triggered_keywords:
        # 쿨다운 확인
        cd_result = await db.execute(
            select(TriggerLog)
            .where(TriggerLog.user_id == user_id, TriggerLog.triggered_keyword == keyword)
            .order_by(TriggerLog.created_at.desc())
            .limit(1)
        )
        last_log = cd_result.scalar_one_or_none()
        if last_log and last_log.cooldown_until > now:
            continue

        # 루틴 조회 (tier 범위 + 키워드 매칭, 중복 제외)
        routine_result = await db.execute(
            select(Routine)
            .where(
                Routine.phq_tier_min <= phq_tier,
                Routine.phq_tier_max >= phq_tier,
                keyword == any_(Routine.target_keywords),
            )
            .limit(1)
        )
        routine = routine_result.scalar_one_or_none()
        if not routine or routine.id in active_ids:
            continue

        # UserRoutine 삽입
        db.add(UserRoutine(
            user_id=user_id,
            routine_id=routine.id,
            source="trigger",
            is_active=True,
            assigned_at=now,
        ))

        # TriggerLog 기록
        db.add(TriggerLog(
            user_id=user_id,
            triggered_keyword=keyword,
            routine_id=routine.id,
            cooldown_until=now + timedelta(days=COOLDOWN_DAYS),
        ))

        active_ids.add(routine.id)
        any_assigned = True

    if any_assigned:
        await db.commit()
