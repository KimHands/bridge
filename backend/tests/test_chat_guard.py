from app.services.chat_guard import detect_crisis, is_reply_safe


def test_detect_crisis_true_for_suicide_terms():
    assert detect_crisis("요즘 너무 힘들어서 죽고 싶어") is True
    assert detect_crisis("자해를 멈출 수가 없어요") is True
    assert detect_crisis("극단적 선택을 생각해") is True


def test_detect_crisis_false_for_normal_text():
    assert detect_crisis("오늘 친구랑 싸워서 속상해") is False
    assert detect_crisis("요즘 일이 너무 많아 피곤해") is False


def test_detect_crisis_handles_spacing_variants():
    assert detect_crisis("죽고싶다는 생각이 들어") is True
