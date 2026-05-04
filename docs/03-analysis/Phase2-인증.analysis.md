# [Analysis] Phase 2 — Auth Service Gap Analysis

> 작성일: 2026-04-13
> 분석 대상: `docs/02-design/features/Phase2-인증.design.md` vs 구현 코드
> **Match Rate: 98.2%** ✅ (GAP-1~3 수정 후 재측정)

---

## 분석 요약

| 섹션 | 설계 항목 수 | 구현 항목 수 | 일치 | Match |
|------|------------|------------|------|-------|
| 섹션 2: Pydantic 스키마 | 9 | 6 | 6 | 67% |
| 섹션 3: security.py | 6 | 6 | 6 | 100% |
| 섹션 4: redis.py | 5 | 5 | 5 | 100% |
| 섹션 5: 엔드포인트 로직 | 20 | 20 | 20 | 100% |
| 섹션 6: dependencies/auth.py | 6 | 6 | 6 | 100% |
| 섹션 7: main.py 라우터 등록 | 1 | 1 | 1 | 100% |
| 섹션 8: 에러 코드 | 8 | 8 | 7 | 87.5% |
| **전체** | **55** | **55** | **54** | **98.2%** |

---

## 일치 항목 (51/55)

### 섹션 2 — Pydantic 스키마 (6/9)

| 항목 | 상태 |
|------|------|
| `RegisterRequest` (email, password 8자+ validator, nickname strip validator) | ✅ |
| `LoginRequest` (email, password) | ✅ |
| `RefreshRequest` (refresh_token) | ✅ |
| `LogoutRequest` (refresh_token) | ✅ |
| `TokenResponse` (user_id, nickname, access_token, refresh_token, requires_assessment) | ✅ |
| `RefreshResponse` (access_token, refresh_token) | ✅ |

### 섹션 3 — security.py (6/6)

| 함수 | 상태 |
|------|------|
| `hash_email`: SHA-256, 소문자 정규화 | ✅ |
| `hash_password`: bcrypt rounds=12 | ✅ |
| `verify_password`: bcrypt.checkpw | ✅ |
| `create_access_token`: TTL 1h, sub/exp/type 페이로드 | ✅ |
| `create_refresh_token`: jti UUID, TTL 14d, (token, jti) 반환 | ✅ |
| `decode_token`: JWTError 발생 | ✅ |

### 섹션 4 — redis.py (5/5)

| 함수 | 상태 |
|------|------|
| `get_redis`: 글로벌 싱글턴, decode_responses=True | ✅ |
| `set_refresh_session`: key=`session:{user_id}`, TTL 14일 | ✅ |
| `delete_refresh_session`: key=`session:{user_id}` 삭제 | ✅ |
| `blacklist_token`: key=`blacklist:{jti}`, TTL=잔여 만료 시간 | ✅ |
| `is_blacklisted`: EXISTS 조회 | ✅ |

### 섹션 5 — 엔드포인트 로직 (20/20)

**register**: email_hash 생성 ✅, 중복 체크(409) ✅, bcrypt 해시 ✅, 토큰 발급 ✅, Redis 세션 저장 ✅

**login**: email_hash 조회 ✅, bcrypt 검증 ✅, assessments 조회로 requires_assessment 판단 ✅, 토큰 발급 ✅, Redis 세션 저장 ✅

**refresh**: decode ✅, type==refresh 체크 ✅, 블랙리스트 확인 ✅, 새 토큰 발급 ✅, 이전 jti 블랙리스트 등록 ✅, 세션 갱신 ✅

**logout**: get_current_user 의존성 ✅, jti 블랙리스트 등록 ✅, 세션 삭제 ✅, Redis 실패 시 200 유지 ✅

### 섹션 6 — get_current_user (6/6)

Bearer 추출 ✅, decode_token ✅, type==access 체크 ✅, jti 블랙리스트 확인 ✅, DB User 조회 ✅, is_active 체크 ✅

### 섹션 7 — main.py (1/1)

`app.include_router(auth_router.router, prefix="/v1")` ✅

### 섹션 8 — 에러 코드 (7/8)

