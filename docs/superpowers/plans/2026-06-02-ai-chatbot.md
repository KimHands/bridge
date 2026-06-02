# AI 챗봇 (SCR-012-C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bridge 앱에 "정서적 교감 수준"의 AI 챗봇을 추가한다 — 마인드로직 게이트웨이 LLM 응답 + 다층 안전 방어 + 위기 시 룰베이스 전환 + 특징 메모리 암호화 저장, 그리고 모바일 챗봇 화면과 홈 진입점.

**Architecture:** 하이브리드(C) + 다층 방어(B). 백엔드 `chat` 서비스가 ①입력 위기 사전필터 → ②Redis 세션 + DB 특징 메모리 로드 → ③시스템 프롬프트로 게이트웨이 호출 → ④출력 사후검증(기존 `assert_domain_safe` 재사용) → ⑤세션 갱신 → ⑥BackgroundTask 메모리 추출 흐름을 조립한다. 위기 감지 시 LLM을 호출하지 않고 룰베이스 안내(1393/1577-0199)로 전환한다. 대화 원문은 영구 저장하지 않으며 세션은 Redis TTL, 특징 메모리만 AES-256-GCM으로 저장한다.

**Tech Stack:** FastAPI · SQLAlchemy 2.0(async) · Alembic · Redis(redis.asyncio) · httpx · pytest(asyncio_mode=auto) / React Native(Expo) · TanStack Query v5 · Zustand · React Navigation · phosphor-react-native

**기존 코드 재사용 지점:**
- `app/services/notification.py:58-70` — `assert_domain_safe(text)` / `_BANNED_TERMS`
- `app/core/encryption.py:14-32` — `encrypt_json(dict)->str` / `decrypt_json(str)->dict`
- `app/core/redis.py:7-40` — `get_redis()` lazy 싱글톤(`decode_responses=True`)
- `app/dependencies/auth.py:14-49` — `get_current_user` → `User`
- `app/schemas/auth.py:59-62` — `SuccessResponse[T]` 제네릭 래퍼
- `app/models/base.py:7-22` — `Base`, `TimestampMixin`
- `app/core/config.py:4-24` — `Settings(BaseSettings)`, `settings` 싱글톤
- `app/main.py:93-100` — `app.include_router(router, prefix="/v1")`
- 모바일: `mobile/src/lib/api.ts`(도메인 객체), `mobile/src/theme/tokens.ts`(palette/typography), `mobile/src/components/BackHeader.tsx`(TopBar), `mobile/src/components/BottomCTA.tsx`, `mobile/src/navigation/Navigation.tsx`(RootStackParamList)

---

## 파일 구조 (생성/수정)

### 백엔드 (`backend/`)
| 파일 | 책임 | 생성/수정 |
|------|------|-----------|
| `app/core/config.py` | `MINDLOGIC_*`, `CHAT_*` 설정 추가 | 수정 |
| `app/services/chat_guard.py` | 위기 사전필터 + 출력 검증 | 생성 |
| `app/core/llm_gateway.py` | 마인드로직 게이트웨이 httpx 클라이언트 | 생성 |
| `app/models/chat.py` | `ChatMemory` ORM | 생성 |
| `alembic/versions/xxxx_add_chat_memory.py` | 마이그레이션 | 생성(autogenerate) |
| `app/core/redis.py` | 챗봇 세션 헬퍼 추가 | 수정 |
| `app/services/chat_memory.py` | 특징 메모리 추출·암호화 저장·로드·상한 | 생성 |
| `app/services/chat.py` | 오케스트레이션(①~⑥) | 생성 |
| `app/schemas/chat.py` | 요청/응답 Pydantic 스키마 | 생성 |
| `app/api/v1/chat.py` | `POST /v1/chat/messages`, `GET`/`DELETE /v1/chat/memories` | 생성 |
| `app/main.py` | 라우터 등록 | 수정 |
| `app/models/__init__.py` | `ChatMemory` export (Alembic 인식) | 수정 |
| `tests/test_chat_guard.py` | 가드 단위 테스트 | 생성 |
| `tests/test_llm_gateway.py` | 응답 파싱 단위 테스트 | 생성 |
| `tests/test_chat_memory.py` | 메모리 추출/상한 테스트 | 생성 |
| `tests/test_chat_orchestration.py` | 오케스트레이션 테스트 | 생성 |

### 모바일 (`mobile/`)
| 파일 | 책임 | 생성/수정 |
|------|------|-----------|
| `src/types/chat.ts` | 요청/응답 타입 | 생성 |
| `src/lib/api.ts` | `chat` 도메인 객체 추가 | 수정 |
| `src/hooks/useChatQueries.ts` | 메시지 전송/메모리 조회·삭제 훅 | 생성 |
| `src/screens/chat/ChatScreen.tsx` | 챗봇 대화 화면 | 생성 |
| `src/navigation/Navigation.tsx` | `Chat` 라우트 + 타입 추가 | 수정 |
| `src/screens/main/HomeScreen.tsx` | 헤더 말풍선 진입점 추가 | 수정 |

---

## 사전 준비 (Task 0)

### Task 0: 브랜치 확인 및 .env 키 설정

**Files:**
- Modify: `backend/.env` (로컬, 커밋 안 함)

- [ ] **Step 1: 현재 브랜치 확인**

Run: `cd backend && git branch --show-current`
Expected: `feature/ai-chatbot`

- [ ] **Step 2: 로컬 `.env`에 챗봇 설정 추가**

`backend/.env`에 아래 줄을 추가한다(키 값은 사용자 발급분 사용):

```
MINDLOGIC_API_KEY=<발급받은 키>
MINDLOGIC_BASE_URL=https://factchat-cloud.mindlogic.ai/v1/gateway
CHAT_MODEL=claude-sonnet-4-6
CHAT_SESSION_TTL=3600
CHAT_MEMORY_MAX=20
```

- [ ] **Step 3: 커밋 없음** — `.env`는 `.gitignore` 대상. 변경 사항 없음을 확인.

Run: `cd backend && git status --short`
Expected: `.env` 가 추적 목록에 나타나지 않음

---

## 백엔드

### Task 1: Config — 챗봇 설정 추가

**Files:**
- Modify: `backend/app/core/config.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/test_chat_config.py`:

```python
from app.core.config import settings


def test_chat_settings_have_defaults():
    assert settings.mindlogic_base_url.startswith("https://")
    assert settings.chat_model == "claude-sonnet-4-6"
    assert settings.chat_session_ttl == 3600
    assert settings.chat_memory_max == 20
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_config.py -v`
Expected: FAIL — `AttributeError: 'Settings' object has no attribute 'mindlogic_base_url'`

