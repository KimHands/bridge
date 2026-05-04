# [Design] Phase 4 — 일기 CRUD + AES-256-GCM 암호화 + 키워드 저장

> 작성일: 2026-04-13
> Phase: 4 / 8
> 상태: Design
> 참조: `docs/01-plan/features/Phase4-일기.plan.md`

---

## 1. 디렉토리 구조 (추가분)

```
backend/app/
├── schemas/
│   └── diary.py               # 신규: 요청/응답 Pydantic 스키마
└── api/v1/
    ├── diaries.py              # 신규: 일기 5개 엔드포인트
    └── keywords.py             # 신규: 감정 키워드 목록

# 수정
app/main.py                    # diaries·keywords 라우터 등록 + 에러 핸들러 추가
```

---

## 2. Pydantic 스키마 설계 (`app/schemas/diary.py`)

```python
from datetime import datetime
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
    memo_preview: str | None   # 복호화 후 앞 20자
    created_at: str


class DiaryListResponse(BaseModel):
    items: list[DiaryListItem]
    cursor: str | None         # 마지막 항목의 created_at (ISO 8601)
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
```

---

## 3. 일기 엔드포인트 설계 (`app/api/v1/diaries.py`)

### 3.1 Import 목록

```python
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import decrypt_json, encrypt_json
from app.dependencies.auth import get_current_user
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword, SituationKeyword
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.diary import (
    DiaryCreateRequest, DiaryCreateResponse,
    DiaryDetailResponse, DiaryListItem, DiaryListResponse,
    DiaryUpdateRequest, DiaryUpdateResponse,
    SituationKeywordOutput, TodayStatusResponse,
)

router = APIRouter(prefix="/diaries", tags=["diaries"])
```

### 3.2 POST /v1/diaries

```
처리 순서:
1. 오늘 날짜(UTC) 기준 당일 일기 존재 여부 확인 → 409 DIARY_ALREADY_EXISTS_TODAY
2. memo 있으면 encrypt_json({"memo": memo}), 없으면 None
3. DiaryEntry 저장 (flush로 id 확보)
4. emotion_keywords 이름 → id 조회 (EmotionKeyword.name.in_())
5. DiaryEmotionKeyword 삽입 (diary_id × keyword_id)
6. situation_keywords 삽입 (keyword_id는 emotion_keywords 조회 결과 매핑)
7. commit + refresh
8. trigger_executed=False 반환 (Phase 5에서 실제 구현)
```

```python
@router.post("", status_code=201, response_model=SuccessResponse[DiaryCreateResponse])
async def create_diary(
    body: DiaryCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    result = await db.execute(
        select(DiaryEntry).where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date == today,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "DIARY_ALREADY_EXISTS_TODAY", "message": "오늘 일기는 이미 작성되었습니다"},
        )

    encrypted_memo = encrypt_json({"memo": body.memo}) if body.memo else None

    diary = DiaryEntry(
        user_id=current_user.id,
        mood_score=body.mood_score,
        encrypted_memo=encrypted_memo,
        recorded_date=today,
    )
    db.add(diary)
    await db.flush()

    # 감정 키워드 id 매핑
    keyword_map: dict[str, int] = {}
    if body.emotion_keywords:
        kw_result = await db.execute(
            select(EmotionKeyword).where(EmotionKeyword.name.in_(body.emotion_keywords))
        )
        for kw in kw_result.scalars().all():
            keyword_map[kw.name] = kw.id
            db.add(DiaryEmotionKeyword(diary_id=diary.id, keyword_id=kw.id))

    # 세부 키워드 답변 저장
    for sk in body.situation_keywords:
        kw_id = keyword_map.get(sk.emotion_keyword)
        if kw_id:
            db.add(SituationKeyword(
                diary_id=diary.id,
                keyword_id=kw_id,
                answer_text=sk.answer,
            ))

    await db.commit()
    await db.refresh(diary)

    return {
        "success": True,
        "data": DiaryCreateResponse(
            diary_id=str(diary.id),
            mood_score=diary.mood_score,
            emotion_keywords=body.emotion_keywords,
            situation_keywords=[
                SituationKeywordOutput(emotion_keyword=sk.emotion_keyword, answer=sk.answer)
                for sk in body.situation_keywords
            ],
            created_at=diary.created_at.isoformat(),
            trigger_executed=False,
        ),
        "message": "ok",
    }
```

### 3.3 GET /v1/diaries/today/status

