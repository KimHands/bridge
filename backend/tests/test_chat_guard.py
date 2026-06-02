from app.services.chat_guard import detect_crisis, is_reply_safe
from app.services.chat_guard import (
    CRISIS_REPLY,
    SAFE_FALLBACK_REPLY,
    crisis_info_payload,
)


def test_detect_crisis_true_for_suicide_terms():
    assert detect_crisis("요즘 너무 힘들어서 죽고 싶어") is True
    assert detect_crisis("자해를 멈출 수가 없어요") is True
    assert detect_crisis("극단적 선택을 생각해") is True


def test_detect_crisis_false_for_normal_text():
    assert detect_crisis("오늘 친구랑 싸워서 속상해") is False
    assert detect_crisis("요즘 일이 너무 많아 피곤해") is False


def test_detect_crisis_handles_spacing_variants():
    assert detect_crisis("죽고싶다는 생각이 들어") is True


def test_detect_crisis_covers_euphemisms():
    assert detect_crisis("그냥 없어지고 싶어") is True
    assert detect_crisis("이제 삶을 끝내고 싶어") is True
    assert detect_crisis("세상을 떠나고 싶다") is True


def test_is_reply_safe_handles_non_string():
    assert is_reply_safe(None) is False  # type: ignore[arg-type]


def test_is_reply_safe_blocks_and_allows():
    assert is_reply_safe("치료가 필요해요") is False  # 금지어 '치료'
    assert is_reply_safe("오늘 하루 어땠어요?") is True


def test_crisis_reply_contains_hotlines():
    assert "1393" in CRISIS_REPLY
    assert "1577-0199" in CRISIS_REPLY


def test_safe_fallback_reply_is_nonempty():
    assert isinstance(SAFE_FALLBACK_REPLY, str) and len(SAFE_FALLBACK_REPLY) > 0


def test_crisis_info_payload_shape():
    info = crisis_info_payload()
    assert info["show_hospital_cta"] is True
    assert any("1393" in line for line in info["lines"])
