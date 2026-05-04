# [Design] Phase 3 — 자가평가 API

> 작성일: 2026-04-13
> Phase: 3 / 8
> 상태: Design
> 참조: `docs/01-plan/features/Phase3-자가평가.plan.md`

---

## 1. 디렉토리 구조 (추가분)

```
backend/app/
├── core/
│   └── encryption.py          # 신규: AES-256-GCM 암호화/복호화
├── schemas/
│   └── assessment.py          # 신규: 요청/응답 스키마
├── seeds/
│   └── routines.py            # 신규: 루틴 라이브러리 시드
└── api/v1/
    └── assessments.py         # 신규: 자가평가 라우터

# 수정
app/main.py                    # 루틴 시드 추가 + assessments 라우터 등록
```

---

## 2. AES-256-GCM 암호화 유틸 (`app/core/encryption.py`)

```python
import base64
import json
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings


def _get_key() -> bytes:
    """ENCRYPTION_KEY 환경 변수를 base64 디코딩하여 32바이트 키 반환"""
    return base64.b64decode(settings.encryption_key)


def encrypt_json(data: dict) -> str:
    """
    dict → JSON → AES-256-GCM 암호화
    출력 형식: "{base64(iv)}:{base64(ciphertext+tag)}"
    """
    key = _get_key()
    iv = os.urandom(12)          # 96비트 IV (GCM 권장)
    aesgcm = AESGCM(key)
    plaintext = json.dumps(data, ensure_ascii=False).encode()
    ciphertext = aesgcm.encrypt(iv, plaintext, None)  # tag 자동 포함(마지막 16바이트)

    iv_b64 = base64.b64encode(iv).decode()
    ct_b64 = base64.b64encode(ciphertext).decode()
    return f"{iv_b64}:{ct_b64}"


def decrypt_json(encrypted: str) -> dict:
    """
    "{base64(iv)}:{base64(ciphertext+tag)}" → dict
    """
    key = _get_key()
    iv_b64, ct_b64 = encrypted.split(":", 1)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ct_b64)
    aesgcm = AESGCM(key)
    plaintext = aesgcm.decrypt(iv, ciphertext, None)
    return json.loads(plaintext.decode())
```

---

## 3. Pydantic 스키마 설계 (`app/schemas/assessment.py`)

```python
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
    category: str   # target_keywords[0] 또는 "general"


class AssessmentResponse(BaseModel):
    assessment_id: str
    phq9_score: int
    phq9_level: int             # phq_tier (1~4)
    primary_cause: str
    needs_professional_flag: bool
    assigned_routines: list[AssignedRoutineItem]


class AssessmentHistoryItem(BaseModel):
    assessment_id: str
    phq9_score: int
    phq9_level: int
    primary_cause: str
    taken_at: str               # ISO 8601
```

---

## 4. 루틴 시드 데이터 설계 (`app/seeds/routines.py`)

### 4.1 데이터 구조

