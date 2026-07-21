"""운영자용 익명 사용 지표 집계 (M2).

기존 테이블(routine_logs·user_routines·assessments·trigger_logs)을 읽어
집계만 한다 — 신규 저장·사용자 노출 없음. 개인 식별 결과를 반환하지 않는다.

KST 일자 버킷은 Python에서 계산한다(방언 안전, M1 safety_metrics와 동일 철학).
예상 운영 규모에서 필요한 컬럼만 조회해 집계한다.
"""
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.assessment import Assessment
from app.models.mission import TriggerLog
from app.models.routine import RoutineLog, UserRoutine
from app.models.trigger_metric import TriggerDecisionCounter

_KST = ZoneInfo("Asia/Seoul")


def _kst_day(dt: datetime) -> date:
    """tz-aware datetime을 KST 날짜로. naive는 UTC로 간주."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(_KST).date()


def _in_range(d: date, start: date, end: date) -> bool:
    return start <= d <= end


def _range_meta(start: date, end: date) -> dict:
    return {"start": start, "end": end, "days": (end - start).days + 1}


async def routine_completion_stats(db: AsyncSession, start: date, end: date) -> dict:
    """루틴 완료율 — 일별 완료 수(정확) + 현재 활성 루틴 기준 근사 완료율.

    과거 활성 스냅샷이 없어 완료율은 '현재 활성' 기준 근사다.
    """
    rows = (
        await db.execute(
            select(RoutineLog.completed_date, RoutineLog.user_routine_id)
        )
    ).all()

    daily: Counter[date] = Counter()
    completed_routines: set = set()
    for completed_date, user_routine_id in rows:
        if _in_range(completed_date, start, end):
            daily[completed_date] += 1
            completed_routines.add(user_routine_id)

    active_now = (
        await db.execute(
            select(UserRoutine.id).where(UserRoutine.is_active.is_(True))
        )
    ).all()
    active_count = len(active_now)

    meta = _range_meta(start, end)
    total = sum(daily.values())
    rate = total / (active_count * meta["days"]) if active_count else None

    return {
        "range": meta,
        "total_completions": total,
        "daily_completions": {d: daily[d] for d in sorted(daily)},
        "distinct_completed_routines": len(completed_routines),
        "active_routines_now": active_count,
        "approx_completion_rate": rate,
    }


async def trigger_activity_stats(db: AsyncSession, start: date, end: date) -> dict:
    """트리거 작동 빈도 — source별 배정 + 트리거 발동 일별·키워드별."""
    ur_rows = (
        await db.execute(select(UserRoutine.source, UserRoutine.assigned_at))
    ).all()
    by_source: Counter[str] = Counter()
    for source, assigned_at in ur_rows:
        if _in_range(_kst_day(assigned_at), start, end):
            by_source[source] += 1

    tl_rows = (
        await db.execute(
            select(TriggerLog.created_at, TriggerLog.triggered_keyword)
        )
    ).all()
    daily: Counter[date] = Counter()
    by_keyword: Counter[str] = Counter()
    for created_at, keyword in tl_rows:
        day = _kst_day(created_at)
        if _in_range(day, start, end):
            daily[day] += 1
            by_keyword[keyword] += 1

    return {
        "range": _range_meta(start, end),
        "assignments_by_source": {
            s: by_source.get(s, 0) for s in ("initial", "trigger", "manual")
        },
        "daily_triggers": {d: daily[d] for d in sorted(daily)},
        "triggers_by_keyword": dict(by_keyword.most_common()),
        "total_triggers": sum(daily.values()),
    }


async def assessment_tier_distribution(db: AsyncSession, start: date, end: date) -> dict:
    """자가평가 tier 분포 추이 — 모집단 분포(익명). 개인 변화 아님."""
    rows = (
        await db.execute(select(Assessment.phq_tier, Assessment.created_at))
    ).all()

    by_tier: Counter[int] = Counter()
    daily_by_tier: dict[date, Counter] = defaultdict(Counter)
    for tier, created_at in rows:
        day = _kst_day(created_at)
        if _in_range(day, start, end):
            by_tier[tier] += 1
            daily_by_tier[day][tier] += 1

    return {
        "range": _range_meta(start, end),
        "by_tier": {t: by_tier.get(t, 0) for t in (1, 2, 3, 4)},
        "daily_by_tier": {
            d: dict(sorted(daily_by_tier[d].items())) for d in sorted(daily_by_tier)
        },
        "total": sum(by_tier.values()),
    }


async def trigger_decision_stats(db: AsyncSession, start: date, end: date) -> dict:
    """트리거 결정 분포 — 발동/무발동 및 차단 게이트별 집계(익명 카운터).

    무발동은 기존 테이블에서 유도할 수 없어 별도 카운터를 읽는다.
    """
    rows = (
        await db.execute(
            select(
                TriggerDecisionCounter.outcome,
                TriggerDecisionCounter.day_bucket,
                TriggerDecisionCounter.count,
            )
        )
    ).all()

    by_outcome: Counter[str] = Counter()
    for outcome, day_bucket, count in rows:
        if _in_range(day_bucket, start, end):
            by_outcome[outcome] += count

    total = sum(by_outcome.values())
    fired = by_outcome.get("fired", 0)
    return {
        "range": _range_meta(start, end),
        "by_outcome": dict(by_outcome.most_common()),
        "total": total,
        "fire_rate": (fired / total) if total else None,
    }
