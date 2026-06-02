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


import httpx
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
