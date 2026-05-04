from pydantic import BaseModel, field_validator


class SituationKeywordInput(BaseModel):
    emotion_keyword: str
    answer: str


class DiaryCreateRequest(BaseModel):
    mood_score: int
    emotion_keywords: list[str]
    situation_keywords: list[SituationKeywordInput] = []
    memo: str | None = None

    @field_validator("mood_score")
    @classmethod
    def validate_mood_score(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("mood_score는 1~5 사이여야 합니다")
        return v

    @field_validator("emotion_keywords")
    @classmethod
    def validate_emotion_keywords(cls, v: list[str]) -> list[str]:
        if len(v) > 2:
            raise ValueError("감정 키워드는 최대 2개까지 선택 가능합니다")
        return v

    @field_validator("memo")
    @classmethod
    def validate_memo(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("메모는 200자를 초과할 수 없습니다")
        return v


class DiaryUpdateRequest(BaseModel):
    mood_score: int | None = None
    emotion_keywords: list[str] | None = None
    situation_keywords: list[SituationKeywordInput] | None = None
    memo: str | None = None

    @field_validator("mood_score")
    @classmethod
    def validate_mood_score(cls, v: int | None) -> int | None:
        if v is not None and not 1 <= v <= 5:
            raise ValueError("mood_score는 1~5 사이여야 합니다")
        return v

    @field_validator("emotion_keywords")
    @classmethod
    def validate_emotion_keywords(cls, v: list[str] | None) -> list[str] | None:
        if v is not None and len(v) > 2:
            raise ValueError("감정 키워드는 최대 2개까지 선택 가능합니다")
        return v

    @field_validator("memo")
    @classmethod
    def validate_memo(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("메모는 200자를 초과할 수 없습니다")
        return v


class SituationKeywordOutput(BaseModel):
    emotion_keyword: str
    answer: str


class DiaryCreateResponse(BaseModel):
    diary_id: str
    mood_score: int
    emotion_keywords: list[str]
    situation_keywords: list[SituationKeywordOutput]
    created_at: str
    trigger_executed: bool


class DiaryUpdateResponse(BaseModel):
    diary_id: str
    updated_at: str


class DiaryListItem(BaseModel):
    diary_id: str
    mood_score: int
    emotion_keywords: list[str]
    memo_preview: str | None
    created_at: str


class DiaryListResponse(BaseModel):
    items: list[DiaryListItem]
    cursor: str | None
    has_next: bool


class DiaryDetailResponse(BaseModel):
    diary_id: str
    mood_score: int
    emotion_keywords: list[str]
    situation_keywords: list[SituationKeywordOutput]
    memo: str | None
    created_at: str


class TodayStatusResponse(BaseModel):
    has_diary_today: bool
    diary_id: str | None
    mood_score: int | None
