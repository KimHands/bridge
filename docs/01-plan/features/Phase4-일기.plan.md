# [Plan] Phase 4 — 일기 CRUD + AES-256-GCM 암호화 + 키워드 저장

> 작성일: 2026-04-13
> Phase: 4 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

일기 작성·수정·목록·상세·오늘 상태 조회 API와 감정 키워드 목록 API를 구현한다.  
메모는 AES-256-GCM으로 암호화하여 저장하고, 감정 키워드·세부 답변을 DB에 연결한다.  
일기 작성 후 트리거 알고리즘 호출 구조를 준비한다 (트리거 실행 자체는 Phase 5).

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 항목 | 설명 |
|---|------|------|
| 1 | POST /v1/diaries | 일기 작성, 당일 중복 방지, 메모 암호화, 키워드 저장, 트리거 호출 자리(stub) |
| 2 | PATCH /v1/diaries/{diary_id} | 당일 일기 수정 (당일만 허용) |
| 3 | GET /v1/diaries | 일기 목록 커서 페이지네이션 |
| 4 | GET /v1/diaries/{diary_id} | 일기 상세 조회 + 메모 복호화 |
| 5 | GET /v1/diaries/today/status | 오늘 일기 작성 여부 확인 |
| 6 | GET /v1/keywords/emotions | 감정 키워드 목록 + mood 기준 추천 목록 |
| 7 | Pydantic 스키마 | `schemas/diary.py` |

### 제외 (Out of Scope)

- 트리거 알고리즘 실행 로직 (Phase 5 — `routine_trigger.py`)
- 루틴 관리 API (Phase 6)
- 리포트·미션 API (Phase 7·8)

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 POST /v1/diaries

- **인증**: 필요
- **요청 필드**:
  - `mood_score`: int, 1~5 (필수)
  - `emotion_keywords`: string[], 최대 2개 (필수)
  - `situation_keywords`: `[{emotion_keyword: str, answer: str}]` (선택)
  - `memo`: string, 최대 200자 (선택), AES-256-GCM 암호화 저장
- **서버 처리 순서**:
  1. 당일 일기 존재 여부 확인 (`diary_entries.recorded_date == 오늘`) → 중복 시 409
  2. `emotion_keywords` 이름으로 `emotion_keywords` 테이블에서 `id` 조회
  3. `diary_entries` 저장 (`mood_score`, `encrypted_memo`, `recorded_date=오늘`)
  4. `diary_emotion_keywords` 저장 (diary_id × keyword_id)
  5. `situation_keywords` 저장 (diary_id, keyword_id, answer_text)
  6. 트리거 호출 자리: 현재 Phase에서는 `trigger_executed=False` 반환 (Phase 5에서 실제 구현)
- **응답 201**: diary_id, mood_score, emotion_keywords, situation_keywords, created_at, trigger_executed

### 3.2 PATCH /v1/diaries/{diary_id}

- **인증**: 필요
- **조건**: `recorded_date == 오늘` 이 아닌 경우 403 `DIARY_NOT_EDITABLE`
- **본인 소유 확인**: `diary.user_id != current_user.id` → 403 `UNAUTHORIZED`
- **처리**:
  1. 기존 `diary_emotion_keywords`, `situation_keywords` 삭제 후 재삽입
  2. memo 변경 시 재암호화
  3. `diary_entries` 업데이트
- **응답 200**: diary_id, updated_at

### 3.3 GET /v1/diaries (목록)

- **인증**: 필요
- **Query**: `cursor` (ISO datetime string), `limit` (기본 20, 최대 50)
- **커서 페이지네이션**: `created_at < cursor` 조건으로 최신순
- **응답 필드**: diary_id, mood_score, emotion_keywords(이름 목록), memo_preview(앞 20자), created_at
- **cursor 반환**: 마지막 항목의 created_at, has_next 여부

### 3.4 GET /v1/diaries/{diary_id} (상세)

- **인증**: 필요
- **본인 소유 확인**: 403 `UNAUTHORIZED`
- **메모 복호화**: `decrypt_json` → `{"memo": str}` 형식으로 저장했다가 반환
- **응답**: diary_id, mood_score, emotion_keywords, situation_keywords, memo, created_at

### 3.5 GET /v1/diaries/today/status

- **인증**: 필요
- **응답**: has_diary_today (bool), diary_id (nullable), mood_score (nullable)

### 3.6 GET /v1/keywords/emotions

- **인증**: 불필요
- **응답**: keywords 목록 + highlights_by_mood 매핑
- **keywords 항목**: name, category(negative/positive), question, answers[]
  - question·answers는 하드코딩 (DB 확장 없음)

---

## 4. 데이터 모델 (기존 테이블 활용)

