# [Report] Phase 6 — 루틴 관리 API 완료 보고서

> 보고서 작성일: 2026-04-13
> Phase: 6 / 8
> Match Rate: **100%**
> 상태: **완료**

---

## 1. 요약

사용자 루틴 조회·추가·완료·삭제 API 4개를 구현했다.
루틴 완료 시 `routine_logs`에 기록하여 Phase 7(리포트)·Phase 8(미션) 집계의 데이터 기반을 마련했다.
11개 검증 시나리오 전량 통과, Match Rate 100% 달성.

---

## 2. PDCA 사이클 요약

| 단계 | 결과 |
|------|------|
| Plan | 4개 엔드포인트 목표·범위·완료 기준 수립, category/difficulty_level 제외 결정 |
| Design | 스키마 6종, 엔드포인트 4개 전체 코드 설계, 라우터 순서 명시 |
| Do | 2개 신규 파일 + main.py 수정, 11개 시나리오 통과 |
| Check | Match Rate 100%, Gap 0건 |

---

## 3. 구현 완료 목록

### 3.1 신규 파일

| 파일 | 역할 |
|------|------|
| `app/schemas/routine.py` | Pydantic 스키마 6종 |
| `app/api/v1/routines.py` | 루틴 4개 엔드포인트 |

### 3.2 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| `app/main.py` | routines 라우터 등록 |

---

## 4. 핵심 기술 결정 사항

### 4.1 라우터 순서 (Phase 4 교훈 반복 적용)

```
GET  /routines/me          ← 먼저 정의 (Phase 4 /today/status 패턴 동일)
POST /routines/me          ← 먼저 정의
PATCH /{user_routine_id}/complete
DELETE /{user_routine_id}
```

### 4.2 소프트 삭제 전략

`DELETE /routines/{id}`: 물리 삭제 대신 `is_active=False` 업데이트.
`routine_logs` 기록이 보존되어 Phase 7·8 집계 시 데이터 무결성 유지.

### 4.3 `category`, `difficulty_level` 제외

`routines` 테이블에 해당 컬럼 없음 → 응답에서 제외.
Phase 6 범위에서 DB 스키마 변경 없이 구현 완료.

### 4.4 에러 코드 체계

| 코드 | HTTP | 상황 |
|------|------|------|
| `ROUTINE_NOT_FOUND` | 404 | 존재하지 않는 routines.id |
| `USER_ROUTINE_NOT_FOUND` | 404 | 존재하지 않는 user_routines.id |
| `ROUTINE_ALREADY_ASSIGNED` | 409 | 이미 is_active=True인 동일 루틴 |
| `ROUTINE_ALREADY_COMPLETED_TODAY` | 409 | 오늘 이미 완료 처리됨 |
| `UNAUTHORIZED` | 403 | 본인 소유 아님 |

---

## 5. 검증 시나리오 결과 (11/11)

| # | 시나리오 | 결과 |
|---|---------|------|
| 1 | GET /routines/me — 활성 루틴 + is_completed_today | ✅ |
| 2 | POST /routines/me — source="manual" 추가 | ✅ |
| 3 | POST 중복 → 409 ROUTINE_ALREADY_ASSIGNED | ✅ |
| 4 | POST 없는 루틴 → 404 ROUTINE_NOT_FOUND | ✅ |
| 5 | PATCH complete — routine_logs 삽입 | ✅ |
| 6 | PATCH 오늘 재완료 → 409 ROUTINE_ALREADY_COMPLETED_TODAY | ✅ |
| 7 | PATCH 타인 루틴 → 403 UNAUTHORIZED | ✅ |
| 8 | GET /me 완료 후 — is_completed_today=true | ✅ |
| 9 | DELETE — is_active=False | ✅ |
| 10 | DELETE 후 GET /me — 해당 루틴 미반환 | ✅ |
| 11 | 인증 없이 접근 → 401 | ✅ |

---

## 6. Gap 분석 결과

Gap 없음.

**최종 Match Rate: 100%**

---

## 7. 누적 Phase 진행 현황

| Phase | 내용 | Match Rate |
|-------|------|-----------|
| Phase 1 | Docker + DB 스키마 + 시드 | 97.8% |
| Phase 2 | Auth Service (JWT) | 98.2% |
| Phase 3 | 자가평가 API + 루틴 배정 | 97.0% |
| Phase 4 | 일기 CRUD + 키워드 | 97.7% |
| Phase 5 | routine_trigger.py + 비동기 실행 | 97.9% |
| **Phase 6** | **루틴 관리 API** | **100%** |

---

## 8. 다음 Phase 예고

**Phase 7: 리포트 집계 API + 주간 배치 스케줄러**

| 구현 항목 | 설명 |
|---------|------|
| `GET /reports/weekly` | 주간 루틴 달성률 + 감정 키워드 통계 |
| `GET /reports/monthly` | 월간 mood_score 트렌드 + 루틴 완료 수 |
| APScheduler | 주간 미션 점수 자동 집계 배치 |
