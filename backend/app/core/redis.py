import logging
from datetime import timedelta

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.encryption import decrypt_json, encrypt_json

logger = logging.getLogger(__name__)

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def set_refresh_session(user_id: str, refresh_token: str) -> None:
    r = await get_redis()
    ttl = timedelta(days=settings.refresh_token_expire_days)
    await r.setex(f"session:{user_id}", int(ttl.total_seconds()), refresh_token)


async def get_refresh_session(user_id: str) -> str | None:
    r = await get_redis()
    return await r.get(f"session:{user_id}")


async def delete_refresh_session(user_id: str) -> None:
    r = await get_redis()
    await r.delete(f"session:{user_id}")


async def blacklist_token(jti: str, ttl_seconds: int) -> None:
    r = await get_redis()
    await r.setex(f"blacklist:{jti}", ttl_seconds, "1")


async def is_blacklisted(jti: str) -> bool:
    r = await get_redis()
    return await r.exists(f"blacklist:{jti}") == 1


CHAT_MAX_TURNS = 10  # 컨텍스트로 유지하는 최근 턴 수


def _chat_session_key(user_id: str) -> str:
    return f"chat:session:{user_id}"


async def get_chat_session(user_id: str) -> list[dict]:
    """최근 대화 턴 리스트를 복호화해 반환. 없거나 복호화 실패 시 빈 리스트.

    정신건강 맥락의 대화 원문이므로 일기·자가평가와 동일하게 AES-256-GCM으로
    저장한다. 과거 평문 세션은 복호화에 실패하면 빈 세션으로 간주(TTL로 곧 소멸).
    """
    r = await get_redis()
    raw = await r.get(_chat_session_key(user_id))
    if not raw:
        return []
    try:
        return decrypt_json(raw, aad=str(user_id))["turns"]
    except Exception:
        logger.warning("chat session decrypt failed; treating as empty")
        return []


async def append_chat_turn(
    user_id: str, user_msg: str, assistant_msg: str, ttl_seconds: int
) -> list[dict]:
    """user/assistant 턴을 세션에 추가하고 TTL을 갱신한다. 최근 CHAT_MAX_TURNS만 유지."""
    session = await get_chat_session(user_id)
    session.append({"role": "user", "content": user_msg})
    session.append({"role": "assistant", "content": assistant_msg})
    session = session[-(CHAT_MAX_TURNS * 2):]
    r = await get_redis()
    await r.setex(_chat_session_key(user_id), ttl_seconds, encrypt_json({"turns": session}, aad=str(user_id)))
    return session


async def delete_chat_session(user_id: str) -> None:
    """챗봇 대화 세션을 즉시 삭제. 회원 탈퇴 시 Redis 잔존 대화 파기에 사용."""
    r = await get_redis()
    await r.delete(_chat_session_key(user_id))


def _pending_verify_key(user_id: str) -> str:
    return f"verify:{user_id}"


async def set_pending_verify(user_id: str, email: str, code: str, ttl: int) -> None:
    """승격 시 이메일 인증 대기 상태를 저장한다. 평문 이메일은 여기(Redis TTL)에만
    머물고, verify 성공 시 삭제된다(email_hash만 영속). AES-256-GCM으로 암호화해
    저장한다(H5 aad 패턴과 동일).
    """
    r = await get_redis()
    payload = encrypt_json({"email": email, "code": code}, aad=user_id)
    await r.setex(_pending_verify_key(user_id), ttl, payload)


async def get_pending_verify(user_id: str) -> dict | None:
    """대기 중인 인증 정보를 복호화해 반환. 없거나 만료·복호화 실패 시 None."""
    r = await get_redis()
    raw = await r.get(_pending_verify_key(user_id))
    if not raw:
        return None
    try:
        return decrypt_json(raw, aad=user_id)
    except Exception:
        logger.warning("pending verify decrypt failed; treating as absent")
        return None


async def del_pending_verify(user_id: str) -> None:
    r = await get_redis()
    await r.delete(_pending_verify_key(user_id))
