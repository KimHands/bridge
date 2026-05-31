# backend/tests/test_trigger.py
from app.routine_trigger import (
    TRIGGER_THRESHOLD,
    _calculate_trigger_score,
    _evaluate_triggers,
)


def test_empty_logs_returns_empty():
    scores, freq = _calculate_trigger_score([])
    assert scores == {}
    assert freq == {}


def test_keyword_frequency_counted():
    logs = [
        {"mood_score": 2, "emotion_keywords": ["우울한", "불안한"]},
        {"mood_score": 3, "emotion_keywords": ["우울한"]},
    ]
    _, freq = _calculate_trigger_score(logs)
    assert freq["우울한"] == 2
    assert freq["불안한"] == 1


def test_score_formula_mood_plus_keyword():
    # 명세: mood 30% + keyword 70%. mood_avg=5 → mood_component=0, keyword=1.0*0.7
    logs = [{"mood_score": 5, "emotion_keywords": ["우울한"]}]
    scores, _ = _calculate_trigger_score(logs)
    assert abs(scores["우울한"] - 0.7) < 1e-9


def test_lower_mood_yields_higher_score():
    low = _calculate_trigger_score([{"mood_score": 1, "emotion_keywords": ["우울한"]}])[0]["우울한"]
    high = _calculate_trigger_score([{"mood_score": 5, "emotion_keywords": ["우울한"]}])[0]["우울한"]
    assert low > high


def test_evaluate_below_threshold_returns_empty():
    freq = {"우울한": TRIGGER_THRESHOLD - 1}
    scores = {"우울한": 0.5}
    assert _evaluate_triggers(scores, freq) == []


def test_evaluate_single_triggered():
    assert _evaluate_triggers({"우울한": 0.5}, {"우울한": 3}) == ["우울한"]


def test_evaluate_returns_top_two_by_score_desc():
    freq = {"우울한": 3, "불안한": 4, "외로운": 5}
    scores = {"우울한": 0.9, "불안한": 0.5, "외로운": 0.7}
    result = _evaluate_triggers(scores, freq)
    # 임계 통과 키워드 중 점수 상위 2개를 내림차순으로
    assert result == ["우울한", "외로운"]
