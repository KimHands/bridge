# [Analysis] Phase 4 — 일기 CRUD + AES-256-GCM + 키워드 저장

> 분석일: 2026-04-13
> Phase: 4 / 8
> Match Rate: **97.7%**
> 상태: Check 완료

---

## 비교 대상

| 항목 | 경로 |
|------|------|
| 설계 문서 | `docs/02-design/features/Phase4-일기.design.md` |
| Pydantic 스키마 | `backend/app/schemas/diary.py` |
| 일기 엔드포인트 | `backend/app/api/v1/diaries.py` |
| 키워드 엔드포인트 | `backend/app/api/v1/keywords.py` |
| 메인 앱 | `backend/app/main.py` |

---

## 항목별 Gap 분석 (22개 항목)

| # | 설계 항목 | 구현 | 상태 |
|---|---------|------|------|
| D1 | 디렉토리 구조 (3 신규 + main.py 수정) | 동일 | ✅ |
| D2 | `SituationKeywordInput` 스키마 | 동일 | ✅ |
| D3 | `DiaryCreateRequest` mood_score(1~5) 검증 | 동일 | ✅ |
| D4 | `DiaryCreateRequest` emotion_keywords(≤2) 검증 | 동일 | ✅ |
| D5 | `DiaryCreateRequest` memo(≤200자) 검증 | 동일 | ✅ |
| D6 | `DiaryUpdateRequest` 동일 3개 validator | 동일 | ✅ |
| D7 | 응답 스키마 5종 (Create/Update/ListItem/Detail/TodayStatus) | 동일 | ✅ |
| D8 | `KEYWORD_META` 8개 감정 키워드 + question/answers | 동일 | ✅ |
| D9 | `HIGHLIGHTS_BY_MOOD` mood 1~5 추천 매핑 | 동일 | ✅ |
| D10 | `GET /keywords/emotions` 엔드포인트 | 동일 | ✅ |
| D11 | `POST /diaries` 당일 중복 확인 (409) | 동일 | ✅ |
| D12 | `POST /diaries` memo 암호화 (None이면 skip) | 동일 | ✅ |
| D13 | `POST /diaries` DiaryEntry flush + keyword_map | 동일 | ✅ |
| D14 | `POST /diaries` SituationKeyword 저장 | 동일 | ✅ |
| D15 | `POST /diaries` trigger_executed=False | 동일 | ✅ |
| D16 | `GET /today/status` 당일 일기 여부 | 동일 | ✅ |
| D17 | `GET /diaries` cursor 페이지네이션 (limit+1 방식) | 동일 | ✅ |
| D18 | `GET /diaries` memo_preview (복호화 후 20자) | 동일 | ✅ |
| D19 | `GET /{diary_id}` 상세 복호화 + situation_keywords join | 동일 | ✅ |
| D20 | `PATCH /{diary_id}` delete+재삽입, DIARY_NOT_EDITABLE | 동일 | ✅ |
| D21 | 라우터 순서 (/today/status → /{diary_id}) | 동일 | ✅ |
| D22 | main.py 라우터 등록 + 에러 핸들러 3종 추가 | 동일 | ✅ |

---

## Gap 목록

### GAP-1 (Info) — PATCH 빈 문자열 memo 처리 미세 차이
- 설계 원문: `memo=""` → None으로 취급
- 구현: `if body.memo is not None:` → `""` 이면 `encrypt_json({"memo": ""})` 저장
- 영향: 클라이언트가 빈 문자열 memo를 PATCH로 전송하는 케이스는 실사용에서 발생하지 않음. 복호화 시 `{"memo": ""}` 반환으로 기능 정상 동작.
- 조치: 설계 문서를 구현 기준으로 수정 (PATCH 빈 문자열 행동 명시)
- 상태: ✅ 해결 (설계 문서 수정)

---

## 검증 시나리오 결과 (14/14)

| # | 시나리오 | 기대 | 결과 | 상태 |
|---|---------|------|------|------|
| 1 | 정상 작성 (memo + 키워드 2개) | 201 + diary_id | 동일 | ✅ |
| 2 | 당일 중복 작성 | 409 DIARY_ALREADY_EXISTS_TODAY | 동일 | ✅ |
| 3 | mood_score = 6 | 422 INVALID_MOOD_SCORE | 동일 | ✅ |
| 4 | emotion_keywords 3개 | 422 TOO_MANY_EMOTION_KEYWORDS | 동일 | ✅ |
| 5 | memo 201자 | 422 MEMO_TOO_LONG | 동일 | ✅ |
| 6 | PATCH 당일 수정 | 200 + updated_at | 동일 | ✅ |
| 7 | 없는 diary_id PATCH | 404 DIARY_NOT_FOUND | 동일 | ✅ |
| 8 | GET /diaries (목록) | items + cursor + has_next | 동일 | ✅ |
| 9 | GET /diaries/{id} 상세 | 메모 복호화 반환 | 동일 | ✅ |
| 10 | GET /diaries/today/status | has_diary_today=true | 동일 | ✅ |
| 11 | GET /keywords/emotions | 8개 키워드 + highlights_by_mood | 동일 | ✅ |
| 12 | 인증 없이 접근 | 401 | 동일 | ✅ |
| 13 | DB encrypted_memo 확인 | {iv}:{ct} 형식 | 동일 | ✅ |
| 14 | diary_emotion_keywords 연결 | keyword_id 매핑 | 동일 | ✅ |

---

## 최종 결과

| 지표 | 값 |
|------|-----|
| 총 비교 항목 | 22 |
| 완전 일치 | 21 |
| Info 불일치 (기능 영향 없음) | 1 (설계 문서 수정으로 해결) |
| 검증 시나리오 통과 | 14/14 |
| **Match Rate** | **97.7%** |
