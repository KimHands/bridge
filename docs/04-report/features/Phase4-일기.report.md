# [Report] Phase 4 — 일기 CRUD + AES-256-GCM 암호화 + 키워드 저장 완료 보고서

> 보고서 작성일: 2026-04-13
> Phase: 4 / 8
> Match Rate: **97.7%**
> 상태: **완료**

---

## 1. 요약

일기 작성·수정·목록·상세·오늘 상태 조회 API(5개)와 감정 키워드 목록 API(1개)를 설계대로 완전히 구현하고 검증했다.  
메모는 AES-256-GCM으로 암호화 저장하고, 감정 키워드·세부 답변을 diary_emotion_keywords / situation_keywords 테이블에 연결한다.  
14개 검증 시나리오 전량 통과, Match Rate 97.7% 달성.

---

## 2. PDCA 사이클 요약

| 단계 | 결과 |
|------|------|
| Plan | 6개 엔드포인트 목표·범위·완료 기준 수립 |
| Design | 스키마 10종, 엔드포인트 5개, 키워드 메타 하드코딩, 라우터 순서 명시 |
| Do | 3개 신규 파일 + main.py 수정, 14개 시나리오 통과 |
| Check | Match Rate 97.7%, Gap 1건 (Info — 설계 문서 수정으로 해결) |

---

## 3. 구현 완료 목록

### 3.1 신규 파일

| 파일 | 역할 |
|------|------|
| `app/schemas/diary.py` | Pydantic 스키마 10종 (요청 2 + 응답 5 + 공통 3) |
| `app/api/v1/diaries.py` | 일기 5개 엔드포인트 |
| `app/api/v1/keywords.py` | 감정 키워드 목록 엔드포인트 |

### 3.2 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| `app/main.py` | diaries·keywords 라우터 등록, 에러 핸들러 3종 추가 (`INVALID_MOOD_SCORE`, `TOO_MANY_EMOTION_KEYWORDS`, `MEMO_TOO_LONG`) |

---

## 4. 핵심 기술 결정 사항

### 4.1 라우터 충돌 방지
- FastAPI는 라우터를 정의 순서대로 매칭
- `GET /today/status`를 `GET /{diary_id}` 보다 먼저 정의 → "today"가 UUID로 파싱되는 충돌 방지
- 정의 순서: `POST ""` → `GET /today/status` → `GET ""` → `GET /{diary_id}` → `PATCH /{diary_id}`

### 4.2 메모 암호화
- Phase 3의 `encryption.py` 재사용 (`encrypt_json`, `decrypt_json`)
- 저장 형식: `encrypt_json({"memo": memo})` → `{iv}:{ciphertext+tag}`
- `memo=None`이면 `encrypted_memo=None` (암호화 건너뜀)
- 목록 조회 시 `memo[:20]`으로 preview 제공

### 4.3 cursor 페이지네이션
- `limit+1`개 조회 → `has_next` 판별
- `cursor`는 마지막 항목의 `created_at` ISO 8601 문자열
- 다음 페이지 요청: `created_at < cursor_dt` 조건 적용

### 4.4 감정 키워드 설계
- DB에 question/answers 컬럼 없음 → `keywords.py`에 하드코딩 (DB 확장 불필요)
- negative 6개(우울한·무기력한·불안한·초조한·짜증나는·외로운) + positive 2개(뿌듯한·평온한)
- `highlights_by_mood`: mood 1~5별 추천 키워드 매핑

### 4.5 PATCH 처리 전략
- `emotion_keywords`가 변경될 때 `diary_emotion_keywords` + `situation_keywords` 전체 삭제 후 재삽입
- `mood_score`, `memo`는 독립적으로 업데이트 (emotion_keywords 변경 없어도 가능)
- `trigger_executed`: Phase 5에서 실제 구현 예정, 현재 `False` 반환

---

## 5. 보안 요구사항 달성

| 요구사항 | 구현 | 상태 |
|---------|------|------|
| 메모 AES-256-GCM 암호화 | `encrypt_json({"memo": memo})` — Phase 3 모듈 재사용 | ✅ |
| 본인 소유 확인 | `diary.user_id != current_user.id` → 403 UNAUTHORIZED | ✅ |
| 당일 수정만 허용 | `diary.recorded_date != date.today()` → 403 DIARY_NOT_EDITABLE | ✅ |
| 인증 필수 | 모든 일기 엔드포인트 `get_current_user` Depends 적용 | ✅ |

---

## 6. 검증 시나리오 결과 (14/14)

| # | 시나리오 | 기대 | 결과 |
|---|---------|------|------|
| 1 | 정상 작성 (memo + 키워드 2개) | 201 + diary_id | ✅ |
| 2 | 당일 중복 작성 | 409 DIARY_ALREADY_EXISTS_TODAY | ✅ |
| 3 | mood_score = 6 | 422 INVALID_MOOD_SCORE | ✅ |
| 4 | emotion_keywords 3개 | 422 TOO_MANY_EMOTION_KEYWORDS | ✅ |
| 5 | memo 201자 | 422 MEMO_TOO_LONG | ✅ |
| 6 | PATCH 당일 수정 | 200 + updated_at | ✅ |
| 7 | 없는 diary_id | 404 DIARY_NOT_FOUND | ✅ |
| 8 | GET /diaries (목록) | items + cursor + has_next | ✅ |
| 9 | GET /diaries/{id} (상세) | memo 복호화 + situation_keywords | ✅ |
| 10 | GET /diaries/today/status | has_diary_today=true | ✅ |
| 11 | GET /keywords/emotions | 8개 키워드 + highlights_by_mood | ✅ |
| 12 | 인증 없이 접근 | 401 | ✅ |
| 13 | DB encrypted_memo 확인 | {iv}:{ct} 형식 | ✅ |
| 14 | diary_emotion_keywords 연결 | keyword_id 매핑 정상 | ✅ |

---

## 7. Gap 분석 결과

| Gap | 내용 | 영향 | 조치 |
|-----|------|------|------|
| GAP-1 | PATCH `memo=""` 처리 방식 (None vs 빈 memo 암호화) | 없음 | 설계 문서 수정 |

**최종 Match Rate: 97.7%** (기준 90% 초과)

---

## 8. 누적 Phase 진행 현황

| Phase | 내용 | Match Rate |
|-------|------|-----------|
| Phase 1 | Docker + DB 스키마 + 시드 | 97.8% |
| Phase 2 | Auth Service (JWT) | 98.2% |
| Phase 3 | 자가평가 API + 루틴 배정 | 97.0% |
| **Phase 4** | **일기 CRUD + 키워드** | **97.7%** |

---

## 9. 다음 Phase 예고

**Phase 5: routine_trigger.py + 비동기 실행**

| 구현 항목 | 설명 |
|---------|------|
| `routine_trigger.py` | 최근 7일 일기 분석, 트리거 점수 계산 |
| 트리거 조건 | 동일 감정 키워드 3회 이상, 쿨다운 3일 |
| 비동기 실행 | `POST /diaries` 후 `BackgroundTasks`로 호출 |
| `trigger_logs` 기록 | 트리거 발동 이력 + `cooldown_until` |
| `user_routines` 갱신 | `source="trigger"` 로 새 루틴 삽입 |

Phase 4에서 준비한 `trigger_executed` 필드를 Phase 5에서 실제로 채움.