- [ ] **Step 3: 최소 구현**

`app/core/config.py`의 `Settings` 클래스에 아래 필드를 추가한다(기존 `cors_origins` 아래):

```python
    # 챗봇(마인드로직 게이트웨이) 설정
    mindlogic_api_key: str = ""
    mindlogic_base_url: str = "https://factchat-cloud.mindlogic.ai/v1/gateway"
    chat_model: str = "claude-sonnet-4-6"
    chat_session_ttl: int = 3600
    chat_memory_max: int = 20
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_config.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/core/config.py tests/test_chat_config.py
git commit -m "feat(chat): 마인드로직 게이트웨이 설정 추가"
```

---

### Task 2: chat_guard — 위기 사전필터

**Files:**
- Create: `backend/app/services/chat_guard.py`
- Test: `backend/tests/test_chat_guard.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/test_chat_guard.py`:

```python
from app.services.chat_guard import detect_crisis, is_reply_safe


def test_detect_crisis_true_for_suicide_terms():
    assert detect_crisis("요즘 너무 힘들어서 죽고 싶어") is True
    assert detect_crisis("자해를 멈출 수가 없어요") is True
    assert detect_crisis("극단적 선택을 생각해") is True


def test_detect_crisis_false_for_normal_text():
    assert detect_crisis("오늘 친구랑 싸워서 속상해") is False
    assert detect_crisis("요즘 일이 너무 많아 피곤해") is False


def test_detect_crisis_handles_spacing_variants():
    assert detect_crisis("죽고싶다는 생각이 들어") is True
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_guard.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chat_guard'`

- [ ] **Step 3: 최소 구현 (detect_crisis + is_reply_safe)**

Create `backend/app/services/chat_guard.py`:

```python
"""챗봇 안전 가드 — 입력 위기 사전필터 + 출력 사후검증.

위기 키워드는 LLM 호출 전에 차단하고, LLM 응답은 사용자에게 전달하기 전에
기존 도메인 금지어 가드(notification.assert_domain_safe)로 재검증한다.
"""
import re

from app.services.notification import assert_domain_safe

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
)


def detect_crisis(text: str) -> bool:
    """사용자 메시지에 위기 신호가 있으면 True. 공백을 제거해 띄어쓰기 변형을 흡수한다."""
    normalized = re.sub(r"\s+", "", text)
    return any(term in normalized for term in _CRISIS_TERMS)


def is_reply_safe(text: str) -> bool:
    """LLM 응답이 도메인 금지어를 포함하지 않으면 True. 기존 가드를 재사용한다."""
    try:
        assert_domain_safe(text)
        return True
    except ValueError:
        return False
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_guard.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/services/chat_guard.py tests/test_chat_guard.py
git commit -m "feat(chat): 위기 키워드 사전필터 chat_guard"
```

---

### Task 3: chat_guard — 출력 검증 + 위기 안내 상수

**Files:**
- Modify: `backend/app/services/chat_guard.py`
- Test: `backend/tests/test_chat_guard.py`

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/tests/test_chat_guard.py` 끝에 추가:

```python
from app.services.chat_guard import (
    CRISIS_REPLY,
    SAFE_FALLBACK_REPLY,
    crisis_info_payload,
)


def test_is_reply_safe_blocks_banned_terms():
    # _BANNED_TERMS에 "치료","진단","우울" 등이 포함됨
    assert is_reply_safe("치료가 필요해 보여요") is False
    assert is_reply_safe("우울 증상이 있네요") is False


def test_is_reply_safe_allows_normal_empathy():
    assert is_reply_safe("많이 속상했겠어요. 오늘 하루 어땠어요?") is True


def test_crisis_reply_is_domain_clean_after_strip():
    # 위기 안내는 정적 신뢰 문구지만, 전화번호/기관명 외 금지어가 없어야 한다
    assert "1393" in CRISIS_REPLY
    assert "1577-0199" in CRISIS_REPLY


def test_crisis_info_payload_shape():
    info = crisis_info_payload()
    assert info["show_hospital_cta"] is True
    assert any("1393" in line for line in info["lines"])
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_guard.py -v`
Expected: FAIL — `ImportError: cannot import name 'CRISIS_REPLY'`

- [ ] **Step 3: 위기/폴백 상수 + payload 구현**

`app/services/chat_guard.py`의 import 아래, `detect_crisis` 위에 추가:

```python
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_guard.py -v`
Expected: PASS (7 passed)

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/services/chat_guard.py tests/test_chat_guard.py
git commit -m "feat(chat): 출력 검증 + 위기/폴백 안내 상수"
```

---

### Task 4: llm_gateway — 게이트웨이 클라이언트

**Files:**
- Create: `backend/app/core/llm_gateway.py`
- Test: `backend/tests/test_llm_gateway.py`

> 게이트웨이는 OpenAI 호환 `chat/completions` 형식을 가정한다(스펙 §11). 응답 파싱과 메시지 빌드는 순수 함수로 분리해 단위 테스트하고, 실제 HTTP 호출은 httpx mock으로 검증한다.

- [ ] **Step 1: 실패하는 테스트 작성 (순수 함수)**

Create `backend/tests/test_llm_gateway.py`:

```python
import pytest

from app.core.llm_gateway import _parse_completion, GatewayError


def test_parse_completion_extracts_content():
    body = {"choices": [{"message": {"role": "assistant", "content": "안녕하세요"}}]}
    assert _parse_completion(body) == "안녕하세요"


def test_parse_completion_raises_on_empty_choices():
    with pytest.raises(GatewayError):
        _parse_completion({"choices": []})


def test_parse_completion_raises_on_missing_content():
    with pytest.raises(GatewayError):
        _parse_completion({"choices": [{"message": {"role": "assistant"}}]})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_llm_gateway.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.llm_gateway'`

- [ ] **Step 3: 게이트웨이 클라이언트 구현**

Create `backend/app/core/llm_gateway.py`:

