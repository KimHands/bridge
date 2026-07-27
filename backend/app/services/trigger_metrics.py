"""트리거 결정 익명 계측 — best-effort 사전집계 카운터.

트리거 본 로직을 절대 깨뜨리지 않는다: 독립 세션 + 예외 삼킴
(app/services/safety_metrics.py와 동일 철학).
"""
import logging
from datetime import UTC, date, datetime

from app.core.database import AsyncSessionLocal
from app.models.trigger_metric import TriggerDecisionCounter
from app.services.safety_metrics import today_kst

logger = logging.getLogger(__name__)

DECISION_FIRED = "fired"
DECISION_BLOCKED_TIER4 = "blocked_tier4"
DECISION_NO_CANDIDATE = "no_candidate"
DECISION_BLOCKED_MOOD = "blocked_mood"
DECISION_BLOCKED_COOLDOWN = "blocked_cooldown"
DECISION_BLOCKED_WEEKLY_CAP = "blocked_weekly_cap"
DECISION_NO_ROUTINE_MATCH = "no_routine_match"
DECISION_COLDSTART_BYPASS = "coldstart_bypass"

# 사용자 요청 경로(on-demand, POST /routines/request) 결정 — 동일 테이블 재사용
REQUEST_FIRED = "request_fired"
REQUEST_NUDGED = "request_nudged"
REQUEST_ESCALATION_OFFERED = "request_escalation_offered"
REQUEST_COOLDOWN = "request_cooldown"
REQUEST_NO_ROUTINE = "request_no_routine"
REQUEST_ABUSE = "request_abuse"


def _build_upsert(dialect_name: str, outcome: str, day: date):
    if dialect_name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:
        from sqlalchemy.dialects.postgresql import insert

    stmt = insert(TriggerDecisionCounter).values(
        outcome=outcome, day_bucket=day, count=1
    )
    # updated_at 수동 갱신 — TimestampMixin의 onupdate는 Core upsert에 발동하지 않는다.
    return stmt.on_conflict_do_update(
        index_elements=["outcome", "day_bucket"],
        set_={
            "count": TriggerDecisionCounter.count + 1,
            "updated_at": datetime.now(UTC),
        },
    )


async def record_trigger_decision(
    outcome: str, *, session_factory=AsyncSessionLocal
) -> None:
    """트리거 결정 카운터 +1. 실패해도 호출자에 예외를 전파하지 않는다."""
    try:
        async with session_factory() as db:
            dialect_name = db.bind.dialect.name
            await db.execute(_build_upsert(dialect_name, outcome, today_kst()))
            await db.commit()
    except Exception:
        logger.warning("trigger decision metric drop: %s", outcome)
