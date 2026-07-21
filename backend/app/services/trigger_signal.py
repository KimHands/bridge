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


def compute_mood_baseline(prior_moods: list[int]) -> tuple[float, float] | None:
    """현재 일기를 제외한 본인 과거 mood로 (평균, 변동)을 낸다.

    관측이 MIN_BASELINE_OBS 미만이면 None(콜드스타트) — 호출부가 게이트를 우회한다.
    집단 임계치·임상 컷오프를 쓰지 않는다.
    """
    if len(prior_moods) < MIN_BASELINE_OBS:
        return None
    sample = prior_moods[:BASELINE_WINDOW]
    return mean(sample), max(stdev(sample), MIN_MOOD_STDEV)


def passes_mood_gate(
    current_mood: int,
    baseline: tuple[float, float] | None,
    sensitivity: float = MOOD_SENSITIVITY_L,
) -> bool:
    """현재 mood가 개인 기준선 대비 충분히 낮으면 True. 콜드스타트(None)는 우회."""
    if baseline is None:
        return True
    baseline_mean, baseline_std = baseline
    return current_mood <= baseline_mean - sensitivity * baseline_std
