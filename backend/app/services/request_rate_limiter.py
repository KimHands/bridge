"""사용자 요청형(on-demand) 대처 루틴 레이트리밋 — Redis 원자 카운터.

전면 soft: 사용자 대면 상한은 차단이 아니라 간격·넛지. 최종 요청은 허용.
아래 수치는 임상 임계값이 아니라 운영 잠정값이며 M2 계측으로 튜닝한다.

주의(고정 윈도 한계): day/week/min 카운터는 고정 윈도(fixed window)라 윈도 경계에서
최대 2배까지 버스트가 허용될 수 있다(예: 59초·61초에 각 1회씩 → 2초 내 2회로 집계).
엄밀한 슬라이딩 윈도가 필요하면 별도 설계가 필요하다.
"""
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

REQUEST_COOLDOWN_MIN = 30      # 분 — 신규 루틴 재배정 최소 간격(soft)
REQUEST_SOFT_DAILY = 3         # 일 완만 상한(초과 시 넛지, 차단 아님)
REQUEST_SOFT_WEEKLY = 12       # 주 완만 상한
ESCALATION_WEEKLY = 12         # 주 이 횟수 이상 → 연계 "제안"(위기 단정 아님)
HARD_PER_MIN = 20             # 분당 하드캡(봇/자동화 남용 방어)

# ⚠️ 위 값은 임상 근거 없는 운영 잠정값. clinical threshold 아님. M2로 조정.

@dataclass
class RateState:
    allowed_new: bool     # 신규 루틴 배정 허용 여부
    reason: str           # allow | cooldown | abuse
    nudge: bool = False   # 부드러운 간격 안내 표시
    offer_connection: bool = False  # 사람·위기 연계 "제안" 노출


async def _incr_ttl(r, key: str, ttl: int) -> int:
    """INCR로 원자 증가 후, 최초(1) 도달 시에만 TTL을 건다(하우스키핑용).

    INCR 자체가 원자적이므로 카운트 정확성은 보장된다. INCR과 EXPIRE 사이에
    다른 요청이 끼어들어도 카운트에는 영향이 없다(최악의 경우 EXPIRE 누락으로
    키가 조금 더 오래 남는 정도이며, 이는 이 레이트리밋의 soft 성격상 허용 가능).
    """
    n = await r.incr(key)
    if n == 1:
        await r.expire(key, ttl)
    return n


async def check_and_count(r, user_id: str) -> RateState:
    k = f"rl:req:{user_id}"
    try:
        per_min = await _incr_ttl(r, f"{k}:min", 60)
        if per_min > HARD_PER_MIN:
            return RateState(allowed_new=False, reason="abuse")
        # 쿨다운(신규 배정 간격) — SET NX EX 단일 원자 명령으로 TOCTOU 없이 판정.
        # 성공(최초 세팅)이면 이 호출만 allow로 진행, None(이미 존재)이면 cooldown.
        cooldown_acquired = await r.set(
            f"{k}:cooldown", "1", nx=True, ex=REQUEST_COOLDOWN_MIN * 60
        )
        if not cooldown_acquired:
            return RateState(allowed_new=False, reason="cooldown", nudge=True)
        day = await _incr_ttl(r, f"{k}:day", 86400)
        week = await _incr_ttl(r, f"{k}:week", 604800)
        return RateState(
            allowed_new=True,
            reason="allow",
            nudge=day > REQUEST_SOFT_DAILY or week > REQUEST_SOFT_WEEKLY,
            offer_connection=week >= ESCALATION_WEEKLY,
        )
    except Exception:
        logger.warning("rate_limiter Redis 실패 → fail-open", exc_info=True)
        return RateState(allowed_new=True, reason="allow")
