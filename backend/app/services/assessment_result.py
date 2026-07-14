"""자가평가 결과의 사용자 대면 콘텐츠.

임상 구간(phq_tier 1~4)은 서버 내부(루틴 배정·문구 선택)에만 두고, 클라이언트에는
아래 비임상 위로 문구와 recommend_professional 플래그만 전달한다(M3).
점수·구간 수치는 응답에 싣지 않는다(CLAUDE.md 비노출 규칙).
"""
from app.services.notification import assert_domain_safe

# tier -> (short, note). tier는 내부 식별자일 뿐 사용자에게 노출되지 않는다.
_RESULT_NOTES: dict[int, tuple[str, str]] = {
    1: ("편안한 상태네요", "현재 마음 상태가 안정적이에요. 가벼운 루틴으로 이 흐름을 이어가요."),
    2: ("조금 지치셨나요", "조금 지친 신호가 보여요. 작은 회복 루틴부터 함께 시작해봐요."),
    3: ("마음에 무게가 느껴지나요", "마음에 무게가 쌓여있어요. 매일의 기록과 명상이 도움이 될 거예요."),
    4: ("지금 많이 힘드시군요", "지금 많이 힘드시군요. 전문가의 도움을 받는 것도 고려해보세요. 브릿지가 함께할게요."),
}


def result_copy(phq_tier: int) -> tuple[str, str]:
    """tier에 대응하는 (short, note) 비임상 문구를 반환한다."""
    return _RESULT_NOTES[phq_tier]


def recommend_professional(phq_tier: int, needs_professional_flag: bool) -> bool:
    """전문가 연계 안내(위기 카드) 노출 여부. 최중증 구간 또는 자살사고(9번) 양성."""
    return phq_tier == 4 or needs_professional_flag


# 문구에 도메인 금지어가 섞이면 import 시점에 즉시 실패시킨다(회귀 방지).
for _short, _note in _RESULT_NOTES.values():
    assert_domain_safe(_short)
    assert_domain_safe(_note)
