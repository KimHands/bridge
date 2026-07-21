"""트리거 신호 계산 — DB 접근이 없는 순수 함수.

설계: docs/02-design/2026-07-21-트리거-재설계.design.md
기존 가중합(mood 0.3 + 키워드 0.7)은 모든 키워드에 동일 상수를 더해
발동·순위 어디에도 영향이 없는 no-op이었으므로 폐기한다. 키워드 반복과
mood 편차를 독립 게이트로 분리한다.
"""

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
