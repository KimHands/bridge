"""챗봇 오케스트레이션 — 다층 방어 흐름 ①~⑥ 조립."""
import logging

from fastapi import BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.llm_gateway import GatewayError, chat_completion
from app.core.redis import append_chat_turn, get_chat_session
from app.services import chat_guard, chat_memory

logger = logging.getLogger(__name__)

_PERSONA = (
    "너는 청년 정서 웰니스 앱 'Bridge'의 따뜻한 대화 친구야. "
    "짧고 공감적인 한국어로 반응해. 사용자가 마음을 편히 털어놓도록 도와줘.\n"
    "지켜야 할 규칙:\n"
    "- 너는 상담사나 의료인이 아니야. 진단·처방·상담을 하지 마.\n"
    "- '치료·진단·개선·효과' 같은 의료 표현을 쓰지 마.\n"
    "- 민감하거나 위급한 주제는 직접 다루지 말고, 전문기관에 이야기해보길 부드럽게 권해.\n"
    "- 길게 설명하지 말고 1~3문장으로 짧게 공감해."
)


def _build_system_prompt(memories: list[str]) -> str:
    prompt = _PERSONA
    if memories:
        joined = "; ".join(memories)
        prompt += f"\n\n참고로 이 사용자에 대해 알고 있는 점: {joined}"
    return prompt


async def handle_message(
    *,
    db: AsyncSession,
    user_id,
    message: str,
    background: BackgroundTasks,
) -> dict:
    """다층 방어 흐름. 응답 dict: {reply, is_crisis, crisis_info}.

    user_id는 프로덕션에서 uuid.UUID 객체(current_user.id)로 전달된다.
    """
    # ① 입력 위기 사전필터 — 감지 시 LLM 미호출, 메모리 저장 안 함
    if chat_guard.detect_crisis(message):
        return {
            "reply": chat_guard.CRISIS_REPLY,
            "is_crisis": True,
            "crisis_info": chat_guard.crisis_info_payload(),
        }

    # ② 세션 컨텍스트 + 특징 메모리 로드
    session = await get_chat_session(user_id)
    memories = await chat_memory.load_memories(db, user_id)

    # ③ 게이트웨이 호출
    messages = [{"role": "system", "content": _build_system_prompt(memories)}]
    messages += session
    messages.append({"role": "user", "content": message})
    try:
        reply = await chat_completion(messages, max_tokens=512, temperature=0.7)
    except GatewayError:
        return {"reply": chat_guard.SAFE_FALLBACK_REPLY, "is_crisis": False, "crisis_info": None}

    # ④ 출력 사후검증 — 위반 시 폴백 교체(원문 비저장)
    if not chat_guard.is_reply_safe(reply):
        logger.warning("chat reply blocked by domain guard")
        return {"reply": chat_guard.SAFE_FALLBACK_REPLY, "is_crisis": False, "crisis_info": None}

    # ⑤ 세션에 턴 추가(TTL 갱신)
    updated = await append_chat_turn(user_id, message, reply, settings.chat_session_ttl)

    # ⑥ 주기적 특징 메모리 추출(BackgroundTask, 위기 아닐 때만)
    if chat_memory.should_extract(len(updated)):
        background.add_task(chat_memory.extract_and_store, user_id, updated)

    return {"reply": reply, "is_crisis": False, "crisis_info": None}
