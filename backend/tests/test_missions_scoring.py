from app.api.v1.missions import compute_weekly_score


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