```python
"""마인드로직 게이트웨이 HTTP 클라이언트 (OpenAI 호환 chat/completions)."""
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 20.0


class GatewayError(Exception):
    """게이트웨이 호출 실패 또는 응답 파싱 실패."""


def _parse_completion(body: dict) -> str:
    """게이트웨이 응답 JSON에서 assistant 텍스트를 추출한다."""
    choices = body.get("choices") or []
    if not choices:
        raise GatewayError("empty choices")
    content = choices[0].get("message", {}).get("content")
    if not content:
        raise GatewayError("missing content")
    return content


async def chat_completion(
    messages: list[dict],
    *,
    model: str | None = None,
    max_tokens: int = 512,
    temperature: float = 0.7,
) -> str:
    """게이트웨이에 messages를 보내고 assistant 응답 텍스트를 반환한다.

    messages: [{"role": "system"|"user"|"assistant", "content": str}, ...]
    실패 시 GatewayError.
    """
    url = f"{settings.mindlogic_base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": model or settings.chat_model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    headers = {
        "Content-Type": "application/json",
        "x-api-key": settings.mindlogic_api_key,
        "Authorization": f"Bearer {settings.mindlogic_api_key}",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            return _parse_completion(resp.json())
    except httpx.HTTPError as e:
        logger.error(f"gateway http error: {e}")
        raise GatewayError(str(e)) from e
```

- [ ] **Step 4: 순수 함수 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_llm_gateway.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: HTTP 호출 테스트 추가 (httpx MockTransport)**

`backend/tests/test_llm_gateway.py` 끝에 추가:

```python
import httpx
import pytest
from app.core import llm_gateway


@pytest.mark.asyncio
async def test_chat_completion_posts_and_parses(monkeypatch):
    captured = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json={"choices": [{"message": {"role": "assistant", "content": "반가워요"}}]},
        )

    transport = httpx.MockTransport(handler)

    # AsyncClient가 MockTransport를 쓰도록 패치
    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(llm_gateway.httpx, "AsyncClient", client_factory)

    reply = await llm_gateway.chat_completion(
        [{"role": "user", "content": "안녕"}], model="test-model"
    )
    assert reply == "반가워요"
    assert captured["url"].endswith("/chat/completions")


@pytest.mark.asyncio
async def test_chat_completion_raises_gateway_error_on_500(monkeypatch):
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "boom"})

    transport = httpx.MockTransport(handler)
    real_client = httpx.AsyncClient

    def client_factory(*args, **kwargs):
        kwargs["transport"] = transport
        return real_client(*args, **kwargs)

    monkeypatch.setattr(llm_gateway.httpx, "AsyncClient", client_factory)

    with pytest.raises(llm_gateway.GatewayError):
        await llm_gateway.chat_completion([{"role": "user", "content": "x"}])
```

- [ ] **Step 6: 전체 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_llm_gateway.py -v`
Expected: PASS (5 passed)

- [ ] **Step 7: 커밋**

```bash
cd backend && git add app/core/llm_gateway.py tests/test_llm_gateway.py
git commit -m "feat(chat): 마인드로직 게이트웨이 httpx 클라이언트"
```

---

### Task 5: ChatMemory 모델 + 마이그레이션

**Files:**
- Create: `backend/app/models/chat.py`
- Modify: `backend/app/models/__init__.py`
- Create: `backend/alembic/versions/xxxx_add_chat_memory.py` (autogenerate)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/test_chat_memory_model.py`:

```python
from app.models.chat import ChatMemory


def test_chat_memory_table_and_columns():
    assert ChatMemory.__tablename__ == "chat_memories"
    cols = ChatMemory.__table__.columns
    assert "id" in cols
    assert "user_id" in cols
    assert "encrypted_content" in cols
    assert "created_at" in cols
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_memory_model.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.chat'`

- [ ] **Step 3: 모델 구현**

Create `backend/app/models/chat.py` (패턴 출처: `app/models/diary.py:11-22`):

```python
import uuid

from sqlalchemy import ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ChatMemory(Base, TimestampMixin):
    """사용자의 지속적 특징(선호·상황·관심사) 메모리. AES-256-GCM 암호화 저장."""

    __tablename__ = "chat_memories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    encrypted_content: Mapped[str] = mapped_column(Text, nullable=False)
```

> `TimestampMixin`이 `created_at`/`updated_at`을 제공한다. 스펙은 `created_at`만 요구하지만 믹스인 재사용이 일관적이며 `updated_at`은 무해하다.

- [ ] **Step 4: `__init__.py`에 등록 (Alembic이 인식하도록)**

`app/models/__init__.py`에 import를 추가한다. 기존 모델 import 줄들 옆에:

```python
from app.models.chat import ChatMemory  # noqa: F401
```

(파일에 `__all__`이 있으면 `"ChatMemory"`도 추가.)

- [ ] **Step 5: 모델 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_memory_model.py -v`
Expected: PASS

- [ ] **Step 6: 마이그레이션 생성**

DB 컨테이너가 떠 있어야 한다. autogenerate:

Run:
```bash
cd backend && docker compose up -d db && \
docker compose run --rm api alembic revision --autogenerate -m "add chat_memory"
```
(로컬 alembic 환경이면: `cd backend && alembic revision --autogenerate -m "add chat_memory"`)

Expected: `alembic/versions/` 에 새 파일 생성, `op.create_table("chat_memories", ...)` 포함

- [ ] **Step 7: 마이그레이션 적용 확인**

Run: `cd backend && docker compose run --rm api alembic upgrade head`
Expected: 에러 없이 적용, `chat_memories` 테이블 생성

- [ ] **Step 8: 커밋**

```bash
cd backend && git add app/models/chat.py app/models/__init__.py tests/test_chat_memory_model.py alembic/versions/
git commit -m "feat(chat): ChatMemory 모델 + 마이그레이션"
```

---

### Task 6: Redis 챗봇 세션 헬퍼

**Files:**
- Modify: `backend/app/core/redis.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/test_chat_session_keys.py`:

```python
from app.core.redis import _chat_session_key


def test_chat_session_key_format():
    assert _chat_session_key("u123") == "chat:session:u123"
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_session_keys.py -v`
Expected: FAIL — `ImportError: cannot import name '_chat_session_key'`

- [ ] **Step 3: 세션 헬퍼 구현**

`app/core/redis.py` 끝에 추가(기존 `get_redis`, `settings` import 재사용):

```python
import json

CHAT_MAX_TURNS = 10  # 컨텍스트로 유지하는 최근 턴 수


def _chat_session_key(user_id: str) -> str:
    return f"chat:session:{user_id}"


async def get_chat_session(user_id: str) -> list[dict]:
    """최근 대화 턴 리스트를 반환. 없으면 빈 리스트."""
    r = await get_redis()
    raw = await r.get(_chat_session_key(user_id))
    return json.loads(raw) if raw else []


