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
