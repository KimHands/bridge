"""익명 계정 생성 남용 방어 레이트리밋.

device_secret은 클라이언트가 임의 생성하므로(공격자가 무한 회전 가능) 이를 키로
쓰면 무력하다. 대신 요청 출처 IP를 키로 **신규 계정 생성만** 카운트한다. 기존
device_secret 매칭(재인증)은 계정을 만들지 않으므로 대상이 아니다.

값은 임상 근거 없는 운영 잠정값이다. 공유 NAT(캠퍼스·회사 와이파이) 뒤 다수의
실제 사용자를 고려해 넉넉히 잡고, 운영 지표(M2)로 튜닝한다. Redis 장애 시
fail-open(허용) — 신규 사용자 온보딩을 막는 것이 남용을 막는 것보다 나쁘다.

⚠️ 프록시(AWS ALB) 뒤 배포 시 X-Forwarded-For 신뢰 홉 고정이 필요하다(현재는
best-effort speed-bump). 스푸핑 방지 하드닝은 Phase 9 배포 후속 과제.
"""
import logging

ANON_CREATE_PER_HOUR = 30
ANON_CREATE_PER_DAY = 100

logger = logging.getLogger(__name__)


async def _incr_ttl(r, key: str, ttl: int) -> int:
    """INCR로 원자 증가 후 최초(1) 도달 시에만 TTL을 건다."""
    n = await r.incr(key)
    if n == 1:
        await r.expire(key, ttl)
    return n


async def check_anon_creation(r, ip: str) -> bool:
    """신규 익명 계정 생성이 허용되면 True. IP당 시간/일 상한 초과 시 False.
    Redis 예외 시 True(fail-open)."""
    try:
        k = f"rl:anon:{ip}"
        hour = await _incr_ttl(r, f"{k}:hour", 3600)
        day = await _incr_ttl(r, f"{k}:day", 86400)
        return hour <= ANON_CREATE_PER_HOUR and day <= ANON_CREATE_PER_DAY
    except Exception:
        logger.warning("anon rate limit check failed; allowing (fail-open)")
        return True