```python
ROUTINE_SEEDS = [
    # ── 1구간 전용 ──────────────────────────────────────────
    {"title": "취침 전 스트레칭 10분",       "description": "잠들기 전 10분 가벼운 스트레칭",
     "target_keywords": ["sleep"],          "phq_tier_min": 1, "phq_tier_max": 1},

    {"title": "하루 10분 산책",              "description": "가벼운 야외 산책 10분",
     "target_keywords": ["academic", "financial", "relationship", "unknown"],
     "phq_tier_min": 1, "phq_tier_max": 1},

    {"title": "오늘 잘한 일 1가지 적기",     "description": "오늘 한 것 중 잘한 일 하나를 적어보세요",
     "target_keywords": ["future"],         "phq_tier_min": 1, "phq_tier_max": 1},

    {"title": "10분 독서",                   "description": "관심 있는 책 10분 읽기",
     "target_keywords": ["future"],         "phq_tier_min": 1, "phq_tier_max": 1},

    {"title": "가벼운 스트레칭 10분",        "description": "몸을 부드럽게 풀어주는 스트레칭",
     "target_keywords": ["physical"],       "phq_tier_min": 1, "phq_tier_max": 1},

    {"title": "물 2L 마시기",               "description": "하루 종일 물 2L 채우기",
     "target_keywords": ["physical"],       "phq_tier_min": 1, "phq_tier_max": 1},

    # ── 1·2구간 공통 ──────────────────────────────────────
    {"title": "감정 일기 작성",              "description": "오늘 느낀 감정을 짧게 일기로 기록하기",
     "target_keywords": ["sleep", "academic", "financial", "relationship", "unknown"],
     "phq_tier_min": 1, "phq_tier_max": 2},

    {"title": "10분 혼자 산책",              "description": "혼자 조용히 10분 걷기",
     "target_keywords": ["relationship"],   "phq_tier_min": 1, "phq_tier_max": 2},

    # ── 2구간 전용 ──────────────────────────────────────────
    {"title": "취침 전 4-7-8 호흡 5분",     "description": "4초 들이쉬고 7초 참고 8초 내쉬기, 5분 반복",
     "target_keywords": ["sleep"],          "phq_tier_min": 2, "phq_tier_max": 2},

    {"title": "오늘 할 일 1가지만 적기",     "description": "내일 꼭 해야 할 일 딱 하나만 적기",
     "target_keywords": ["academic"],       "phq_tier_min": 2, "phq_tier_max": 3},

    {"title": "5분 마음 챙김 호흡",          "description": "숨에 집중하며 5분 마음 챙김 호흡",
     "target_keywords": ["academic"],       "phq_tier_min": 2, "phq_tier_max": 2},

    {"title": "오늘 할 수 있는 일 1가지 적기", "description": "오늘 실제로 할 수 있는 작은 일 하나 적기",
     "target_keywords": ["future"],         "phq_tier_min": 2, "phq_tier_max": 2},

    {"title": "5분 호흡 명상",               "description": "편안한 자세로 5분 호흡에 집중하기",
     "target_keywords": ["future", "financial"], "phq_tier_min": 2, "phq_tier_max": 2},

    {"title": "가벼운 스트레칭 5분",         "description": "5분 부드러운 전신 스트레칭",
     "target_keywords": ["physical"],       "phq_tier_min": 2, "phq_tier_max": 2},

    {"title": "물 충분히 마시기",            "description": "하루에 충분한 물 마시기",
     "target_keywords": ["physical"],       "phq_tier_min": 2, "phq_tier_max": 2},

    # ── 3구간 전용 ──────────────────────────────────────────
    {"title": "2분 복식호흡",               "description": "배를 이용한 깊은 복식호흡 2분",
     "target_keywords": ["sleep", "future", "financial", "unknown"],
     "phq_tier_min": 3, "phq_tier_max": 3},

    {"title": "감정 일기 한 줄 작성",        "description": "오늘 감정 딱 한 줄만 적기",
     "target_keywords": ["relationship"],   "phq_tier_min": 3, "phq_tier_max": 3},

    {"title": "물 한 잔 마시기",            "description": "지금 바로 물 한 잔 마시기",
     "target_keywords": ["physical"],       "phq_tier_min": 3, "phq_tier_max": 3},

    # ── 4구간 전용 (원인 무관 고정) ───────────────────────
    {"title": "물 한 잔 마시기", "description": "지금 바로 물 한 잔 마시기",
     "target_keywords": [],  "phq_tier_min": 4, "phq_tier_max": 4},
]
```

### 4.2 시드 함수

```python
async def seed_routines(db: AsyncSession) -> None:
    result = await db.execute(select(Routine))
    if result.scalars().first():
        return  # 이미 존재하면 skip

    for data in ROUTINE_SEEDS:
        db.add(Routine(**data))
    await db.commit()
```

---

## 5. 엔드포인트 설계 (`app/api/v1/assessments.py`)

### 5.1 PHQ-9 구간 판정 함수

```python
def _calculate_phq_tier(score: int) -> int:
    if score <= 4:   return 1
    if score <= 9:   return 2
    if score <= 19:  return 3
    return 4
```

### 5.2 POST /v1/assessments 흐름

