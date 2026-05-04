# [Plan] Phase 6 — 루틴 관리 API

> 작성일: 2026-04-13
> Phase: 6 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

사용자가 자신의 루틴을 조회·추가·완료·삭제할 수 있는 REST API 4개를 구현한다.  
루틴 완료 시 `routine_logs`에 기록하여 Phase 7(리포트)·Phase 8(미션) 집계의 데이터 기반을 마련한다.

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 엔드포인트 | 설명 |
|---|-----------|------|
| 1 | `GET /routines/me` | 내 활성 루틴 목록 + 오늘 완료 여부 |
| 2 | `PATCH /routines/{user_routine_id}/complete` | 루틴 완료 처리 + routine_logs 기록 |
| 3 | `POST /routines/me` | 루틴 수동 추가 (source="manual") |
| 4 | `DELETE /routines/{user_routine_id}` | 루틴 비활성화 (is_active=False) |

### 제외 (Out of Scope)

- `GET /routines/library` (6.5) — Phase 7·8 이후 필요 시 추가
- `PATCH /routines/me/order` (6.6) — 순서 변경 (프론트 우선순위 낮음)
- `category`, `difficulty_level` 필드 — `routines` 테이블에 해당 컬럼 없음, 이 Phase에서 추가하지 않음

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 `GET /routines/me`

- `user_routines.is_active = True` 인 모든 루틴 반환
- `is_completed_today`: `routine_logs`에 오늘 날짜 레코드가 있으면 `true`
- `source` 필드 그대로 반환 (`initial` / `trigger` / `manual`)

```
Response 200:
{
  "routines": [
    {
      "user_routine_id": "uuid",
      "routine_id": int,
      "title": "취침 전 4-7-8 호흡 5분",
      "description": "...",
      "source": "initial",
      "is_completed_today": false,
      "assigned_at": "ISO8601"
    }
  ]
}
```

### 3.2 `PATCH /routines/{user_routine_id}/complete`

- Request: `{"completed": true}` (false 처리는 추후 확장)
- 본인 소유 확인 (403 UNAUTHORIZED)
- `routine_logs`에 오늘 날짜로 중복 체크 후 삽입 (`ROUTINE_ALREADY_COMPLETED_TODAY`)
- Response: `user_routine_id`, `completed`, `logged_at`

### 3.3 `POST /routines/me`

- Request: `{"routine_id": int}`
- `routines` 테이블 존재 확인 → 없으면 404 `ROUTINE_NOT_FOUND`
- 이미 활성화된 동일 루틴이면 409 `ROUTINE_ALREADY_ASSIGNED`
- 신규 `UserRoutine(source="manual", is_active=True)` 삽입

### 3.4 `DELETE /routines/{user_routine_id}`

- 본인 소유 확인 (403 UNAUTHORIZED)
- `is_active = False` 업데이트 (물리 삭제 아님)
- Response: `{"success": true, "data": null, "message": "루틴이 삭제되었습니다."}`

---

## 4. 에러 코드 정의

| 코드 | HTTP | 상황 |
|------|------|------|
| `ROUTINE_NOT_FOUND` | 404 | 존재하지 않는 routines.id |
| `USER_ROUTINE_NOT_FOUND` | 404 | 존재하지 않는 user_routines.id |
| `ROUTINE_ALREADY_ASSIGNED` | 409 | 이미 is_active=True인 동일 루틴 |
| `ROUTINE_ALREADY_COMPLETED_TODAY` | 409 | 오늘 이미 완료 처리됨 |
| `UNAUTHORIZED` | 403 | 본인 소유 아님 |

---

## 5. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | GET /routines/me — 활성 루틴 목록 + is_completed_today 반환 |
| ☐ | PATCH /routines/:id/complete — routine_logs 삽입, 중복 완료 방지 |
| ☐ | POST /routines/me — source="manual" 루틴 추가, 중복 방지 |
| ☐ | DELETE /routines/:id — is_active=False 처리 |
| ☐ | 본인 소유 확인 (403) 전체 엔드포인트 적용 |
| ☐ | main.py 라우터 등록 |

---

## 6. 구현 순서 (Implementation Order)

```
1. app/schemas/routine.py          — 요청/응답 스키마
2. app/api/v1/routines.py          — 4개 엔드포인트
3. app/main.py 수정                — routines 라우터 등록 + 에러 핸들러
4. 검증 시나리오 실행
```

---

## 7. 신규/수정 파일

```
backend/app/
├── schemas/routine.py             # 신규: 요청/응답 스키마
└── api/v1/routines.py             # 신규: 4개 엔드포인트

# 수정
app/main.py                        # routines 라우터 등록 + 에러 핸들러 추가
```

---

## 8. 의존성

```
# 기존 그대로 — 추가 패키지 없음
app/models/routine.py              # Routine, UserRoutine, RoutineLog
app/core/database.py               # get_db
app/dependencies/auth.py           # get_current_user
```

---

## 9. 라우터 순서 주의사항

FastAPI 라우터 순서 충돌 방지:

```
GET  /routines/me          ← 먼저 정의
POST /routines/me          ← 먼저 정의
PATCH /routines/me/order   ← (제외) 먼저 정의해야 함
GET  /routines/{id}        ← 뒤에 정의
PATCH /routines/{id}/complete
DELETE /routines/{id}
```

"me"가 UUID로 파싱되는 충돌 방지 위해 `/me` 경로를 `/{id}` 패턴보다 먼저 등록.

---

## 10. 리스크

| 리스크 | 대응 |
|--------|------|
| `routine_logs` 중복 완료 처리 | `completed_date` + `user_routine_id` 조합으로 당일 중복 확인 |
| GET /me is_completed_today 성능 | 루틴 수가 소수(최대 5~10개)이므로 N+1 쿼리 허용 |
| `category`, `difficulty_level` 미구현 | 해당 컬럼 없음 → API 응답에서 제외, 문서화 |

---

## 참고 문서

- `docs/Bridge_API_명세서.md` — 섹션 6 (루틴 Routines)
- `CLAUDE.md` — DB 주요 테이블 (user_routines, routine_logs)
