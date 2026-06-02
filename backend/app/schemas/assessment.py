from pydantic import BaseModel, field_validator

VALID_CAUSE_CODES = {
    "sleep", "academic", "future", "financial",
    "relationship", "physical", "unknown",
}


class AssessmentRequest(BaseModel):
    phq9_answers: list[int]
    primary_cause: str
    secondary_cause: str | None = None

    @field_validator("phq9_answers")
    @classmethod
    def validate_phq9(cls, v: list[int]) -> list[int]:
        if len(v) != 9:
            raise ValueError("PHQ-9 응답은 정확히 9개여야 합니다")
        if not all(0 <= x <= 3 for x in v):
            raise ValueError("각 응답은 0~3 사이여야 합니다")
        return v

    @field_validator("primary_cause")
    @classmethod
    def validate_primary_cause(cls, v: str) -> str:
        if v not in VALID_CAUSE_CODES:
            raise ValueError(f"유효하지 않은 원인 코드: {v}")
        return v

    @field_validator("secondary_cause", mode="before")
    @classmethod
    def validate_secondary_cause(cls, v) -> str | None:
        if v is not None and v not in VALID_CAUSE_CODES:
            raise ValueError(f"유효하지 않은 원인 코드: {v}")
        return v


class AssignedRoutineItem(BaseModel):
    routine_id: int
    title: str
    category: str


# 데이터 최소화: PHQ-9 원점수(phq9_score)는 응답에 싣지 않는다(CLAUDE.md 점수 비노출).
# 정성 문구 매핑에 필요한 구간 식별자(phq9_level)만 전달한다.
class AssessmentResponse(BaseModel):
    assessment_id: str
    phq9_level: int
    primary_cause: str
    needs_professional_flag: bool
    assigned_routines: list[AssignedRoutineItem]


class AssessmentHistoryItem(BaseModel):
    assessment_id: str
    phq9_level: int
    primary_cause: str
    needs_professional_flag: bool = False
    taken_at: str