```
1. AssessmentRequest 유효성 검사 (Pydantic)
2. phq9_score = sum(body.phq9_answers)
3. phq_tier = calculate_phq_tier(phq9_score)
4. needs_professional_flag = (body.phq9_answers[8] >= 1)
5. encrypted = encrypt_json({
       "answers": body.phq9_answers,
       "score": phq9_score,
       "flag": needs_professional_flag,
       "primary_cause": body.primary_cause,
   })
6. Assessment 저장 (encrypted_result, phq_tier)
7. 루틴 조회:
   - phq_tier == 4: target_keywords == [] 조건으로 조회 LIMIT 1
   - 그 외: phq_tier_min <= tier <= phq_tier_max
             AND primary_cause == ANY(target_keywords) LIMIT 2
8. user_routines에 source="initial"로 삽입 (assigned_at=now)
9. 201 + AssessmentResponse 반환
```

### 5.3 GET /v1/assessments 흐름

```
1. get_current_user 인증
2. assessments 테이블에서 user_id 기준 최신순 조회
3. 각 행의 encrypted_result 복호화 → phq9_score 추출
4. AssessmentHistoryItem 목록 반환
```

### 5.4 에러 코드 매핑

| 에러 코드 | 발생 조건 | HTTP |
|---------|---------|------|
| `INVALID_PHQ9_ANSWERS` | 배열 길이 ≠ 9 또는 값 범위 초과 | 422 |
| `INVALID_CAUSE_CODE` | cause 코드 허용 목록 외 | 422 |

> Pydantic `field_validator`에서 `ValueError` 발생 → Phase 2에서 구현한 `RequestValidationError` 핸들러가 자동으로 커스텀 코드로 변환

---

## 6. main.py 수정 내용

```python
# 추가할 import
from app.api.v1 import assessments as assessments_router
from app.seeds.routines import seed_routines

# lifespan에 추가
async with AsyncSessionLocal() as db:
    await seed_emotion_keywords(db)
    await seed_routines(db)

# 라우터 등록
app.include_router(assessments_router.router, prefix="/v1")
```

---

## 7. Assessment 모델 확인 (기존 그대로 사용)

```
assessments 테이블:
  id              UUID PK
  user_id         UUID FK → users.id (CASCADE)
  encrypted_result Text   ← AES-256-GCM 암호화된 JSON
  phq_tier        SmallInt (1~4)
  created_at      DateTime
  updated_at      DateTime
```

`phq9_score`는 `encrypted_result` 복호화로만 접근 (DB 평문 저장 금지).

---

## 8. 루틴 배정 쿼리 상세

```python
from sqlalchemy import any_, func

# 4구간: 원인 무관 고정 루틴
if phq_tier == 4:
    stmt = (
        select(Routine)
        .where(Routine.phq_tier_min == 4, Routine.phq_tier_max == 4)
        .limit(1)
    )
else:
    stmt = (
        select(Routine)
        .where(
            Routine.phq_tier_min <= phq_tier,
            Routine.phq_tier_max >= phq_tier,
            primary_cause == any_(Routine.target_keywords),
        )
        .limit(2)
    )
```

---

## 9. 구현 순서 (체크리스트)

```
[ ] 1. app/core/encryption.py
[ ] 2. app/schemas/assessment.py
[ ] 3. app/seeds/routines.py
[ ] 4. app/main.py — seed_routines 추가
[ ] 5. app/api/v1/assessments.py
[ ] 6. app/main.py — assessments 라우터 등록
[ ] 7. 검증 시나리오 실행
```

---

## 10. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | 정상 제출 (tier 2, sleep) | 201, 루틴 2개 배정 |
| 2 | 정상 제출 (tier 4) | 201, 루틴 1개 ("물 한 잔") 배정 |
| 3 | phq9_answers 8개 | 422 INVALID_PHQ9_ANSWERS |
| 4 | 값 4 초과 (예: 5) | 422 INVALID_PHQ9_ANSWERS |
| 5 | 잘못된 cause 코드 | 422 INVALID_CAUSE_CODE |
| 6 | 9번 문항 = 1 | needs_professional_flag: true |
| 7 | GET /assessments | 200, 이력 목록 반환 |
| 8 | 인증 없이 접근 | 401 |
| 9 | DB 저장 확인 | encrypted_result 암호화, phq_tier 평문 |
| 10 | user_routines 확인 | source="initial", is_active=true |
