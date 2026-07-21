# backend/tests/test_trigger.py
from app.routine_trigger import COOLDOWN_DAYS, LOOKBACK_DAYS, WEEKLY_ASSIGN_CAP


def test_trigger_constants_match_design():
    # 설계 문서(2026-07-21-트리거-재설계.design.md) 파라미터 표와 일치해야 한다.
    assert LOOKBACK_DAYS == 7
    assert COOLDOWN_DAYS == 3
    assert WEEKLY_ASSIGN_CAP == 2


def test_no_weighted_score_function_remains():
    # 근거 없는 가중합(mood 0.3 + 키워드 0.7)이 코드에서 제거되었는지 고정.
    import app.routine_trigger as rt

    assert not hasattr(rt, "_calculate_trigger_score")
    assert not hasattr(rt, "_evaluate_triggers")