async def append_chat_turn(
    user_id: str, user_msg: str, assistant_msg: str, ttl_seconds: int
) -> list[dict]:
    """user/assistant 턴을 세션에 추가하고 TTL을 갱신한다. 최근 CHAT_MAX_TURNS만 유지."""
    session = await get_chat_session(user_id)
    session.append({"role": "user", "content": user_msg})
    session.append({"role": "assistant", "content": assistant_msg})
    session = session[-(CHAT_MAX_TURNS * 2):]
    r = await get_redis()
    await r.setex(_chat_session_key(user_id), ttl_seconds, json.dumps(session, ensure_ascii=False))
    return session
```

> `redis.py` 상단에 이미 `import` 블록이 있다면 `import json`은 그쪽으로 옮겨도 무방하다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_session_keys.py -v`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/core/redis.py tests/test_chat_session_keys.py
git commit -m "feat(chat): Redis 챗봇 세션 헬퍼"
```

---

### Task 7: chat_memory — 특징 메모리 서비스

**Files:**
- Create: `backend/app/services/chat_memory.py`
- Test: `backend/tests/test_chat_memory.py`

> 메모리 추출은 게이트웨이 호출을 동반하므로 매 턴 호출하지 않고, 세션 턴 수가 `_MEMORY_EXTRACT_EVERY`의 배수일 때만 BackgroundTask로 실행한다. 추출 프롬프트는 "지속적 특징만 1~2줄, 감정·위기 발화 제외"를 요구한다.

- [ ] **Step 1: 실패하는 테스트 작성 (추출 판단 + 프롬프트)**

Create `backend/tests/test_chat_memory.py`:

```python
from app.services.chat_memory import should_extract, _build_extract_messages


def test_should_extract_only_on_interval():
    # _MEMORY_EXTRACT_EVERY = 3 가정: 턴 수 6,9 → True / 4,5 → False
    assert should_extract(turn_count=6) is True
    assert should_extract(turn_count=9) is True
    assert should_extract(turn_count=4) is False
    assert should_extract(turn_count=0) is False


def test_build_extract_messages_includes_instruction():
    session = [{"role": "user", "content": "나는 강아지를 키워"}]
    msgs = _build_extract_messages(session)
    assert msgs[0]["role"] == "system"
    assert "특징" in msgs[0]["content"]
    # 위기·감정 발화 제외 지시가 포함되어야 함
    assert "제외" in msgs[0]["content"]
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_memory.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chat_memory'`

- [ ] **Step 3: 추출 판단 + 프롬프트 빌더 구현**

Create `backend/app/services/chat_memory.py`:

```python
"""특징 메모리 — 추출 호출 · 암호화 저장 · 복호화 로드 · 상한 정리."""
import logging

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
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
```

- [ ] **Step 4: 판단/프롬프트 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_memory.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: 저장/로드/상한 테스트 추가 (인메모리 DB)**

`backend/tests/test_chat_memory.py` 상단 import에 추가하고, 파일 끝에 테스트 추가:

```python
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.models.base import Base
from app.models.chat import ChatMemory
from app.services.chat_memory import load_memories, _store_memory, _enforce_limit


@pytest_asyncio.fixture
async def db():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    async with Session() as s:
        yield s
    await engine.dispose()


@pytest.mark.asyncio
async def test_store_and_load_roundtrip(db: AsyncSession):
    uid = "11111111-1111-1111-1111-111111111111"
    await _store_memory(db, uid, "강아지를 키우고 캠핑을 좋아함")
    await db.commit()
    memories = await load_memories(db, uid)
    assert "강아지" in memories[0]


@pytest.mark.asyncio
async def test_enforce_limit_keeps_recent(db: AsyncSession, monkeypatch):
    monkeypatch.setattr("app.services.chat_memory.settings.chat_memory_max", 2)
    uid = "22222222-2222-2222-2222-222222222222"
    for i in range(4):
        await _store_memory(db, uid, f"특징{i}")
        await db.commit()
    await _enforce_limit(db, uid)
    await db.commit()
    memories = await load_memories(db, uid)
    assert len(memories) == 2
```

> `aiosqlite`가 dev 의존성에 없으면 `requirements.txt`(또는 `requirements-dev`)에 `aiosqlite`, `pytest-asyncio`를 추가하고 `pip install` 후 진행한다.

- [ ] **Step 6: 저장/로드/상한 + 추출 오케스트레이션 구현**

`app/services/chat_memory.py` 끝에 추가:

```python
async def _store_memory(db: AsyncSession, user_id: str, content: str) -> None:
    """특징 문자열을 암호화해 저장한다."""
    row = ChatMemory(user_id=user_id, encrypted_content=encrypt_json({"c": content}))
    db.add(row)


async def load_memories(db: AsyncSession, user_id: str) -> list[str]:
    """저장된 특징 메모리를 복호화해 최신순으로 반환한다."""
    result = await db.execute(
        select(ChatMemory)
        .where(ChatMemory.user_id == user_id)
        .order_by(ChatMemory.created_at.desc())
    )
    rows = result.scalars().all()
    return [decrypt_json(r.encrypted_content)["c"] for r in rows]


async def _enforce_limit(db: AsyncSession, user_id: str) -> None:
    """user당 상한(chat_memory_max)을 초과한 오래된 메모리를 삭제한다."""
    result = await db.execute(
        select(ChatMemory.id)
        .where(ChatMemory.user_id == user_id)
        .order_by(ChatMemory.created_at.desc())
    )
    ids = [row[0] for row in result.all()]
    overflow = ids[settings.chat_memory_max:]
    if overflow:
        await db.execute(delete(ChatMemory).where(ChatMemory.id.in_(overflow)))


async def clear_memories(db: AsyncSession, user_id: str) -> None:
    """사용자 요청으로 특징 메모리를 전부 삭제(프라이버시 권리)."""
    await db.execute(delete(ChatMemory).where(ChatMemory.user_id == user_id))
    await db.commit()


async def extract_and_store(db: AsyncSession, user_id: str, session: list[dict]) -> None:
    """세션에서 특징을 추출해 저장하고 상한을 적용한다. BackgroundTask에서 호출."""
    try:
        content = await chat_completion(_build_extract_messages(session), max_tokens=128, temperature=0.2)
    except GatewayError:
        return
    content = content.strip()
    if not content:
        return
    await _store_memory(db, user_id, content)
    await _enforce_limit(db, user_id)
    await db.commit()
```

