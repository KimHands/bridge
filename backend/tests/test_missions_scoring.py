from app.api.v1.missions import compute_weekly_score
from app.services.mission_scoring import (
    compute_components,
    compute_weekly_score as svc_compute_weekly_score,
    is_week_achieved,
    sum_awarded,
)


def test_both_components_achieved_full_score():
    # 루틴 3일 + 일기 3일: round(3/7*70)=30, round(3/7*30)=13 → 43, 달성
    score, achieved = compute_weekly_score(routine_days=3, diary_days=3)
    assert score == 43
    assert achieved is True


def test_routine_only_awards_routine_component():
    # 루틴 5일 + 일기 0일: round(5/7*70)=50, 일기 미달 → 0 → 50, 달성(한쪽)
    score, achieved = compute_weekly_score(routine_days=5, diary_days=0)
    assert score == 50
    assert achieved is True


def test_diary_only_awards_diary_component():
    # 루틴 0일 + 일기 4일: 루틴 미달 → 0, round(4/7*30)=17 → 17, 달성(한쪽)
    score, achieved = compute_weekly_score(routine_days=0, diary_days=4)
    assert score == 17
    assert achieved is True


def test_both_below_threshold_zero():
    # 루틴 2일 + 일기 1일: 양쪽 3일 미만 → 0, 미달성
    score, achieved = compute_weekly_score(routine_days=2, diary_days=1)
    assert score == 0
    assert achieved is False


# --- 컴포넌트 게이트 (스케줄러 저장값과 동일 소스) ---


def test_compute_components_gates_below_three_days():
    # 1~2일은 각 컴포넌트 0으로 게이트되어야 한다 (잔여점수 오염 방지)
    assert compute_components(routine_days=2, diary_days=2) == (0, 0)
    assert compute_components(routine_days=1, diary_days=5) == (0, round(5 / 7 * 30))


def test_compute_components_matches_weekly_score():
    # 컴포넌트 합 == compute_weekly_score 총점 (스케줄러/엔드포인트 일관성)
    for r in range(0, 8):
        for d in range(0, 8):
            rc, dc = compute_components(r, d)
            total, _ = svc_compute_weekly_score(r, d)
            assert rc + dc == total


def test_service_and_api_export_same_function():
    # 테스트/기존 임포트 경로 호환: 두 경로가 같은 결과
    assert compute_weekly_score(3, 3) == svc_compute_weekly_score(3, 3)


# --- is_week_achieved: 게이트된 저장값 기준 OR ---


def test_is_week_achieved_or_semantics():
    assert is_week_achieved(routine_score=50, diary_score=0) is True   # 루틴만
    assert is_week_achieved(routine_score=0, diary_score=17) is True   # 일기만
    assert is_week_achieved(routine_score=30, diary_score=13) is True  # 양쪽
    assert is_week_achieved(routine_score=0, diary_score=0) is False   # 양쪽 미달


# --- 누적 합산: H1 핵심 (한쪽만 달성한 주도 누락 없이 합산) ---


class _MP:
    def __init__(self, total_score):
        self.total_score = total_score


def test_sum_awarded_includes_single_component_weeks():
    # 루틴만 채운 3주(각 70) + 아무것도 안 한 1주(0) → 210 (기존 AND게이트는 0으로 누락)
    points = [_MP(70), _MP(70), _MP(70), _MP(0)]
    assert sum_awarded(points) == 210


def test_sum_awarded_empty():
    assert sum_awarded([]) == 0