> **주의**: FastAPI 라우터에서 `/{diary_id}` 보다 먼저 정의해야 충돌 없음

```python
@router.get("/today/status", response_model=SuccessResponse[TodayStatusResponse])
async def get_today_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    result = await db.execute(
        select(DiaryEntry).where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date == today,
        )
    )
    diary = result.scalar_one_or_none()

    return {
        "success": True,
        "data": TodayStatusResponse(
            has_diary_today=diary is not None,
            diary_id=str(diary.id) if diary else None,
            mood_score=diary.mood_score if diary else None,
        ),
        "message": "ok",
    }
```

### 3.4 GET /v1/diaries (목록 — 커서 페이지네이션)

```python
@router.get("", response_model=SuccessResponse[DiaryListResponse])
async def list_diaries(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 50)

    stmt = (
        select(DiaryEntry)
        .where(DiaryEntry.user_id == current_user.id)
        .order_by(DiaryEntry.created_at.desc())
        .limit(limit + 1)   # has_next 판별용으로 1개 더 조회
    )
    if cursor:
        cursor_dt = datetime.fromisoformat(cursor)
        stmt = stmt.where(DiaryEntry.created_at < cursor_dt)

    result = await db.execute(stmt)
    entries = result.scalars().all()

    has_next = len(entries) > limit
    entries = entries[:limit]

    # 감정 키워드 일괄 조회
    items = []
    for e in entries:
        kw_result = await db.execute(
            select(EmotionKeyword)
            .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
            .where(DiaryEmotionKeyword.diary_id == e.id)
        )
        kw_names = [kw.name for kw in kw_result.scalars().all()]

        memo_preview = None
        if e.encrypted_memo:
            try:
                memo = decrypt_json(e.encrypted_memo).get("memo", "")
                memo_preview = memo[:20] if memo else None
            except Exception:
                memo_preview = None

        items.append(DiaryListItem(
            diary_id=str(e.id),
            mood_score=e.mood_score,
            emotion_keywords=kw_names,
            memo_preview=memo_preview,
            created_at=e.created_at.isoformat(),
        ))

    next_cursor = entries[-1].created_at.isoformat() if has_next and entries else None

    return {
        "success": True,
        "data": DiaryListResponse(items=items, cursor=next_cursor, has_next=has_next),
        "message": "ok",
    }
```

### 3.5 GET /v1/diaries/{diary_id} (상세)

```python
@router.get("/{diary_id}", response_model=SuccessResponse[DiaryDetailResponse])
async def get_diary(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == uuid.UUID(diary_id))
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(404, detail={"code": "DIARY_NOT_FOUND", "message": "존재하지 않는 일기입니다"})
    if diary.user_id != current_user.id:
        raise HTTPException(403, detail={"code": "UNAUTHORIZED", "message": "본인의 일기만 조회할 수 있습니다"})

    # 감정 키워드
    kw_result = await db.execute(
        select(EmotionKeyword)
        .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
        .where(DiaryEmotionKeyword.diary_id == diary.id)
    )
    kw_names = [kw.name for kw in kw_result.scalars().all()]

    # 세부 답변
    sk_result = await db.execute(
        select(SituationKeyword, EmotionKeyword)
        .join(EmotionKeyword, EmotionKeyword.id == SituationKeyword.keyword_id)
        .where(SituationKeyword.diary_id == diary.id)
    )
    situation_keywords = [
        SituationKeywordOutput(emotion_keyword=ek.name, answer=sk.answer_text)
        for sk, ek in sk_result.all()
    ]

    # 메모 복호화
    memo = None
    if diary.encrypted_memo:
        memo = decrypt_json(diary.encrypted_memo).get("memo")

    return {
        "success": True,
        "data": DiaryDetailResponse(
            diary_id=str(diary.id),
            mood_score=diary.mood_score,
            emotion_keywords=kw_names,
            situation_keywords=situation_keywords,
            memo=memo,
            created_at=diary.created_at.isoformat(),
        ),
        "message": "ok",
    }
```

### 3.6 PATCH /v1/diaries/{diary_id}

