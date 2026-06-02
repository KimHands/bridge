from app.api.v1.keywords import KEYWORD_META
from app.seeds.routines import ROUTINE_SEEDS
from app.services.notification import assert_domain_safe


def test_all_routine_titles_domain_safe():
    """사용자 노출 루틴 제목은 도메인 금지어(_BANNED_TERMS)를 포함하면 안 된다."""
    for routine in ROUTINE_SEEDS:
        assert_domain_safe(routine["title"])  # 위반 시 ValueError


def test_emotion_questions_and_answers_domain_safe():
    """감정 세부질문/선택지도 노출 텍스트.

    감정 키워드 이름(KEYWORD_META의 키, 예 "우울한")은 제외한다 —
    _BANNED_TERMS의 "우울"에 의도된 정서 어휘가 부분일치로 걸리기 때문.
    """
    for meta in KEYWORD_META.values():
        assert_domain_safe(meta["question"])
        for answer in meta["answers"]:
            assert_domain_safe(answer)