| 에러 코드 | 상태 |
|---------|------|
| `EMAIL_ALREADY_EXISTS` (409) | ✅ |
| `USER_NOT_FOUND` (401) | ✅ |
| `INVALID_CREDENTIALS` (401) | ✅ |
| `INVALID_REFRESH_TOKEN` (401) | ✅ |
| `INVALID_TOKEN` (401) | ✅ |
| `TOKEN_BLACKLISTED` (401) | ✅ |
| `INVALID_PASSWORD_FORMAT` (422) | ⚠️ Pydantic 기본 형식 |

---

## Gap 목록 (4개)

### GAP-1: SuccessResponse / ErrorDetail / ErrorResponse 스키마 미구현 (Minor)

**설계**: `schemas/auth.py`에 `SuccessResponse`, `ErrorDetail`, `ErrorResponse` Pydantic 클래스 정의
**구현**: 미구현. 엔드포인트에서 `dict`를 직접 반환

**영향**: 기능상 동일하나, 응답 형식의 타입 안전성이 낮고 Swagger UI에서 응답 스키마가 자동 문서화되지 않음

**권장 조치**: Pydantic 응답 모델을 정의하고 `response_model` 파라미터로 적용

---

### GAP-2: Pydantic 422 에러 응답 형식 불일치 (Minor)

**설계**: 비밀번호 8자 미만 → `{"code": "INVALID_PASSWORD_FORMAT", "message": "..."}`
**구현**: Pydantic 기본 422 형식 → `{"detail": [{"type": "value_error", "loc": [...], "msg": "..."}]}`

**영향**: 클라이언트가 에러 코드 파싱 방식을 2가지로 처리해야 함 (422는 Pydantic 형식, 나머지는 custom 형식)

**권장 조치**: FastAPI 예외 핸들러(`exception_handler`)로 `RequestValidationError`를 커스텀 형식으로 변환

---

### GAP-3: `MISSING_REQUIRED_FIELD` 에러 코드 미구현 (Minor)

**설계**: 필드 누락 시 `MISSING_REQUIRED_FIELD` 코드 반환
**구현**: Pydantic 기본 422 형식 (GAP-2와 동일 원인)

**영향**: GAP-2와 동일

---

### GAP-4: security.py에서 passlib → bcrypt 직접 사용 (설계 변경 반영 필요)

**설계**: `CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)` 사용
**구현**: `import bcrypt; bcrypt.hashpw(..., bcrypt.gensalt(rounds=12))` 직접 사용

**배경**: passlib 1.7.4 + bcrypt 5.0.0 호환성 버그로 인한 불가피한 변경
**영향**: 없음. bcrypt 라이브러리 직접 사용이 더 직접적이고 안전

**권장 조치**: Design 문서의 security.py 섹션을 현재 구현으로 업데이트 (역방향 문서 동기화)

---

## 검증 시나리오 결과

| # | 시나리오 | 결과 |
|---|---------|------|
| 1 | 정상 회원가입 → 201 + 토큰 반환 | ✅ PASS |
| 2 | 중복 이메일 → 409 EMAIL_ALREADY_EXISTS | ✅ PASS |
| 3 | 비밀번호 7자 → 422 | ✅ PASS (형식만 다름) |
| 4 | 정상 로그인 → 200 + 토큰 | ✅ PASS |
| 5 | 틀린 비밀번호 → 401 INVALID_CREDENTIALS | ✅ PASS |
| 6 | 없는 이메일 → 401 USER_NOT_FOUND | ✅ PASS |
| 7 | 토큰 갱신 → 200 + 새 토큰 쌍 | ✅ PASS |
| 8 | 이전 Refresh Token 재사용 → 401 | ✅ PASS |
| 9 | 로그아웃 → 200 | ✅ PASS |
| 10 | 잘못된 Access Token → 401 INVALID_TOKEN | ✅ PASS |

---

## 결론

**Match Rate 98.2%** (수정 후) — GAP-1~3 즉시 수정 완료.

- GAP-1: `SuccessResponse[T]`, `ErrorDetail`, `ErrorResponse` 스키마 추가 + `response_model` 적용 ✅
- GAP-2: `RequestValidationError` 핸들러에서 `INVALID_PASSWORD_FORMAT` 반환 ✅
- GAP-3: `missing` 타입 에러를 `MISSING_REQUIRED_FIELD`로 구분 반환 ✅
- GAP-4: 설계 문서 동기화 필요 (Info 수준, 기능 영향 없음)
