from app.services.trigger_signal import (
    MIN_BASELINE_OBS,
    TRIGGER_THRESHOLD,
    compute_mood_baseline,
    count_keyword_frequency,
    passes_mood_gate,
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


def test_baseline_is_none_below_min_observations():
    assert compute_mood_baseline([3] * (MIN_BASELINE_OBS - 1)) is None


def test_baseline_returns_mean_and_stdev():
    baseline = compute_mood_baseline([1, 2, 3, 4, 5, 3, 3])
    assert baseline is not None
    baseline_mean, baseline_std = baseline
    assert abs(baseline_mean - 3.0) < 1e-9
    assert baseline_std > 0.5


def test_baseline_stdev_has_floor_for_constant_history():
    # 모든 기록이 동일하면 표준편차 0 → 하한 0.5로 과민 방지
    baseline = compute_mood_baseline([3] * 10)
    assert baseline is not None
    assert baseline[1] == 0.5


def test_coldstart_bypasses_gate():
    # 기준선 없음(콜드스타트) → 게이트 우회(True)
    assert passes_mood_gate(5, None) is True


def test_gate_blocks_when_mood_not_low_enough():
    # 기준선 3.0, 변동 1.0, L=1.0 → 임계 2.0. mood 3은 통과 못 함.
    assert passes_mood_gate(3, (3.0, 1.0)) is False


def test_gate_passes_when_mood_below_personal_baseline():
    # 임계 2.0 이하 → 발동 허용
    assert passes_mood_gate(2, (3.0, 1.0)) is True


def test_same_keyword_frequency_different_mood_yields_different_decision():
    # R1의 핵심: 동일 빈도라도 mood 편차에 따라 발동 여부가 갈려야 한다.
    baseline = (4.0, 1.0)
    assert passes_mood_gate(4, baseline) is False   # 평소와 비슷 → 무발동
    assert passes_mood_gate(2, baseline) is True    # 평소보다 뚜렷이 낮음 → 발동


def test_scale_floor_mood_always_passes():
    # 척도 최저치(1)는 baseline이 아무리 낮아도 통과 — 상시 최저 기록자 배제 방지(F3).
    from app.services.trigger_signal import MOOD_SCALE_MIN

    assert passes_mood_gate(MOOD_SCALE_MIN, (1.0, 0.5)) is True   # 상시 1점 사용자 → 발동 가능
    assert passes_mood_gate(3, (3.0, 0.5)) is False               # 상시 3점(중립) 사용자는 계속 게이트