```
diary_entries
  id              UUID PK
  user_id         UUID FK → users.id (CASCADE)
  mood_score      SmallInt (1~5)
  encrypted_memo  Text nullable    ← AES-256-GCM {iv}:{ciphertext+tag}
  recorded_date   Date             ← UNIQUE(user_id, recorded_date)
  created_at, updated_at

diary_emotion_keywords
  diary_id    UUID FK (CASCADE)
  keyword_id  Int  FK
  PK(diary_id, keyword_id)

situation_keywords
  id          UUID PK
  diary_id    UUID FK (CASCADE)
  keyword_id  Int  FK
  answer_text String(100)
  created_at, updated_at

emotion_keywords (기존 시드 완료)
  id    Int PK
  name  String(20)  ← "우울한", "불안한" 등 8개
  description String(100)
```

---

## 5. 보안 요구사항

| 요구사항 | 상세 |
|---------|------|
| 메모 암호화 | AES-256-GCM (Phase 3의 `encryption.py` 재사용), memo가 None이면 암호화 건너뜀 |
| 본인 소유 확인 | PATCH / GET 상세에서 `diary.user_id != current_user.id` 시 403 |
| 당일 수정만 허용 | `recorded_date != 오늘` 시 403 DIARY_NOT_EDITABLE |

---

## 6. 에러 코드 매핑

| 코드 | HTTP | 발생 조건 |
|------|------|---------|
| `DIARY_ALREADY_EXISTS_TODAY` | 409 | 당일 일기 중복 작성 |
| `INVALID_MOOD_SCORE` | 422 | mood_score 1~5 범위 초과 |
| `TOO_MANY_EMOTION_KEYWORDS` | 422 | emotion_keywords 3개 이상 |
| `MEMO_TOO_LONG` | 422 | memo 200자 초과 |
| `DIARY_NOT_FOUND` | 404 | 존재하지 않는 diary_id |
| `DIARY_NOT_EDITABLE` | 403 | 당일 작성분 아닌 수정 시도 |
| `UNAUTHORIZED` | 403 | 본인 일기가 아닌 경우 |

---

## 7. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | POST /v1/diaries: 정상 작성, encrypted_memo DB 저장, diary_emotion_keywords 연결 |
| ☐ | POST /v1/diaries: 당일 중복 → 409 DIARY_ALREADY_EXISTS_TODAY |
| ☐ | POST /v1/diaries: mood_score 범위 초과 → 422 INVALID_MOOD_SCORE |
| ☐ | POST /v1/diaries: emotion_keywords 3개 이상 → 422 TOO_MANY_EMOTION_KEYWORDS |
| ☐ | POST /v1/diaries: memo 200자 초과 → 422 MEMO_TOO_LONG |
| ☐ | PATCH /v1/diaries/{id}: 당일 수정 성공 |
| ☐ | PATCH /v1/diaries/{id}: 전일 수정 → 403 DIARY_NOT_EDITABLE |
| ☐ | GET /v1/diaries: 커서 페이지네이션 목록 반환 |
| ☐ | GET /v1/diaries/{id}: 메모 복호화 후 반환 |
| ☐ | GET /v1/diaries/today/status: has_diary_today 정확히 반환 |
| ☐ | GET /v1/keywords/emotions: 키워드 8개 + highlights_by_mood 반환 |
| ☐ | 인증 없이 접근 → 401 |

---

## 8. 구현 순서 (Implementation Order)

```
1. app/schemas/diary.py              — Pydantic 스키마
2. app/api/v1/diaries.py             — 5개 엔드포인트
3. app/api/v1/keywords.py            — 감정 키워드 목록
4. app/main.py                       — 두 라우터 등록 + 에러 코드 핸들러 추가
5. 검증 시나리오 실행 (curl)
```

---

## 9. 신규/수정 파일

```
backend/app/
├── schemas/
│   └── diary.py           # 신규: Pydantic 스키마
└── api/v1/
    ├── diaries.py          # 신규: 일기 5개 엔드포인트
    └── keywords.py         # 신규: 감정 키워드 목록

# 수정
app/main.py                # diaries·keywords 라우터 등록, 에러 핸들러 추가
```

---

## 10. 의존성

```
# 기존 그대로 — 추가 패키지 없음
app/core/encryption.py    # Phase 3에서 구현 완료 (재사용)
app/models/diary.py       # Phase 1에서 이미 정의
app/models/keyword.py     # Phase 1에서 이미 정의
```

---

## 11. 리스크

| 리스크 | 대응 |
|--------|------|
| memo=None일 때 암호화 시도 | `encrypted_memo = encrypt_json({"memo": memo}) if memo else None` |
| 커서 페이지네이션 타임존 오류 | UTC 기준으로 통일, `cursor`는 ISO datetime (UTC) |
| `today/status` 경로 충돌 | `GET /diaries/today/status`를 `GET /diaries/{diary_id}` 보다 먼저 라우터 등록 |
| situation_keywords의 keyword_id 조회 실패 | emotion_keyword 이름으로 조회 후 없으면 무시 (유연한 처리) |

---

## 참고 문서

- `docs/Bridge_API_명세서.md` — 4. 일기 Diary, 5. 키워드 Keywords 섹션
- `docs/Bridge_PRD.md` — 5. 감정 일기
- `CLAUDE.md` — 일기 메모 AES-256-GCM 암호화 필수 규칙
