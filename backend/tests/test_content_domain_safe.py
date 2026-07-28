import ast
from pathlib import Path

import pytest

import app.api.v1.auth as auth_mod
import app.api.v1.routines as routines_mod
from app.api.v1.keywords import KEYWORD_META
from app.seeds.routines import ROUTINE_SEEDS
from app.services.notification import assert_domain_safe


def _collect_user_facing_messages(module_path: str) -> list[str]:
    """모듈 소스를 AST로 훑어 사용자 노출 문구를 자동 수집한다.

    (1) dict의 `"message"` 키 문자열 값 — HTTPException detail·응답 envelope 공통.
    (2) 이름에 MSG/MESSAGE가 든 모듈 상수 문자열 — 예: routines._MSG_REQUEST_*.

    문구를 새로 추가해도 수집 대상에 자동 포함되므로 금지어 가드 갭이 닫힌다."""
    tree = ast.parse(Path(module_path).read_text(encoding="utf-8"))
    found: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Dict):
            for key, val in zip(node.keys, node.values):
                if (
                    isinstance(key, ast.Constant)
                    and key.value == "message"
                    and isinstance(val, ast.Constant)
                    and isinstance(val.value, str)
                ):
                    found.append(val.value)
        elif isinstance(node, ast.Assign):
            for tgt in node.targets:
                if (
                    isinstance(tgt, ast.Name)
                    and ("MSG" in tgt.id or "MESSAGE" in tgt.id)
                    and isinstance(node.value, ast.Constant)
                    and isinstance(node.value.value, str)
                ):
                    found.append(node.value.value)
    return found


@pytest.mark.parametrize("module", [auth_mod, routines_mod], ids=["auth", "routines"])
def test_api_user_facing_messages_domain_safe(module):
    """auth·routines 엔드포인트의 사용자 노출 문구는 도메인 금지어를 포함하면 안 된다.
    AST 자동 수집이라 문구를 추가해도 자동으로 검사된다."""
    messages = _collect_user_facing_messages(module.__file__)
    # 수집기가 무언가는 찾아야 한다 — 0건이면 회귀(테스트가 공허하게 통과하는 것 방지)
    assert messages, f"{module.__name__}에서 사용자 노출 문구를 수집하지 못함"
    for msg in messages:
        assert_domain_safe(msg)


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
