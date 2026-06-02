import pytest

from app.services import chat as chat_service
from app.services import chat_guard


def test_build_system_prompt_injects_memories():
    prompt = chat_service._build_system_prompt(["강아지를 키움", "캠핑 선호"])
    assert "강아지를 키움" in prompt
    assert "진단" in prompt or "상담" in prompt  # 규제 가드레일 문구


def test_build_system_prompt_without_memories():
    prompt = chat_service._build_system_prompt([])
    assert isinstance(prompt, str) and len(prompt) > 0


class _FakeBG:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *a, **k):
        self.tasks.append((fn, a, k))


async def _async(value):
    return value


@pytest.mark.asyncio
async def test_crisis_input_skips_gateway(monkeypatch):
    called = {"gateway": False}

    async def fake_completion(*a, **k):
        called["gateway"] = True
        return "응답"

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    bg = _FakeBG()
    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="죽고 싶어", background=bg
    )
    assert resp["is_crisis"] is True
    assert called["gateway"] is False
    assert resp["crisis_info"]["show_hospital_cta"] is True
    assert bg.tasks == []  # 위기 발화는 메모리 추출 안 함


@pytest.mark.asyncio
async def test_banned_reply_replaced_with_fallback(monkeypatch):
    async def fake_completion(*a, **k):
        return "당신은 치료가 필요해요"  # 금지어 '치료'

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="오늘 좀 우울한 하루였어", background=_FakeBG()
    )
    assert resp["is_crisis"] is False
    assert resp["reply"] == chat_guard.SAFE_FALLBACK_REPLY


@pytest.mark.asyncio
async def test_reply_with_crisis_signal_routes_to_crisis_guidance(monkeypatch):
    # B4: 입력단을 통과한(미탐) 위기 신호가 LLM 출력에 드러나면 위기 안내로 교체.
    async def fake_completion(*a, **k):
        return "나도 가끔 죽고 싶다는 생각이 들어"  # 위기 신호 포함 출력

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="요즘 무기력해", background=_FakeBG()
    )
    assert resp["is_crisis"] is True
    assert resp["reply"] == chat_guard.CRISIS_REPLY
    assert resp["crisis_info"]["show_hospital_cta"] is True


@pytest.mark.asyncio
async def test_normal_reply_passes_through(monkeypatch):
    async def fake_completion(*a, **k):
        return "많이 속상했겠어요. 오늘은 좀 어땠어요?"

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([{"role": "user", "content": "x"}]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="친구랑 싸웠어", background=_FakeBG()
    )
    assert resp["is_crisis"] is False
    assert "속상" in resp["reply"]


@pytest.mark.asyncio
async def test_gateway_failure_returns_fallback(monkeypatch):
    from app.core.llm_gateway import GatewayError

    async def boom(*a, **k):
        raise GatewayError("down")

    monkeypatch.setattr(chat_service, "chat_completion", boom)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="안녕", background=_FakeBG()
    )
    assert resp["is_crisis"] is False
    assert resp["reply"] == chat_guard.SAFE_FALLBACK_REPLY


class _Spy:
    def __init__(self):
        self.events = []

    async def __call__(self, event_type, **kwargs):
        self.events.append(event_type)


@pytest.mark.asyncio
async def test_crisis_input_records_guard_input(monkeypatch):
    spy = _Spy()
    monkeypatch.setattr(chat_service, "record_safety_event", spy)

    bg = _FakeBG()
    await chat_service.handle_message(
        db=None, user_id="u1", message="죽고 싶어", background=bg
    )
    assert spy.events == ["chat_guard_input"]


@pytest.mark.asyncio
async def test_banned_reply_records_banned_term(monkeypatch):
    spy = _Spy()
    monkeypatch.setattr(chat_service, "record_safety_event", spy)

    async def fake_completion(*a, **k):
        return "당신은 치료가 필요해요"  # 금지어 '치료'

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    bg = _FakeBG()
    await chat_service.handle_message(
        db=None, user_id="u1", message="안녕", background=bg
    )
    assert spy.events == ["chat_banned_term"]


@pytest.mark.asyncio
async def test_crisis_in_reply_records_guard_output(monkeypatch):
    spy = _Spy()
    monkeypatch.setattr(chat_service, "record_safety_event", spy)

    async def fake_completion(*a, **k):
        return "죽고 싶다는 생각이 드네요"  # 출력단 위기 신호

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    bg = _FakeBG()
    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="안녕", background=bg
    )
    assert resp["is_crisis"] is True
    assert spy.events == ["chat_guard_output"]


@pytest.mark.asyncio
async def test_normal_reply_records_nothing(monkeypatch):
    spy = _Spy()
    monkeypatch.setattr(chat_service, "record_safety_event", spy)

    async def fake_completion(*a, **k):
        return "오늘도 잘 지냈길 바라요"  # 정상 응답

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    bg = _FakeBG()
    await chat_service.handle_message(
        db=None, user_id="u1", message="안녕", background=bg
    )
    assert spy.events == []
