"""미션 점수 계산 — 스케줄러 저장과 엔드포인트 조회가 공유하는 단일 소스.

규칙(PRD 미션 시스템):
- 주간 점수 = 루틴 70% + 일기 30%, 각 구성요소 독립 적립.
- 구성요소별 최소 기준: 7일 중 3일+ 달성해야 그 구성요소 점수 적립.
- 양쪽 미달이면 0 (차감 없음).
"""

WEEK_DAYS = 7
ROUTINE_WEIGHT = 70
DIARY_WEIGHT = 30
MIN_DAYS = 3


def compute_components(routine_days: int, diary_days: int) -> tuple[int, int]:
    """게이트된 (루틴 점수, 일기 점수). 3일 미만 구성요소는 0."""
    routine_score = round(routine_days / WEEK_DAYS * ROUTINE_WEIGHT) if routine_days >= MIN_DAYS else 0
    diary_score = round(diary_days / WEEK_DAYS * DIARY_WEIGHT) if diary_days >= MIN_DAYS else 0
    return routine_score, diary_score


def compute_weekly_score(routine_days: int, diary_days: int) -> tuple[int, bool]:
    """주간 총점과 달성 여부. 한쪽만 달성해도 그 구성요소는 적립(OR)."""
    routine_score, diary_score = compute_components(routine_days, diary_days)
    weekly_score = routine_score + diary_score
    return weekly_score, is_week_achieved(routine_score, diary_score)


def is_week_achieved(routine_score: int, diary_score: int) -> bool:
    """게이트된 저장값 기준: 어느 한 구성요소라도 적립됐으면 달성."""
    return routine_score > 0 or diary_score > 0


def sum_awarded(points) -> int:
    """적립된 주간 총점의 단순 합. 저장값이 이미 게이트되어 0주는 0을 더한다.

    (미달 구성요소는 저장 시점에 0이므로 AND/OR 재게이트가 필요 없다.)
    """
    return sum(p.total_score for p in points)
