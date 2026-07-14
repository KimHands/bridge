"""특징 메모리 — 추출 호출 · 암호화 저장 · 복호화 로드 · 상한 정리."""
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.encryption import decrypt_json, encrypt_json
from app.core.llm_gateway import GatewayError, chat_completion
from app.models.chat import ChatMemory

logger = logging.getLogger(__name__)

_MEMORY_EXTRACT_EVERY = 3  # 이 턴 수의 배수일 때만 추출(게이트웨이 비용 절감)

_EXTRACT_SYSTEM = (
    "다음 대화에서 사용자의 '지속적 특징'(선호·상황·관심사)만 한국어 1~2줄로 요약해줘. "
    "감정 상태나 위기 발화 내용은 제외하고, 특징이 없으면 빈 문자열만 출력해."
)


def should_extract(turn_count: int) -> bool:
    """세션 턴 수가 추출 주기에 도달했는지."""
    return turn_count > 0 and turn_count % _MEMORY_EXTRACT_EVERY == 0


def _build_extract_messages(session: list[dict]) -> list[dict]:
    convo = "\n".join(f"{t['role']}: {t['content']}" for t in session)
    return [
        {"role": "system", "content": _EXTRACT_SYSTEM},
        {"role": "user", "content": convo},
    ]


async def _store_memory(db: AsyncSession, user_id, content: str) -> None:
    """특징 문자열을 암호화해 저장한다. user_id는 uuid.UUID."""
    row = ChatMemory(user_id=user_id, encrypted_content=encrypt_json({"c": content}, aad=str(user_id)))
    db.add(row)


async def load_memories(db: AsyncSession, user_id) -> list[str]:
    """저장된 특징 메모리를 복호화해 최신순으로 반환한다."""
    result = await db.execute(
        select(ChatMemory)
        .where(ChatMemory.user_id == user_id)
        .order_by(ChatMemory.created_at.desc(), ChatMemory.id.desc())
    )
    rows = result.scalars().all()
    return [decrypt_json(r.encrypted_content, aad=str(user_id))["c"] for r in rows]


async def _enforce_limit(db: AsyncSession, user_id) -> None:
    """user당 상한(chat_memory_max)을 초과한 오래된 메모리를 삭제한다."""
    result = await db.execute(
        select(ChatMemory.id)
        .where(ChatMemory.user_id == user_id)
        .order_by(ChatMemory.created_at.desc(), ChatMemory.id.desc())
    )
    ids = [row[0] for row in result.all()]
    overflow = ids[settings.chat_memory_max:]
    if overflow:
        await db.execute(delete(ChatMemory).where(ChatMemory.id.in_(overflow)))


async def clear_memories(db: AsyncSession, user_id) -> None:
    """사용자 요청으로 특징 메모리를 전부 삭제(프라이버시 권리)."""
    await db.execute(delete(ChatMemory).where(ChatMemory.user_id == user_id))
    await db.commit()


async def extract_and_store(user_id, session: list[dict]) -> None:
    """세션에서 특징을 추출해 저장하고 상한을 적용한다. BackgroundTask에서 호출.

    요청 스코프 세션은 BackgroundTask 실행 전에 닫히므로, 자체 세션을 연다.
    """
    try:
        content = await chat_completion(
            _build_extract_messages(session), max_tokens=128, temperature=0.2
        )
    except GatewayError:
        logger.warning("memory extraction skipped: gateway error")
        return
    content = content.strip()
    if not content:
        return
    async with AsyncSessionLocal() as db:
        await _store_memory(db, user_id, content)
        await _enforce_limit(db, user_id)
        await db.commit()
