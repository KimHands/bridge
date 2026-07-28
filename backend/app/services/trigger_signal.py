"""트리거 신호 계산 — DB 접근이 없는 순수 함수.

설계: docs/02-design/2026-07-21-트리거-재설계.design.md
기존 가중합(mood 0.3 + 키워드 0.7)은 모든 키워드에 동일 상수를 더해
발동·순위 어디에도 영향이 없는 no-op이었으므로 폐기한다. 키워드 반복과
mood 편차를 독립 게이트로 분리한다.
"""

from statistics import mean, stdev

TRIGGER_THRESHOLD = 3  # 최근 7일 내 동일 키워드 발생 횟수


def count_keyword_frequency(diary_logs: list[dict]) -> dict[str, int]:
    """diary_logs: [{"mood_score": int, "emotion_keywords": [str]}] → 키워드별 발생 횟수."""
    freq: dict[str, int] = {}
    for log in diary_logs:
        for keyword in log["emotion_keywords"]:
            freq[keyword] = freq.get(keyword, 0) + 1
    return freq


def select_candidate_keywords(keyword_freq: dict[str, int], limit: int = 2) -> list[str]:
    """임계 이상 키워드를 빈도 내림차순으로 최대 limit개.

    동점은 키워드명 오름차순으로 깨 결정성을 보장한다(가짜 정밀도 없이 정직한 순위).
    """
    candidates = [k for k, f in keyword_freq.items() if f >= TRIGGER_THRESHOLD]
    return sorted(candidates, key=lambda k: (-keyword_freq[k], k))[:limit]


MIN_BASELINE_OBS = 7      # mood 기준선 산출 최소 관측 수
BASELINE_WINDOW = 30      # 기준선 표본 상한
MIN_MOOD_STDEV = 0.5      # 표준편차 하한 — 1~5 정수 척도에서 과민 방지
MOOD_SENSITIVITY_L = 1.0  # 민감도 노브 — 근거로 도출된 값이 아니며 M2 지표로 조정
MOOD_SCALE_MIN = 1        # mood_score 척도 하한 — 척도 최저치는 baseline과 무관하게 발동 허용


def compute_mood_baseline(prior_moods: list[int]) -> tuple[float, float] | None:
    """현재 일기를 제외한 본인 과거 mood로 (평균, 변동)을 낸다.

    관측이 MIN_BASELINE_OBS 미만이면 None(콜드스타트) — 호출부가 게이트를 우회한다.
    집단 임계치·임상 컷오프를 쓰지 않는다.
    """
    if len(prior_moods) < MIN_BASELINE_OBS:
        return None
    sample = prior_moods[:BASELINE_WINDOW]
    return float(mean(sample)), max(float(stdev(sample)), MIN_MOOD_STDEV)


def passes_mood_gate(
    current_mood: int,
    baseline: tuple[float, float] | None,
    sensitivity: float = MOOD_SENSITIVITY_L,
) -> bool:
    """현재 mood가 개인 기준선 대비 충분히 낮으면 True. 콜드스타트(None)는 우회.

    척도 최저치(MOOD_SCALE_MIN)는 개인 기준선과 무관하게 명백한 저기분 신호로 보고 통과시킨다.
    이 예외가 없으면 항상 최저치만 기록하는 사용자는 baseline 평균도 최저치가 되어
    'mean - L*std' 조건을 영구히 만족할 수 없어 구조적으로 배제된다.
    """
    if baseline is None:
        return True
    if current_mood <= MOOD_SCALE_MIN:
        return True
    baseline_mean, baseline_std = baseline
    return current_mood <= baseline_mean - sensitivity * baseline_std


# 저에너지(무기력·우울) 상태에서는 과제 부담을 낮춰 "최소 과제 트랙"으로 배정한다(B4).
LOW_ENERGY_KEYWORDS = frozenset({"무기력한", "우울한"})


def is_minimal_task_track(keywords: list[str]) -> bool:
    """발동 키워드가 모두 저에너지 상태(무기력·우울)이면 최소 부담 루틴만 배정한다.

    무기력한 사용자에게 높은 부담의 과제를 주면 수행 실패가 좌절로 이어질 수 있어,
    이 경우 effort_level=1(최소 부담) 루틴으로 한정한다. 저에너지 키워드가 섞여 있지
    않으면(예: 짜증나는·불안한 포함) 일반 트랙으로 둔다.
    """
    if not keywords:
        return False
    return all(k in LOW_ENERGY_KEYWORDS for k in keywords)
