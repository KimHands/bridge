# [Plan] Phase 3 — 자가평가 API

> 작성일: 2026-04-13
> Phase: 3 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

PHQ-9 자가평가 제출·조회 API를 구현한다.  
이 Phase가 완료되면 신규 가입 사용자가 자가평가를 완료하고,  
결과에 따라 초기 루틴이 자동 배정되며, AES-256-GCM으로 암호화된 평가 결과가 DB에 저장된다.

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 항목 | 설명 |
|---|------|------|
| 1 | POST /v1/assessments | 자가평가 제출, PHQ-9 채점, 루틴 배정, 암호화 저장 |
| 2 | GET /v1/assessments | 자가평가 이력 조회 |
| 3 | AES-256-GCM 암호화 유틸 | `core/encryption.py` — 평가 결과 암호화/복호화 |
| 4 | 루틴 시드 데이터 | PRD 3.3.4 기준 루틴 라이브러리 삽입 |
| 5 | 초기 루틴 배정 로직 | PHQ-9 구간 × 주원인 조합으로 `user_routines` 삽입 |
| 6 | Pydantic 스키마 | `schemas/assessment.py` |

### 제외 (Out of Scope)

- 일기 CRUD (Phase 4)
- 루틴 관리 API — 추가·삭제·완료 (Phase 6)
- 트리거 알고리즘 (Phase 5)
- 리포트·미션 (Phase 7·8)

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 POST /v1/assessments

- **인증**: 필요 (`get_current_user`)
- **요청**: `phq9_answers` (int[9], 각 0~3), `primary_cause` (string), `secondary_cause` (string, nullable)
- **유효성 검사**:
  - `phq9_answers` 길이 정확히 9, 각 값 0~3 범위
  - `primary_cause` 허용 코드: sleep / academic / future / financial / relationship / physical / unknown
  - `secondary_cause` nullable, 제공 시 허용 코드 동일 검증
- **서버 처리 순서**:
  1. `phq9_score` = phq9_answers 합산 (0~27)
  2. `phq_tier` 판정: 0~4 → 1구간, 5~9 → 2구간, 10~19 → 3구간, 20~27 → 4구간
  3. `phq9_answers[8] >= 1` 이면 `needs_professional_flag = True` (서버 저장, 클라이언트에 전달)
  4. AES-256-GCM으로 `{"answers": phq9_answers, "score": phq9_score, "flag": needs_professional_flag}` 암호화
  5. `assessments` 테이블에 저장 (`encrypted_result`, `phq_tier`)
  6. `phq_tier` × `primary_cause` 조합으로 `routines` 테이블에서 루틴 조회
  7. `user_routines` 에 `source="initial"` 로 삽입
- **응답 201**: assessment_id, phq9_score, phq9_level(=phq_tier), primary_cause, assigned_routines 목록
- **에러**: `INVALID_PHQ9_ANSWERS`, `INVALID_CAUSE_CODE`

### 3.2 GET /v1/assessments

- **인증**: 필요
- **응답 200**: 해당 사용자의 자가평가 이력 목록 (최신순)
  - 항목: assessment_id, phq9_score, phq9_level, primary_cause, taken_at
  - 복호화 없음 — `encrypted_result` 에서 score·tier는 별도 컬럼 불필요 (phq_tier는 이미 평문 컬럼으로 존재)
  - `phq9_score`는 encrypted_result 복호화해서 반환

### 3.3 AES-256-GCM 암호화

- 라이브러리: `cryptography` (이미 requirements.txt에 포함)
- `ENCRYPTION_KEY` 환경 변수 (32바이트 hex 문자열)
- 암호화 출력 형식: `{base64(iv)}:{base64(ciphertext)}:{base64(tag)}`
- `core/encryption.py` 에 `encrypt_json`, `decrypt_json` 구현

### 3.4 루틴 시드 데이터

PRD 3.3.4의 루틴 매핑 테이블 기준으로 `routines` 테이블에 데이터 삽입.

