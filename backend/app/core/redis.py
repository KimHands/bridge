import json
from datetime import timedelta

import redis.asyncio as aioredis

from app.core.config import settings

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
    """최근 대화 턴 리스트를 반환. 없으면 빈 리스트."""
    r = await get_redis()
    raw = await r.get(_chat_session_key(user_id))
    return json.loads(raw) if raw else []


async def append_chat_turn(
    user_id: str, user_msg: str, assistant_msg: str, ttl_seconds: int
) -> list[dict]:
    """user/assistant 턴을 세션에 추가하고 TTL을 갱신한다. 최근 CHAT_MAX_TURNS만 유지."""
    session = await get_chat_session(user_id)
    session.append({"role": "user", "content": user_msg})
    session.append({"role": "assistant", "content": assistant_msg})
    session = session[-(CHAT_MAX_TURNS * 2):]
    r = await get_redis()
    await r.setex(_chat_session_key(user_id), ttl_seconds, json.dumps(session, ensure_ascii=False))
    return session