```python
@router.patch("/{diary_id}", response_model=SuccessResponse[DiaryUpdateResponse])
async def update_diary(
    diary_id: str,
    body: DiaryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == uuid.UUID(diary_id))
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(404, detail={"code": "DIARY_NOT_FOUND", "message": "존재하지 않는 일기입니다"})
    if diary.user_id != current_user.id:
        raise HTTPException(403, detail={"code": "UNAUTHORIZED", "message": "본인의 일기만 수정할 수 있습니다"})
    if diary.recorded_date != date.today():
        raise HTTPException(403, detail={"code": "DIARY_NOT_EDITABLE", "message": "당일 작성 일기만 수정할 수 있습니다"})

    if body.mood_score is not None:
        diary.mood_score = body.mood_score
    if body.memo is not None:
        diary.encrypted_memo = encrypt_json({"memo": body.memo})

    if body.emotion_keywords is not None:
        await db.execute(delete(DiaryEmotionKeyword).where(DiaryEmotionKeyword.diary_id == diary.id))
        await db.execute(delete(SituationKeyword).where(SituationKeyword.diary_id == diary.id))

        kw_result = await db.execute(
            select(EmotionKeyword).where(EmotionKeyword.name.in_(body.emotion_keywords))
        )
        keyword_map: dict[str, int] = {kw.name: kw.id for kw in kw_result.scalars().all()}
        for name in body.emotion_keywords:
            if name in keyword_map:
                db.add(DiaryEmotionKeyword(diary_id=diary.id, keyword_id=keyword_map[name]))

        if body.situation_keywords:
            for sk in body.situation_keywords:
                kw_id = keyword_map.get(sk.emotion_keyword)
                if kw_id:
                    db.add(SituationKeyword(
                        diary_id=diary.id,
                        keyword_id=kw_id,
                        answer_text=sk.answer,
                    ))

    await db.commit()
    await db.refresh(diary)

    return {
        "success": True,
        "data": DiaryUpdateResponse(
            diary_id=str(diary.id),
            updated_at=diary.updated_at.isoformat(),
        ),
        "message": "ok",
    }
```

---

## 4. 감정 키워드 엔드포인트 (`app/api/v1/keywords.py`)

### 4.1 키워드 정의 (하드코딩)

```python
KEYWORD_META = {
    "우울한":   {"category": "negative", "question": "지금 가장 힘든 게 뭔가요?",
                 "answers": ["아무것도 하기 싫고 의욕이 없어요", "나 자신이 쓸모없다는 느낌이 들어요",
                             "미래가 막막하고 희망이 없어요", "이유를 모르겠어요"]},
    "무기력한": {"category": "negative", "question": "무기력함이 느껴질 때 어떤 상황인가요?",
                 "answers": ["몸이 너무 피곤해요", "아무것도 하기 싫어요",
                             "의욕이 전혀 없어요", "그냥 다 귀찮아요"]},
    "불안한":   {"category": "negative", "question": "무엇 때문에 불안한가요?",
                 "answers": ["미래나 진로가 불확실해요", "인간관계가 걱정돼요",
                             "경제적으로 걱정이 많아요", "뭔가 나쁜 일이 일어날 것 같아요"]},
    "초조한":   {"category": "negative", "question": "무엇이 초조하게 만드나요?",
                 "answers": ["해야 할 일이 너무 많아요", "시간이 부족해요",
                             "결과가 나쁠까봐 걱정돼요", "주변 기대가 부담돼요"]},
    "짜증나는": {"category": "negative", "question": "어떤 상황이 짜증나게 했나요?",
                 "answers": ["사람들과 갈등이 있었어요", "일이 뜻대로 안 됐어요",
                             "피곤한데 쉬지 못했어요", "별거 아닌 것에 예민해졌어요"]},
    "외로운":   {"category": "negative", "question": "외로움이 느껴진 이유가 있나요?",
                 "answers": ["혼자 있는 시간이 너무 길었어요", "주변에 이해받지 못하는 것 같아요",
                             "친한 사람과 연락이 뜸해졌어요", "그냥 혼자인 게 싫어요"]},
    "뿌듯한":   {"category": "positive", "question": "오늘 어떤 일이 뿌듯했나요?",
                 "answers": ["목표한 걸 해냈어요", "다른 사람을 도왔어요",
                             "오래 미뤘던 걸 했어요", "그냥 하루를 잘 보낸 것 같아요"]},
    "평온한":   {"category": "positive", "question": "오늘 무엇이 마음을 편안하게 했나요?",
                 "answers": ["좋아하는 걸 하며 보냈어요", "조용히 혼자 있었어요",
                             "자연이나 산책을 즐겼어요", "아무 걱정 없이 쉬었어요"]},
}

HIGHLIGHTS_BY_MOOD = {
    "1": ["우울한", "무기력한"],
    "2": ["불안한", "외로운"],
    "3": ["초조한", "짜증나는"],
    "4": ["평온한", "뿌듯한"],
    "5": ["뿌듯한", "평온한"],
}
```