- `target_keywords`: 주원인 코드 (예: `["sleep"]`, `["academic"]`)
- `phq_tier_min` / `phq_tier_max`: 해당 루틴이 배정되는 구간 범위
- 초기 루틴 배정 로직: `phq_tier` 조건 + `primary_cause ∈ target_keywords` 로 필터

---

## 4. 보안 요구사항

| 요구사항 | 상세 |
|---------|------|
| 평가 결과 암호화 | AES-256-GCM, IV 매 요청마다 랜덤 생성 |
| PHQ-9 수치 미노출 | 응답에 `phq9_score` 수치 포함하되 구간명("중등도 우울" 등) 절대 미사용 |
| 9번 문항 플래그 | DB에만 저장, 클라이언트에 `needs_professional_flag` 전달 (수치 미노출) |
| 인증 필수 | 모든 엔드포인트 `get_current_user` 의존성 |

---

## 5. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | POST /v1/assessments: phq9_answers 9개, 0~3 범위 검증 통과 |
| ☐ | POST /v1/assessments: phq_tier 구간 판정 정확 (0→1구간, 5→2구간, 10→3구간, 20→4구간) |
| ☐ | POST /v1/assessments: assessments 테이블에 암호화된 결과 저장 확인 |
| ☐ | POST /v1/assessments: user_routines에 source="initial"로 루틴 배정 확인 |
| ☐ | POST /v1/assessments: 응답에 assigned_routines 포함 |
| ☐ | GET /v1/assessments: 이력 목록 정상 반환 |
| ☐ | 잘못된 phq9_answers → 422 INVALID_PHQ9_ANSWERS |
| ☐ | 잘못된 cause 코드 → 422 INVALID_CAUSE_CODE |
| ☐ | 인증 없이 접근 → 401 |

---

## 6. 구현 순서 (Implementation Order)

```
1. app/core/encryption.py          — AES-256-GCM encrypt_json / decrypt_json
2. app/schemas/assessment.py       — 요청/응답 Pydantic 스키마
3. app/seeds/routines.py           — 루틴 라이브러리 시드 데이터
4. app/main.py                     — lifespan에 루틴 시드 추가
5. app/api/v1/assessments.py       — POST + GET 엔드포인트
6. app/main.py                     — /v1/assessments 라우터 등록
7. 완료 기준 검증 (Swagger UI + curl)
```

---

## 7. 새로운 파일 목록

```
backend/app/
├── core/
│   └── encryption.py              # 신규: AES-256-GCM 유틸
├── schemas/
│   └── assessment.py              # 신규: 요청/응답 스키마
├── seeds/
│   └── routines.py                # 신규: 루틴 라이브러리 시드
└── api/v1/
    └── assessments.py             # 신규: 자가평가 라우터
```

수정 파일:
- `app/main.py` — 루틴 시드 추가, assessments 라우터 등록

---

## 8. 의존성

```
# 기존 requirements.txt에 모두 포함됨
cryptography==42.0.7    # AES-256-GCM
sqlalchemy[asyncio]     # DB ORM
```

추가 패키지 없음.

---

## 9. 리스크

| 리스크 | 대응 |
|--------|------|
| AES-256-GCM IV 재사용 | `os.urandom(12)` 매 호출마다 생성 |
| routines 시드 중복 삽입 | `seed_routines` 함수에서 존재 여부 확인 후 건너뜀 |
| 루틴 매핑 누락 | PRD 3.3.4 표 전체 커버 (4구간은 원인 무관 단일 루틴) |
| phq9_score GET 응답 시 복호화 비용 | 이력 조회 항목 수가 적으므로 허용 범위 |

---

## 참고 문서

- `docs/Bridge_API_명세서.md` — 3. 자가평가 Assessment 섹션
- `docs/Bridge_PRD.md` — 3.3 AI 자가평가, 3.3.4 초기 루틴 배정
- `CLAUDE.md` — PHQ-9 구간별 초기 루틴 배정 원칙, 보안 필수 규칙
