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
