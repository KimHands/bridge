"""위기·안전 이벤트 익명 계측 — best-effort 사전집계 카운터.

본 요청(평가 저장·챗봇 응답)을 절대 깨뜨리지 않는다: 독립 세션 + 예외 삼킴.
"""
import logging
from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.core.database import AsyncSessionLocal
from app.models.safety_metric import SafetyEventCounter

logger = logging.getLogger(__name__)

_KST = ZoneInfo("Asia/Seoul")


def today_kst() -> date:
    """KST 기준 오늘 날짜. UTC 자정 넘김으로 인한 버킷 오분류를 막는다."""
    return datetime.now(_KST).date()


def assessment_crisis_events(*, needs_professional_flag: bool, phq_tier: int) -> list[str]:
    """평가 결과에서 발생한 위기 이벤트 종류 목록(순서 고정)."""
    events: list[str] = []
    if needs_professional_flag:
        events.append("crisis_flag_phq9")
    if phq_tier == 4:
        events.append("crisis_tier4")
    return events


def _build_upsert(dialect_name: str, event_type: str, day: date):
    if dialect_name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert
    else:
        from sqlalchemy.dialects.postgresql import insert

    stmt = insert(SafetyEventCounter).values(
        event_type=event_type, day_bucket=day, count=1
    )
    # updated_at은 수동으로 갱신한다 — TimestampMixin의 onupdate는 Core upsert(on_conflict)에
    # 발동하지 않으므로, 빼면 충돌 시 updated_at이 최초값에 동결된다.
    return stmt.on_conflict_do_update(
        index_elements=["event_type", "day_bucket"],
        set_={"count": SafetyEventCounter.count + 1, "updated_at": datetime.now(UTC)},
    )


async def record_safety_event(event_type: str, *, session_factory=AsyncSessionLocal) -> None:
    """위기·안전 이벤트 카운터 +1. 실패해도 호출자에 예외를 전파하지 않는다."""
    try:
        async with session_factory() as db:
            dialect_name = db.bind.dialect.name
            await db.execute(_build_upsert(dialect_name, event_type, today_kst()))
            await db.commit()
    except Exception:
        logger.warning("safety metric drop: %s", event_type)
