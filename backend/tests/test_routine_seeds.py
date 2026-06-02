from app.seeds.routines import ROUTINE_SEEDS


def _matches(keyword: str, tier: int) -> list:
    # 트리거 매칭 조건과 동일: phq_tier_min <= tier <= phq_tier_max AND keyword in target_keywords
    return [
        r
        for r in ROUTINE_SEEDS
        if keyword in r["target_keywords"]
        and r["phq_tier_min"] <= tier <= r["phq_tier_max"]
    ]


def test_positive_keywords_have_routine_for_tier_2_and_3():
    # 2~3구간 사용자가 긍정 키워드 트리거 시 매칭될 루틴이 시드에 존재해야(빈손 방지)
    for keyword in ["뿌듯한", "평온한"]:
        assert _matches(keyword, 2), f"{keyword}: tier2 매칭 루틴 없음"
        assert _matches(keyword, 3), f"{keyword}: tier3 매칭 루틴 없음"


def test_new_positive_routines_have_no_cause_keywords():
    # 긍정 강화 루틴은 트리거 전용 — cause 키워드 없이 긍정 감정 키워드만
    new_titles = {"오늘 뿌듯했던 순간 떠올려 메모하기", "좋아하는 음악 한 곡 듣기"}
    for r in ROUTINE_SEEDS:
        if r["title"] in new_titles:
            assert r["target_keywords"] in (["뿌듯한"], ["평온한"])
            assert r["phq_tier_min"] == 1 and r["phq_tier_max"] == 3
