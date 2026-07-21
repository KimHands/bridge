from app.services.trigger_signal import (
    TRIGGER_THRESHOLD,
    count_keyword_frequency,
    select_candidate_keywords,
)


def test_empty_logs_yield_empty_frequency():
    assert count_keyword_frequency([]) == {}


def test_keyword_frequency_counted_across_logs():
    logs = [
        {"mood_score": 2, "emotion_keywords": ["우울한", "불안한"]},
        {"mood_score": 3, "emotion_keywords": ["우울한"]},
    ]
    freq = count_keyword_frequency(logs)
    assert freq["우울한"] == 2
    assert freq["불안한"] == 1


def test_candidates_require_threshold():
    freq = {"우울한": TRIGGER_THRESHOLD - 1}
    assert select_candidate_keywords(freq) == []


def test_candidates_sorted_by_frequency_desc_and_capped():
    freq = {"우울한": 3, "불안한": 5, "외로운": 4, "초조한": 2}
    # 임계(3) 이상만, 빈도 내림차순, 최대 2개
    assert select_candidate_keywords(freq) == ["불안한", "외로운"]


def test_candidate_tie_broken_by_name_for_determinism():
    freq = {"외로운": 3, "불안한": 3}
    assert select_candidate_keywords(freq) == ["불안한", "외로운"]