- [ ] **Step 7: 전체 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_memory.py -v`
Expected: PASS (4 passed)

- [ ] **Step 8: 커밋**

```bash
cd backend && git add app/services/chat_memory.py tests/test_chat_memory.py requirements*.txt
git commit -m "feat(chat): 특징 메모리 추출·암호화 저장·상한 서비스"
```

---

### Task 8: chat 스키마

**Files:**
- Create: `backend/app/schemas/chat.py`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/tests/test_chat_schema.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas.chat import ChatMessageRequest, ChatMessageResponse


def test_message_request_rejects_empty():
    with pytest.raises(ValidationError):
        ChatMessageRequest(message="   ")


def test_message_request_rejects_too_long():
    with pytest.raises(ValidationError):
        ChatMessageRequest(message="가" * 1001)


def test_message_response_shape():
    r = ChatMessageResponse(reply="안녕", is_crisis=False, crisis_info=None)
    assert r.reply == "안녕"
    assert r.is_crisis is False
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_schema.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.schemas.chat'`

- [ ] **Step 3: 스키마 구현**

Create `backend/app/schemas/chat.py` (패턴 출처: `app/schemas/diary.py`):

```python
from pydantic import BaseModel, field_validator


class ChatMessageRequest(BaseModel):
    message: str

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        stripped = v.strip()
        if not stripped:
            raise ValueError("메시지를 입력해주세요")
        if len(stripped) > 1000:
            raise ValueError("메시지는 1000자를 초과할 수 없습니다")
        return stripped


class CrisisInfo(BaseModel):
    lines: list[str]
    show_hospital_cta: bool


class ChatMessageResponse(BaseModel):
    reply: str
    is_crisis: bool
    crisis_info: CrisisInfo | None = None


class MemoryItem(BaseModel):
    content: str


class MemoryListResponse(BaseModel):
    memories: list[MemoryItem]
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_schema.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/schemas/chat.py tests/test_chat_schema.py
git commit -m "feat(chat): 요청/응답 스키마"
```

---

### Task 9: chat 오케스트레이션 서비스

**Files:**
- Create: `backend/app/services/chat.py`
- Test: `backend/tests/test_chat_orchestration.py`

> 흐름 ①~⑥. 게이트웨이/메모리 호출은 monkeypatch로 대체해 단위 테스트한다. 핵심 안전 불변식: **위기 입력이면 게이트웨이를 호출하지 않는다**, **금지어 응답은 폴백으로 교체한다**.

- [ ] **Step 1: 시스템 프롬프트 빌더 테스트 작성**

Create `backend/tests/test_chat_orchestration.py`:

```python
import pytest

from app.services import chat as chat_service


def test_build_system_prompt_injects_memories():
    prompt = chat_service._build_system_prompt(["강아지를 키움", "캠핑 선호"])
    assert "강아지를 키움" in prompt
    # 규제 가드레일 문구 포함
    assert "진단" in prompt or "상담" in prompt


def test_build_system_prompt_without_memories():
    prompt = chat_service._build_system_prompt([])
    assert isinstance(prompt, str) and len(prompt) > 0
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && python -m pytest tests/test_chat_orchestration.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chat'`

- [ ] **Step 3: 시스템 프롬프트 빌더 구현**

Create `backend/app/services/chat.py`:

```python
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
```

- [ ] **Step 4: 프롬프트 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_orchestration.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: handle_message 오케스트레이션 테스트 추가**

`backend/tests/test_chat_orchestration.py` 끝에 추가:

```python
class _FakeBG:
    def __init__(self):
        self.tasks = []

    def add_task(self, fn, *a, **k):
        self.tasks.append((fn, a, k))


@pytest.mark.asyncio
async def test_crisis_input_skips_gateway(monkeypatch):
    called = {"gateway": False}

    async def fake_completion(*a, **k):
        called["gateway"] = True
        return "응답"

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="죽고 싶어", background=_FakeBG()
    )
    assert resp["is_crisis"] is True
    assert called["gateway"] is False
    assert resp["crisis_info"]["show_hospital_cta"] is True


@pytest.mark.asyncio
async def test_banned_reply_replaced_with_fallback(monkeypatch):
    async def fake_completion(*a, **k):
        return "당신은 치료가 필요해요"  # 금지어 '치료'

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="오늘 좀 우울한 하루였어", background=_FakeBG()
    )
    assert resp["is_crisis"] is False
    assert resp["reply"] == chat_guard.SAFE_FALLBACK_REPLY


@pytest.mark.asyncio
async def test_normal_reply_passes_through(monkeypatch):
    async def fake_completion(*a, **k):
        return "많이 속상했겠어요. 오늘은 좀 어땠어요?"

    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)
    monkeypatch.setattr(chat_service, "get_chat_session", lambda uid: _async([]))
    monkeypatch.setattr(chat_service, "append_chat_turn", lambda *a, **k: _async([{"role": "user", "content": "x"}]))
    monkeypatch.setattr(chat_service.chat_memory, "load_memories", lambda db, uid: _async([]))

    resp = await chat_service.handle_message(
        db=None, user_id="u1", message="친구랑 싸웠어", background=_FakeBG()
    )
    assert resp["is_crisis"] is False
    assert "속상" in resp["reply"]


async def _async(value):
    return value
```

`from app.services import chat_guard` import를 파일 상단에 추가한다.

- [ ] **Step 6: handle_message 구현**

`app/services/chat.py` 끝에 추가:

```python
async def handle_message(
    *,
    db: AsyncSession,
    user_id: str,
    message: str,
    background: BackgroundTasks,
) -> dict:
    """다층 방어 흐름. 응답 dict: {reply, is_crisis, crisis_info}."""
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
        background.add_task(chat_memory.extract_and_store, db, user_id, updated)

    return {"reply": reply, "is_crisis": False, "crisis_info": None}
```

- [ ] **Step 7: 전체 오케스트레이션 테스트 통과 확인**

Run: `cd backend && python -m pytest tests/test_chat_orchestration.py -v`
Expected: PASS (5 passed)

- [ ] **Step 8: 커밋**

```bash
cd backend && git add app/services/chat.py tests/test_chat_orchestration.py
git commit -m "feat(chat): 다층 방어 오케스트레이션 서비스"
```

---

### Task 10: chat API 라우터 + 등록

