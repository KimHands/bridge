"""챗봇 Redis 대화 세션의 암호화 저장·로드·삭제 검증.

실제 Redis 없이 in-memory FakeRedis로 setex/get/delete를 대체해
append_chat_turn → get_chat_session 라운드트립과 delete_chat_session을 확인한다.
"""
import pytest

from app.core import redis as redis_module


class _FakeRedis:
    def __init__(self):
        self.store: dict[str, str] = {}

    async def setex(self, key, ttl, value):
        self.store[key] = value

    async def get(self, key):
        return self.store.get(key)

    async def delete(self, key):
        self.store.pop(key, None)


@pytest.fixture
def fake_redis(monkeypatch):
    fake = _FakeRedis()

    async def _get():
        return fake

    monkeypatch.setattr(redis_module, "get_redis", _get)
    return fake


async def test_append_and_get_roundtrip(fake_redis):
    await redis_module.append_chat_turn("u1", "안녕", "반가워요", ttl_seconds=3600)
    session = await redis_module.get_chat_session("u1")
    assert session == [
        {"role": "user", "content": "안녕"},
        {"role": "assistant", "content": "반가워요"},
    ]


async def test_session_stored_encrypted_not_plaintext(fake_redis):
    await redis_module.append_chat_turn("u1", "비밀 이야기", "응답", ttl_seconds=3600)
    raw = fake_redis.store[redis_module._chat_session_key("u1")]
    # 평문 JSON이 아니라 'iv:ciphertext' 형태로 저장되어야 한다.
    assert "비밀 이야기" not in raw
    assert raw.count(":") == 1


async def test_get_session_empty_when_absent(fake_redis):
    assert await redis_module.get_chat_session("nobody") == []


async def test_corrupt_session_treated_as_empty(fake_redis):
    # 과거 평문 세션 등 복호화 불가 값은 빈 세션으로 처리(에러 전파 금지).
    fake_redis.store[redis_module._chat_session_key("u1")] = '[{"role":"user"}]'
    assert await redis_module.get_chat_session("u1") == []


async def test_delete_chat_session(fake_redis):
    await redis_module.append_chat_turn("u1", "안녕", "응답", ttl_seconds=3600)
    await redis_module.delete_chat_session("u1")
    assert redis_module._chat_session_key("u1") not in fake_redis.store
    assert await redis_module.get_chat_session("u1") == []
