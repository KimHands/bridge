# [Report] Phase 3 — 자가평가 API 완료 보고서

> 보고서 작성일: 2026-04-13
> Phase: 3 / 8
> Match Rate: **97.0%**
> 상태: **완료**

---

## 1. 요약

PHQ-9 자가평가 API(POST/GET /v1/assessments)를 설계대로 완전히 구현하고 검증했다.  
신규 가입 사용자가 자가평가를 제출하면 PHQ-9 구간을 판정하여 초기 루틴을 자동 배정하고,  
평가 결과를 AES-256-GCM으로 암호화하여 DB에 저장한다.  
10개 검증 시나리오 전량 통과, Gap 분석 Match Rate 97.0% 달성.

---

## 2. PDCA 사이클 요약

| 단계 | 결과 |
|------|------|
| Plan | 목표·범위·완료 기준 수립 |
| Design | AES-256-GCM 유틸, 스키마, 시드 데이터, 엔드포인트 설계 |
| Do | 6개 파일 신규/수정 구현, 10개 시나리오 통과 |
| Check | Match Rate 97.0%, Gap 2건 (설계 문서 수정으로 해결) |

---

## 3. 구현 완료 목록

### 3.1 신규 파일

| 파일 | 역할 |
|------|------|
| `app/core/encryption.py` | AES-256-GCM `encrypt_json` / `decrypt_json` |
| `app/schemas/assessment.py` | Pydantic 스키마 (Request / Response / HistoryItem) |
| `app/seeds/routines.py` | 루틴 라이브러리 시드 19개 |
| `app/api/v1/assessments.py` | POST + GET 엔드포인트 |

### 3.2 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| `app/main.py` | lifespan에 `seed_routines` 추가, assessments 라우터 등록, 에러 코드 핸들러 (`INVALID_PHQ9_ANSWERS`, `INVALID_CAUSE_CODE`) 추가 |
| `app/api/v1/auth.py` | 로그인 `requires_assessment` 조회 버그 수정 (`scalar_one_or_none` → `.limit(1).scalars().first()`) |

---

## 4. 핵심 기술 결정 사항

### 4.1 AES-256-GCM 구현
- **IV**: `os.urandom(12)` — 매 요청마다 독립적인 96비트 IV 생성
- **저장 형식**: `"{base64(iv)}:{base64(ciphertext+tag)}"` — GCM 인증 태그가 ciphertext에 자동 포함
- **키 관리**: `ENCRYPTION_KEY` 환경 변수 → base64 디코딩 후 32바이트 사용
- **플랜 문서 표기**: `{iv}:{ciphertext}:{tag}` (3부분) → 실제 AESGCM 라이브러리 특성상 `{iv}:{ciphertext+tag}` (2부분)으로 구현, 기능 동일

### 4.2 루틴 배정 쿼리
- **tier 1~3**: `phq_tier_min <= tier <= phq_tier_max AND primary_cause == any_(target_keywords)` LIMIT 2
- **tier 4**: `phq_tier_min == 4 AND phq_tier_max == 4` LIMIT 1 (원인 무관 고정 루틴)
- SQLAlchemy `any_()` 함수로 PostgreSQL 배열 컬럼 검색 처리

### 4.3 PHQ-9 구간 판정
```python
def _calculate_phq_tier(score: int) -> int:
    if score <= 4:   return 1   # 0~4점: 1구간
    if score <= 9:   return 2   # 5~9점: 2구간
    if score <= 19:  return 3   # 10~19점: 3구간
    return 4                    # 20~27점: 4구간
```

### 4.4 전문가 상담 플래그
- `phq9_answers[8] >= 1` 조건으로 서버에서 판정
- DB 및 API 응답에 `needs_professional_flag: bool`로 전달
- 수치(PHQ-9 점수) 노출, 구간명("중등도 우울" 등) 절대 미사용 — 규제 준수

---

## 5. 보안 요구사항 달성

| 요구사항 | 구현 | 상태 |
|---------|------|------|
| 평가 결과 AES-256-GCM 암호화 | `encrypt_json()` — 매 요청 랜덤 IV | ✅ |
| PHQ-9 수치 미구간명 노출 | `phq9_level` 정수값만 반환, 구간명 없음 | ✅ |
| 9번 문항 플래그 | `needs_professional_flag: bool` 전달, 수치 미노출 | ✅ |
| 인증 필수 | `get_current_user` Depends 적용 | ✅ |
| DB 평문 저장 금지 | `phq9_score`는 암호화 필드에만 저장 | ✅ |

---

## 6. 검증 시나리오 결과 (10/10)

| # | 시나리오 | 기대 | 결과 |
|---|---------|------|------|
| 1 | 정상 제출 (tier 2, sleep, 5점) | 201 + 루틴 2개 | ✅ 감정일기+4-7-8호흡 |
| 2 | tier 4 제출 (21점) | 201 + 루틴 1개 | ✅ 물 한 잔 마시기 |
| 3 | phq9_answers 8개 | 422 INVALID_PHQ9_ANSWERS | ✅ |
| 4 | 값 4 포함 | 422 INVALID_PHQ9_ANSWERS | ✅ |
| 5 | 잘못된 cause 코드 | 422 INVALID_CAUSE_CODE | ✅ |
| 6 | answers[8] = 1 | needs_professional_flag: true | ✅ |
| 7 | GET /assessments | 이력 목록 최신순 | ✅ 3건 반환 |
| 8 | 인증 없이 접근 | 401 | ✅ |
| 9 | DB 암호화 확인 | IV:ciphertext 형식 | ✅ |
| 10 | user_routines 확인 | source="initial", is_active=true | ✅ |

---

## 7. Gap 분석 결과

| Gap | 내용 | 영향 | 조치 |
|-----|------|------|------|
| GAP-1 | tier 4 루틴 title 괄호 표기 차이 | 없음 | 설계 문서 수정 |
| GAP-2 | `calculate_phq_tier` vs `_calculate_phq_tier` | 없음 | 설계 문서 수정 |

**최종 Match Rate: 97.0%** (기준 90% 초과)

---

## 8. 루틴 시드 데이터 현황 (19개)

| 구간 | 루틴 수 | 대표 루틴 |
|------|---------|---------|
| 1구간 전용 | 6개 | 취침 전 스트레칭, 하루 10분 산책, 감사 일기 등 |
| 1·2구간 공통 | 2개 | 감정 일기 작성, 10분 혼자 산책 |
| 2구간 전용 | 7개 | 4-7-8 호흡, 마음 챙김 호흡, 호흡 명상 등 |
| 3구간 전용 | 3개 | 2분 복식호흡, 감정 일기 한 줄, 물 한 잔 |
| 4구간 고정 | 1개 | 물 한 잔 마시기 (원인 무관) |

---

## 9. 다음 Phase 예고

**Phase 4: 일기 CRUD + AES-256-GCM 암호화 + 키워드 저장**

| 구현 항목 | 설명 |
|---------|------|
| POST /v1/diaries | 일기 작성, mood_score + 메모 암호화 저장 |
| GET /v1/diaries | 일기 목록 조회 (최신순) |
| PATCH /v1/diaries/:id | 일기 수정 |
| GET /v1/keywords/emotions | 감정 키워드 목록 조회 |
| 감정 키워드 연결 | diary_emotion_keywords 다대다 저장 |
| 세부 질문 저장 | situation_keywords 테이블 저장 |

기존 `app/core/encryption.py` 재사용 가능. `emoji_keywords` 시드 데이터는 Phase 1에서 이미 완료.
