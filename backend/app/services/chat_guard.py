"""챗봇 안전 가드 — 입력 위기 사전필터 + 출력 사후검증.

위기 키워드는 LLM 호출 전에 차단하고, LLM 응답은 사용자에게 전달하기 전에
기존 도메인 금지어 가드(notification.assert_domain_safe)로 재검증한다.
"""
import re

from app.services.notification import assert_domain_safe

# 위기 감지 시 LLM 대신 반환하는 정적 안내. 전문기관 연결만 한다(상담·진단 없음).
CRISIS_REPLY = (
    "지금 많이 힘든 마음이 느껴져요. 혼자 견디지 않아도 괜찮아요.\n"
    "아래 전문기관에서 24시간 도움을 받을 수 있어요.\n"
    "· 자살예방상담 1393\n"
    "· 정신건강위기상담 1577-0199\n"
    "지금 바로 이야기 나눠보는 건 어떨까요?"
)

# 게이트웨이 장애 또는 출력 검증 실패 시 대체 메시지.
SAFE_FALLBACK_REPLY = "지금 잠시 응답이 어려워요. 잠시 후 다시 시도해주세요."


def crisis_info_payload() -> dict:
    """위기 응답에 동봉할 구조화 정보(전화번호 목록 + 병원찾기 CTA 플래그)."""
    return {
        "lines": ["자살예방상담 1393", "정신건강위기상담 1577-0199"],
        "show_hospital_cta": True,
    }


# 자살·자해·극단적 선택 등 위기 신호. 공백 제거 후 부분일치로 검사한다.
_CRISIS_TERMS = (
    "자살",
    "죽고싶",
    "죽고파",
    "죽어버리",
    "사라지고싶",
    "자해",
    "목숨을끊",
    "목을매",
    "극단적선택",
    "뛰어내리",
    "없어지고싶",
    "삶을끝내",
    "세상을떠나",
)


def detect_crisis(text: str) -> bool:
    """사용자 메시지에 위기 신호가 있으면 True. 공백을 제거해 띄어쓰기 변형을 흡수한다."""
    normalized = re.sub(r"\s+", "", text)
    return any(term in normalized for term in _CRISIS_TERMS)


def is_reply_safe(text: str) -> bool:
    """LLM 응답이 도메인 금지어를 포함하지 않으면 True. 기존 가드를 재사용한다."""
    if not isinstance(text, str):
        return False
    try:
        assert_domain_safe(text)
        return True
    except ValueError:
        return False