### 4.2 GET /v1/keywords/emotions

```python
from fastapi import APIRouter
from app.schemas.auth import SuccessResponse

router = APIRouter(prefix="/keywords", tags=["keywords"])


@router.get("/emotions", response_model=SuccessResponse[dict])
async def get_emotion_keywords():
    keywords = [
        {
            "name": name,
            "category": meta["category"],
            "question": meta["question"],
            "answers": meta["answers"],
        }
        for name, meta in KEYWORD_META.items()
    ]
    return {
        "success": True,
        "data": {
            "keywords": keywords,
            "highlights_by_mood": HIGHLIGHTS_BY_MOOD,
        },
        "message": "ok",
    }
```

---

## 5. main.py 수정 내용

### 5.1 라우터 등록

```python
from app.api.v1 import diaries as diaries_router
from app.api.v1 import keywords as keywords_router

app.include_router(diaries_router.router, prefix="/v1")
app.include_router(keywords_router.router, prefix="/v1")
```

### 5.2 ValidationError 핸들러 추가

```python
# 기존 if-elif 체인에 추가
elif field == "mood_score":
    code = "INVALID_MOOD_SCORE"
    message = raw_msg
elif field == "emotion_keywords":
    code = "TOO_MANY_EMOTION_KEYWORDS"
    message = raw_msg
elif field == "memo":
    code = "MEMO_TOO_LONG"
    message = raw_msg
```

> 기존 `error_type == "missing"` 조건이 가장 위에 있어야 함 (Phase 2 GAP-3 수정 완료)

---

## 6. 라우터 등록 순서 (충돌 방지)

`diaries.py` 내부에서 함수 정의 순서:

```
1. POST   ""                  create_diary
2. GET    "/today/status"     get_today_status   ← /{diary_id} 보다 반드시 먼저
3. GET    ""                  list_diaries
4. GET    "/{diary_id}"       get_diary
5. PATCH  "/{diary_id}"       update_diary
```

---

## 7. 메모 암호화/복호화 규칙

| 상황 | 처리 |
|------|------|
| memo = None | `encrypted_memo = None` (암호화 건너뜀) |
| memo = "" (빈 문자열) | 빈 문자열도 None으로 취급 |
| 저장 형식 | `encrypt_json({"memo": memo})` → `{iv}:{ciphertext+tag}` |
| 복호화 | `decrypt_json(encrypted_memo).get("memo")` |
| 목록 preview | 복호화 후 `memo[:20]` |
| PATCH 빈 문자열 | `memo=""` 이면 `encrypt_json({"memo": ""})` 저장 (None 아님) |

---

## 8. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | 정상 작성 (memo + 키워드 2개) | 201, diary_id 반환 |
| 2 | 당일 중복 작성 | 409 DIARY_ALREADY_EXISTS_TODAY |
| 3 | mood_score = 6 | 422 INVALID_MOOD_SCORE |
| 4 | emotion_keywords 3개 | 422 TOO_MANY_EMOTION_KEYWORDS |
| 5 | memo 201자 | 422 MEMO_TOO_LONG |
| 6 | PATCH 당일 수정 | 200, updated_at 반환 |
| 7 | PATCH 전일 수정 | 403 DIARY_NOT_EDITABLE |
| 8 | GET /diaries (목록) | 200, items + cursor |
| 9 | GET /diaries/{id} (상세) | 200, memo 복호화 반환 |
| 10 | GET /diaries/today/status | 200, has_diary_today=true |
| 11 | GET /keywords/emotions | 200, 8개 키워드 + highlights_by_mood |
| 12 | 인증 없이 접근 | 401 |
| 13 | DB: encrypted_memo 암호화 저장 확인 | {iv}:{ct} 형식 |
| 14 | DB: diary_emotion_keywords 연결 확인 | keyword_id 매핑 |

---

## 9. 구현 순서 (체크리스트)

```
[ ] 1. app/schemas/diary.py
[ ] 2. app/api/v1/keywords.py
[ ] 3. app/api/v1/diaries.py  (today/status → list → detail → patch 순 정의)
[ ] 4. app/main.py — 라우터 등록 + 에러 핸들러 추가
[ ] 5. 검증 시나리오 실행
```
