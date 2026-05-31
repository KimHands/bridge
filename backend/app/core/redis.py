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
