"""사용자 요청형(on-demand) 대처 루틴 레이트리밋 — Redis 원자 카운터.

전면 soft: 사용자 대면 상한은 차단이 아니라 간격·넛지. 최종 요청은 허용.
아래 수치는 임상 임계값이 아니라 운영 잠정값이며 M2 계측으로 튜닝한다.
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

_INCR_TTL = """
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
"""


@dataclass
class RateState:
    allowed_new: bool     # 신규 루틴 배정 허용 여부
    reason: str           # allow | cooldown | abuse
    nudge: bool = False   # 부드러운 간격 안내 표시
    offer_connection: bool = False  # 사람·위기 연계 "제안" 노출


async def _incr_ttl(r, key: str, ttl: int) -> int:
    return int(await r.eval(_INCR_TTL, 1, key, ttl))


async def check_and_count(r, user_id: str) -> RateState:
    k = f"rl:req:{user_id}"
    try:
        per_min = await _incr_ttl(r, f"{k}:min", 60)
        if per_min > HARD_PER_MIN:
            return RateState(allowed_new=False, reason="abuse")
        # 쿨다운(신규 배정 간격) — 존재하면 soft 넛지
        if await r.exists(f"{k}:cooldown"):
            return RateState(allowed_new=False, reason="cooldown", nudge=True)
        day = await _incr_ttl(r, f"{k}:day", 86400)
        week = await _incr_ttl(r, f"{k}:week", 604800)
        await r.setex(f"{k}:cooldown", REQUEST_COOLDOWN_MIN * 60, "1")
        return RateState(
            allowed_new=True,
            reason="allow",
            nudge=day > REQUEST_SOFT_DAILY or week > REQUEST_SOFT_WEEKLY,
            offer_connection=week >= ESCALATION_WEEKLY,
        )
    except Exception:
        logger.warning("rate_limiter Redis 실패 → fail-open", exc_info=True)
        return RateState(allowed_new=True, reason="allow")
