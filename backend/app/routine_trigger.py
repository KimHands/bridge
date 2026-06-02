import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.assessment import Assessment
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword
from app.models.mission import TriggerLog
from app.models.notification import DeviceToken, NotificationSetting
from app.models.routine import Routine, UserRoutine
from app.services.notification import send_notification

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


async def _is_in_cooldown(
    db: AsyncSession, user_id: uuid.UUID, keyword: str, now: datetime
) -> bool:
    """해당 키워드가 마지막 트리거 이후 쿨다운(3일) 중이면 True."""
    result = await db.execute(
        select(TriggerLog)
        .where(TriggerLog.user_id == user_id, TriggerLog.triggered_keyword == keyword)
        .order_by(TriggerLog.created_at.desc())
        .limit(1)
    )
    last_log = result.scalar_one_or_none()
    return bool(last_log and last_log.cooldown_until > now)


def _assign_routine(
    db: AsyncSession,
    user_id: uuid.UUID,
    routine: Routine,
    keywords: list[str],
    now: datetime,
    active_ids: set,
    assigned_routine_ids: list,
) -> None:
    """루틴 1개를 배정하고, 커버하는 모든 키워드에 쿨다운(TriggerLog)을 기록."""
    db.add(UserRoutine(
        user_id=user_id,
        routine_id=routine.id,
        source="trigger",
        is_active=True,
        assigned_at=now,
    ))
    for keyword in keywords:
        db.add(TriggerLog(
            user_id=user_id,
            triggered_keyword=keyword,
            routine_id=routine.id,
            cooldown_until=now + timedelta(days=COOLDOWN_DAYS),
        ))
    active_ids.add(routine.id)
    assigned_routine_ids.append(routine.id)


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

    # ② 일기별 감정 키워드 수집 — N+1 제거: 전체 일기 키워드를 한 번에 조회.
    diary_ids = [d.id for d in diaries]
    kw_by_diary: dict = {}
    kw_result = await db.execute(
        select(DiaryEmotionKeyword.diary_id, EmotionKeyword.name)
        .join(EmotionKeyword, EmotionKeyword.id == DiaryEmotionKeyword.keyword_id)
        .where(DiaryEmotionKeyword.diary_id.in_(diary_ids))
    )
    for diary_id, name in kw_result.all():
        kw_by_diary.setdefault(diary_id, []).append(name)

    diary_logs = [
        {"mood_score": d.mood_score, "emotion_keywords": kw_by_diary.get(d.id, [])}
        for d in diaries
    ]

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

    # ④-a 4구간(최중증)은 키워드 트리거 루틴 배정 영역이 아니라 전문가 연계 영역이다.
    #      (시드상 4구간 루틴은 '원인 무관 고정' 1개뿐이라 키워드 매칭이 구조적으로 0건)
    #      조용한 무동작 대신 명시적으로 분기·기록한다. 사용자 대면 전문가 안내는
    #      자가평가 결과 화면(needs_professional / tier 4 위기 안내)이 담당한다.
    if phq_tier == 4:
        logger.info(
            "trigger skipped for tier-4 user_id=%s (professional referral domain)", user_id
        )
        return

    # ⑤ 기존 활성 루틴 id 집합
    active_result = await db.execute(
        select(UserRoutine.routine_id)
        .where(UserRoutine.user_id == user_id, UserRoutine.is_active == True)
    )
    active_ids = {row[0] for row in active_result.all()}

    # ⑥ 쿨다운을 통과한 키워드만 선별
    fresh_keywords = [
        k for k in triggered_keywords if not await _is_in_cooldown(db, user_id, k, now)
    ]

    any_assigned = False
    assigned_routine_ids: list = []

    # ⑥-a 충돌 처리(명세 C-3): 상위 2개 키워드가 동시 발동하면
    #      두 키워드를 모두 커버하는 복합 루틴을 우선 추천.
    composite_assigned = False
    if len(fresh_keywords) >= 2:
        top_two = fresh_keywords[:2]
        composite_result = await db.execute(
            select(Routine)
            .where(
                Routine.phq_tier_min <= phq_tier,
                Routine.phq_tier_max >= phq_tier,
                Routine.target_keywords.contains(top_two),
            )
            .limit(1)
        )
        composite = composite_result.scalar_one_or_none()
        if composite and composite.id not in active_ids:
            _assign_routine(db, user_id, composite, top_two, now, active_ids, assigned_routine_ids)
            any_assigned = True
            composite_assigned = True

    # ⑥-b 복합 루틴이 없으면(또는 단일 키워드) 키워드별 단일 루틴 개별 배정.
    if not composite_assigned:
        for keyword in fresh_keywords:
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
            _assign_routine(db, user_id, routine, [keyword], now, active_ids, assigned_routine_ids)
            any_assigned = True

    if any_assigned:
        await db.commit()

        # 시나리오 3: 트리거 발동 시 즉시 푸시 알림
        setting_result = await db.execute(
            select(NotificationSetting).where(NotificationSetting.user_id == user_id)
        )
        setting = setting_result.scalar_one_or_none()
        if setting and setting.push_enabled:
            token_result = await db.execute(
                select(DeviceToken).where(
                    and_(DeviceToken.user_id == user_id, DeviceToken.is_active.is_(True))
                )
            )
            tokens = token_result.scalars().all()
            for assigned_routine_id in assigned_routine_ids:
                await send_notification(
                    db=db,
                    user_id=user_id,
                    tokens=list(tokens),
                    notification_type="trigger",
                    deep_link_type="trigger",
                    extra_data={"routine_id": str(assigned_routine_id)},
                )
