import pytest

from app.services.assessment_result import (
    _RESULT_NOTES,
    recommend_professional,
    result_copy,
)
from app.services.notification import assert_domain_safe


def test_result_copy_exists_for_all_tiers():
    for tier in (1, 2, 3, 4):
        short, note = result_copy(tier)
        assert short and note


def test_result_copy_is_domain_safe():
    # 모든 결과 문구는 도메인 금지어(치료/진단/우울/점수/구간 등)를 포함하지 않아야 한다.
    for short, note in _RESULT_NOTES.values():
        assert_domain_safe(short)
        assert_domain_safe(note)


def test_recommend_professional_on_tier4():
    assert recommend_professional(4, False) is True


def test_recommend_professional_on_flag():
    assert recommend_professional(1, True) is True


def test_no_recommend_when_low_tier_no_flag():
    assert recommend_professional(1, False) is False
    assert recommend_professional(3, False) is False


def test_result_response_has_no_clinical_band():
    # 스키마 계약: 응답에 임상 구간/점수 필드가 없어야 한다(M3).
    from app.schemas.assessment import AssessmentHistoryItem, AssessmentResponse

    for model in (AssessmentResponse, AssessmentHistoryItem):
        fields = set(model.model_fields)
        assert "phq9_level" not in fields
        assert "phq9_score" not in fields
        assert "phq_tier" not in fields