**Files:**
- Create: `backend/app/api/v1/chat.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: 라우터 구현**

Create `backend/app/api/v1/chat.py` (패턴 출처: `app/api/v1/diaries.py:28-35`):

```python
from fastapi import APIRouter, BackgroundTasks, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.db import get_db
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    MemoryItem,
    MemoryListResponse,
)
from app.services import chat as chat_service
from app.services import chat_memory

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/messages", response_model=SuccessResponse[ChatMessageResponse])
async def post_message(
    body: ChatMessageRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await chat_service.handle_message(
        db=db,
        user_id=str(current_user.id),
        message=body.message,
        background=background_tasks,
    )
    return SuccessResponse(data=ChatMessageResponse(**result))


@router.get("/memories", response_model=SuccessResponse[MemoryListResponse])
async def list_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    contents = await chat_memory.load_memories(db, str(current_user.id))
    return SuccessResponse(
        data=MemoryListResponse(memories=[MemoryItem(content=c) for c in contents])
    )


@router.delete("/memories", response_model=SuccessResponse[None])
async def delete_memories(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await chat_memory.clear_memories(db, str(current_user.id))
    return SuccessResponse(message="삭제되었습니다")
```

> `get_db`의 정확한 import 경로는 기존 라우터(`diaries.py` 상단)를 그대로 따른다 — `from app.dependencies.db import get_db` 가 아니라면 동일 경로로 맞춘다. `User` 모델 경로도 기존 라우터와 일치시킨다.

- [ ] **Step 2: main.py에 라우터 등록**

`app/main.py`의 다른 `include_router` 줄들 옆에 추가(패턴 출처: `app/main.py:93-100`):

```python
from app.api.v1 import chat as chat_router
...
app.include_router(chat_router.router, prefix="/v1")
```

- [ ] **Step 3: 앱 임포트/기동 스모크 확인**

Run: `cd backend && python -c "from app.main import app; print([r.path for r in app.routes if 'chat' in r.path])"`
Expected: `['/v1/chat/messages', '/v1/chat/memories']` 가 출력됨

- [ ] **Step 4: 전체 백엔드 테스트 통과 확인**

Run: `cd backend && python -m pytest -v`
Expected: 신규 테스트 포함 전체 PASS

- [ ] **Step 5: 커밋**

```bash
cd backend && git add app/api/v1/chat.py app/main.py
git commit -m "feat(chat): /v1/chat 엔드포인트 등록"
```

---

### Task 11: 게이트웨이 실연동 스모크 (수동)

**Files:** 없음 (수동 검증)

- [ ] **Step 1: API 서버 기동**

Run: `cd backend && docker compose up -d`
Expected: api/db/redis 컨테이너 healthy

- [ ] **Step 2: 로그인 토큰 확보 후 메시지 전송**

기존 계정으로 로그인해 access token을 얻고:

```bash
TOKEN=<access_token>
curl -s -X POST http://localhost:8000/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"오늘 좀 지치는 하루였어"}' | python -m json.tool
```
Expected: `success: true`, `data.reply` 에 공감 응답, `is_crisis: false`

- [ ] **Step 3: 위기 메시지 룰베이스 전환 확인**

```bash
curl -s -X POST http://localhost:8000/v1/chat/messages \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"message":"죽고 싶어"}' | python -m json.tool
```
Expected: `is_crisis: true`, `reply`에 1393/1577-0199, `crisis_info.show_hospital_cta: true`

- [ ] **Step 4: 결과를 사용자에게 보고** (게이트웨이 응답 품질/지연 확인). 문제 시 `CHAT_MODEL`/프롬프트 조정 논의.

---

## 모바일

### Task 12: chat 타입 정의

**Files:**
- Create: `mobile/src/types/chat.ts`

- [ ] **Step 1: 타입 작성** (백엔드 `schemas/chat.py`와 1:1, 패턴 출처: `mobile/src/types/diary.ts`)

Create `mobile/src/types/chat.ts`:

```typescript
export interface CrisisInfo {
  lines: string[];
  show_hospital_cta: boolean;
}

export interface ChatMessageRequest {
  message: string;
}

export interface ChatMessageResponse {
  reply: string;
  is_crisis: boolean;
  crisis_info: CrisisInfo | null;
}

export interface MemoryItem {
  content: string;
}

export interface MemoryListResponse {
  memories: MemoryItem[];
}

// 화면 로컬 말풍선 모델
export interface ChatBubble {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  isCrisis?: boolean;
  crisisInfo?: CrisisInfo | null;
}
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: chat.ts 관련 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd mobile && git add src/types/chat.ts
git commit -m "feat(chat): 모바일 챗봇 타입"
```

---

### Task 13: lib/api.ts — chat 도메인 객체

**Files:**
- Modify: `mobile/src/lib/api.ts`

- [ ] **Step 1: import 추가**

`mobile/src/lib/api.ts` 상단의 타입 import 블록에 추가:

```typescript
import type {
  ChatMessageRequest,
  ChatMessageResponse,
  MemoryListResponse,
} from '@/types/chat';
```

> 백엔드 응답은 `SuccessResponse<T>` 래퍼다. 기존 도메인 객체가 `.then(r => r.data)`로 래퍼를 어떻게 벗기는지 확인하고 동일 컨벤션을 따른다. 기존 코드가 `r.data`만 반환한다면 래퍼의 `data` 필드를 한 번 더 꺼내야 할 수 있다 — 같은 파일의 `diary` 객체 반환 타입과 실제 백엔드 응답을 대조해 맞춘다.

- [ ] **Step 2: chat 객체 추가** (패턴 출처: `mobile/src/lib/api.ts:213-237` diary 객체)

`mobile/src/lib/api.ts`의 다른 도메인 객체들 옆에 추가:

```typescript
export const chat = {
  // POST /chat/messages
  send: (p: ChatMessageRequest): Promise<ChatMessageResponse> =>
    api.post('/chat/messages', p).then(r => r.data.data),

  // GET /chat/memories
  memories: (): Promise<MemoryListResponse> =>
    api.get('/chat/memories').then(r => r.data.data),

  // DELETE /chat/memories
  clearMemories: (): Promise<void> =>
    api.delete('/chat/memories').then(() => undefined),
};
```

> `r.data.data`는 axios 응답(`r.data`) → `SuccessResponse.data`를 의미. Step 1에서 확인한 기존 컨벤션이 `r.data`만 쓰면 그에 맞춰 `r.data`로 수정한다.

- [ ] **Step 3: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd mobile && git add src/lib/api.ts
git commit -m "feat(chat): api.ts chat 도메인 객체"
```

---

### Task 14: useChatQueries 훅

**Files:**
- Create: `mobile/src/hooks/useChatQueries.ts`

- [ ] **Step 1: 훅 작성** (패턴 출처: `mobile/src/hooks/useDiaryQueries.ts`)

Create `mobile/src/hooks/useChatQueries.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { chat } from '@/lib/api';
import type { ChatMessageResponse, MemoryListResponse } from '@/types/chat';

export const useSendMessage = () =>
  useMutation<ChatMessageResponse, Error, string>({
    mutationFn: (message: string) => chat.send({ message }),
  });

export const useMemories = () =>
  useQuery<MemoryListResponse, Error>({
    queryKey: ['chat', 'memories'],
    queryFn: chat.memories,
  });

export const useClearMemories = () => {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: chat.clearMemories,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'memories'] }),
  });
};
```

- [ ] **Step 2: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd mobile && git add src/hooks/useChatQueries.ts
git commit -m "feat(chat): useChatQueries 훅"
```

---

### Task 15: ChatScreen UI

**Files:**
- Create: `mobile/src/screens/chat/ChatScreen.tsx`

> 안내 고지를 첫 시스템 말풍선으로 표시. 사용자 메시지는 낙관적으로 즉시 렌더하고, 응답 도착 시 assistant 말풍선 추가. 위기 응답은 강조 스타일 + 병원찾기 배너(외부 지도 딥링크). `react-native`의 `Linking.openURL`로 지도 검색.

- [ ] **Step 1: 화면 작성** (패턴 출처: `DiaryMemoScreen.tsx`의 KeyboardAvoidingView/TopBar/StyleSheet, `tokens.ts`의 palette)

Create `mobile/src/screens/chat/ChatScreen.tsx`:

```typescript
import React from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TopBar } from '@/components/BackHeader';
import { palette, typography } from '@/theme/tokens';
import { useSendMessage } from '@/hooks/useChatQueries';
import type { ChatBubble } from '@/types/chat';

const NOTICE =
  'Bridge 챗봇은 정서적 교감을 위한 도구로, 전문적인 상담이나 진단을 제공하지 않아요.';

// 외부 지도 앱에서 "내 주변 정신건강의학과" 검색
const MAP_QUERY = Platform.select({
  ios: 'http://maps.apple.com/?q=내 주변 정신건강의학과',
  android: 'geo:0,0?q=내 주변 정신건강의학과',
  default: 'https://www.google.com/maps/search/내 주변 정신건강의학과',
})!;

let _id = 0;
const nextId = () => `b${_id++}`;

export default function ChatScreen() {
  const navigation = useNavigation();
  const [bubbles, setBubbles] = React.useState<ChatBubble[]>([
    { id: nextId(), role: 'system', text: NOTICE },
  ]);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef<ScrollView>(null);
  const { mutate, isPending } = useSendMessage();

  const scrollToEnd = () => requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));

  const send = () => {
    const text = input.trim();
    if (!text || isPending) return;
    setBubbles(prev => [...prev, { id: nextId(), role: 'user', text }]);
    setInput('');
    scrollToEnd();
    mutate(text, {
      onSuccess: (res) => {
        setBubbles(prev => [...prev, {
          id: nextId(), role: 'assistant', text: res.reply,
          isCrisis: res.is_crisis, crisisInfo: res.crisis_info,
        }]);
        scrollToEnd();
      },
      onError: () => {
        setBubbles(prev => [...prev, {
          id: nextId(), role: 'assistant',
          text: '지금 잠시 응답이 어려워요. 잠시 후 다시 시도해주세요.',
        }]);
        scrollToEnd();
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TopBar title="마음 대화" onBack={() => navigation.goBack()} />

      <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {bubbles.map(b => (
          <View key={b.id}>
            <Bubble bubble={b} />
            {b.isCrisis && b.crisisInfo?.show_hospital_cta && (
              <Pressable style={s.hospitalBanner} onPress={() => Linking.openURL(MAP_QUERY)}>
                <Text style={s.hospitalTitle}>전문가와 이야기 나눠보고 싶다면</Text>
                <Text style={s.hospitalCta}>내 주변 기관 찾아보기 →</Text>
              </Pressable>
            )}
          </View>
        ))}
        {isPending && <Text style={s.typing}>입력 중…</Text>}
      </ScrollView>

      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="마음을 편히 적어보세요"
          placeholderTextColor={palette.textMuted}
          value={input}
          onChangeText={setInput}
          multiline
          maxLength={1000}
        />
        <Pressable style={[s.sendBtn, (!input.trim() || isPending) && s.sendBtnOff]} onPress={send} disabled={!input.trim() || isPending}>
          <Text style={s.sendText}>전송</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ bubble }: { bubble: ChatBubble }) {
  if (bubble.role === 'system') {
    return (
      <View style={s.noticeWrap}>
        <Text style={s.noticeText}>{bubble.text}</Text>
      </View>
    );
  }
  const isUser = bubble.role === 'user';
  return (
    <View style={[s.row, isUser ? s.rowRight : s.rowLeft]}>
      <View style={[
        s.bubble,
        isUser ? s.bubbleUser : s.bubbleBot,
        bubble.isCrisis && s.bubbleCrisis,
      ]}>
        <Text style={[s.bubbleText, isUser && s.bubbleTextUser]}>{bubble.text}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 24 },
  noticeWrap: { backgroundColor: palette.primaryBgWash, borderRadius: 12, padding: 12, marginBottom: 12 },
  noticeText: { ...typography.caption, color: palette.textCaption, textAlign: 'center' },
  row: { marginBottom: 10, flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUser: { backgroundColor: palette.primary, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderBottomLeftRadius: 4 },
  bubbleCrisis: { borderColor: palette.danger, borderWidth: 1.5, backgroundColor: '#FBE9E9' },
  bubbleText: { ...typography.body, color: palette.textBody },
  bubbleTextUser: { color: palette.textInverse },
  hospitalBanner: { backgroundColor: palette.mintBgWash, borderRadius: 14, padding: 14, marginBottom: 12 },
  hospitalTitle: { ...typography.captionBold, color: palette.mintDeep },
  hospitalCta: { ...typography.bodyBold, color: palette.mintDeep, marginTop: 4 },
  typing: { ...typography.caption, color: palette.textMuted, marginLeft: 8, marginBottom: 8 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: palette.borderSubtle, backgroundColor: palette.surface },
  input: { flex: 1, maxHeight: 120, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: palette.bgAlt, borderRadius: 22, ...typography.body, color: palette.textHeading },
  sendBtn: { height: 44, paddingHorizontal: 18, borderRadius: 22, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  sendBtnOff: { backgroundColor: palette.borderStrong },
  sendText: { ...typography.bodyBold, color: palette.textInverse },
});
```

> `TopBar`의 실제 export 이름/경로(`@/components/BackHeader`)와 `palette`/`typography`의 정확한 키는 Task 사전 조사 결과를 따른다. `typography` 스프레드가 `color`를 포함하면 뒤에서 덮어쓰도록 순서를 유지한다.

- [ ] **Step 2: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
cd mobile && git add src/screens/chat/ChatScreen.tsx
git commit -m "feat(chat): ChatScreen 대화 UI"
```

---

### Task 16: Navigation — Chat 라우트

**Files:**
- Modify: `mobile/src/navigation/Navigation.tsx`

- [ ] **Step 1: RootStackParamList에 라우트 추가** (패턴 출처: `Navigation.tsx:43-61`)

`RootStackParamList`에 추가:

```typescript
  Chat: undefined;
```

- [ ] **Step 2: import + Screen 등록 (main 그룹)**

상단 import에 추가:

```typescript
import ChatScreen from '@/screens/chat/ChatScreen';
```

`user.requires_assessment`가 false인 메인 `Stack.Group` 안(다른 detail screen들 옆)에 추가:

```typescript
            <Stack.Screen name="Chat" component={ChatScreen}/>
```

- [ ] **Step 3: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
cd mobile && git add src/navigation/Navigation.tsx
git commit -m "feat(chat): Chat 라우트 등록"
```

---

### Task 17: HomeScreen 진입점 (말풍선 아이콘)

**Files:**
- Modify: `mobile/src/screens/main/HomeScreen.tsx`

> 알림 종 아이콘(`HomeScreen.tsx:68-77`) 옆에 말풍선 아이콘 버튼을 추가하고 `navigate('Chat')` 한다. 기존 종 버튼과 동일한 40x40 스타일을 재사용한다.

- [ ] **Step 1: navigation 타입/훅 확인**

`HomeScreen`에 이미 `useNavigation`이 있으면 재사용. 없으면 추가:

```typescript
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/Navigation';
...
type Nav = NativeStackNavigationProp<RootStackParamList>;
const navigation = useNavigation<Nav>();
```

- [ ] **Step 2: 말풍선 버튼 추가**

종 아이콘 `Pressable`(`HomeScreen.tsx:68-77`) **앞** 또는 **뒤**에, 같은 컨테이너(헤더 row) 안에 추가. 종 버튼 스타일 `s.notifBtn`을 재사용:

```typescript
<Pressable
  style={s.notifBtn}
  hitSlop={8}
  onPress={() => navigation.navigate('Chat')}
  accessibilityLabel="마음 대화 열기"
>
  <Svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke={palette.textBody} strokeWidth={1.6}>
    <Path d="M3 4h12v8H7l-3 3v-3H3z" strokeLinejoin="round" />
  </Svg>
</Pressable>
```

> 종 아이콘과 말풍선이 한 줄에 나란히 놓이도록, 두 버튼을 감싸는 row 컨테이너가 `flexDirection: 'row'` + `gap`을 갖는지 확인. 없으면 두 Pressable을 `<View style={{ flexDirection:'row', gap:8 }}>`로 감싼다.

- [ ] **Step 3: 타입체크 통과 확인**

Run: `cd mobile && npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 앱 실행 후 진입 확인 (수동)**

Run: `cd mobile && npx expo start` → 시뮬레이터에서 홈 헤더 말풍선 탭 → ChatScreen 진입, 안내 고지 표시, 메시지 전송 시 응답 말풍선 표시 확인.

- [ ] **Step 5: 커밋**

```bash
cd mobile && git add src/screens/main/HomeScreen.tsx
git commit -m "feat(chat): 홈 헤더 챗봇 진입점"
```

---

## 마무리

### Task 18: 전체 검증 + 메모리 갱신

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd backend && python -m pytest -v`
Expected: 전체 PASS

- [ ] **Step 2: 모바일 타입체크 + 린트**

Run: `cd mobile && npx tsc --noEmit && npm run lint`
Expected: 에러 없음 (lint 스크립트가 있을 때)

- [ ] **Step 3: 위기 시나리오 수동 재확인** — 모바일에서 위기 단어 입력 → 위기 말풍선 + 병원찾기 배너 → 지도 딥링크 동작.

- [ ] **Step 4: superpowers:finishing-a-development-branch 스킬로 브랜치 마무리** (PR/머지 결정).

- [ ] **Step 5: 메모리 파일 갱신** — `project_ai_chatbot.md`를 "구현 완료" 상태로 업데이트(남은 검증 항목 기록).

---

## Self-Review (스펙 대조)

- **§2 규제**: 안내 고지(Task 15 `NOTICE`), 시스템 프롬프트 가드레일(Task 9 `_PERSONA`), 출력 검증(Task 3 `is_reply_safe`) ✅
- **§4 데이터 흐름 ①~⑥**: Task 9 `handle_message`가 6단계 모두 구현 ✅
- **§5.1 모듈 경계**: llm_gateway / chat / chat_guard / chat_memory / api / models / schemas 각 1파일 ✅
- **§5.2 엔드포인트**: POST messages, GET/DELETE memories (Task 10) ✅
- **§5.3 ChatMemory**: Task 5, 상한 20 enforce (Task 7 `_enforce_limit`) ✅
- **§5.4 Redis 세션**: Task 6, TTL 갱신/최근 N턴 ✅
- **§5.5 config**: Task 1 ✅
- **§6 다층 방어**: 입력필터(Task 2)/가드레일(Task 9)/출력검증(Task 3) ✅
- **§7 특징 메모리**: 추출 주기·암호화·주입·삭제권 (Task 7, Task 9 ⑥, Task 10 DELETE) ✅
- **§8 모바일**: ChatScreen/hooks/types/api/navigation/진입점 (Task 12~17) ✅
- **§9 테스트**: 위기→LLM미호출, 출력검증 차단, 메모리 위기 제외, 게이트웨이 mock — Task 2/3/4/7/9 ✅
- **§9.2 에러처리**: 게이트웨이 실패 폴백(Task 9), 위기 최우선(Task 9 ①가 게이트웨이보다 앞) ✅
- **§10 비범위**: 스트리밍/원문저장/정적병원DB 미포함 ✅

**미확정(구현 중 해소):** ① `get_db`/`User` import 경로는 기존 라우터에 맞춤(Task 10 노트) ② `SuccessResponse` 언래핑 컨벤션은 기존 api.ts 확인 후 맞춤(Task 13 노트) ③ 게이트웨이 실제 응답 스키마는 OpenAI 호환 가정, Task 11 스모크에서 검증.
