# [Report] Phase 2 — Auth Service 완료 보고서

> 작성일: 2026-04-13
> Phase: 2 / 8
> 최종 Match Rate: **98.2%** ✅
> 상태: **완료**

---

## 1. 개요

Bridge 백엔드의 인증 서비스(Auth Service)를 구현하고 검증 완료했다.  
회원가입·로그인·토큰 갱신·로그아웃 4개 엔드포인트와 JWT 인증 미들웨어가 완성되어  
이후 Phase 3~8의 모든 인증이 필요한 API에서 재사용 가능한 상태다.

---

## 2. PDCA 사이클 요약

| 단계 | 결과 |
|------|------|
| Plan | 4개 엔드포인트·보안 요구사항·구현 순서 정의 |
| Design | 파일별 코드 설계 (스키마·보안 유틸·Redis·라우터·미들웨어) |
| Do | 신규 파일 5개 생성, main.py 수정, 전체 시나리오 10개 통과 |
| Check | Match Rate 91.8% → Gap 3건 즉시 수정 → 98.2% 달성 |

---

## 3. 구현 완료 항목

### 3.1 API 엔드포인트

| 엔드포인트 | HTTP | 인증 | 설명 |
|-----------|------|------|------|
| `/v1/auth/register` | POST | 불필요 | 회원가입, Access·Refresh Token 즉시 발급 |
| `/v1/auth/login` | POST | 불필요 | 로그인, bcrypt 검증 후 토큰 발급 |
| `/v1/auth/refresh` | POST | 불필요 | Refresh Token Rotation으로 새 토큰 쌍 발급 |
| `/v1/auth/logout` | POST | 필요 | Refresh Token 블랙리스트 등록 및 세션 삭제 |

### 3.2 신규 생성 파일

| 파일 | 역할 |
|------|------|
| `app/schemas/auth.py` | 요청/응답 Pydantic 스키마 + 공통 응답 래퍼 |
| `app/core/security.py` | bcrypt 해시·검증, JWT 생성·검증, email_hash(SHA-256) |
| `app/core/redis.py` | aioredis 클라이언트, 세션/블랙리스트 헬퍼 |
| `app/api/v1/auth.py` | 4개 엔드포인트 구현 |
| `app/dependencies/auth.py` | `get_current_user` FastAPI 의존성 함수 |

### 3.3 수정 파일

| 파일 | 변경 내용 |
|------|---------|
| `app/main.py` | `/v1/auth` 라우터 등록, `RequestValidationError` 커스텀 핸들러 추가 |
| `requirements.txt` | `passlib[bcrypt]` → `bcrypt==5.0.0` 교체 |

---

## 4. 보안 구현 상세

| 항목 | 구현 내용 |
|------|---------|
| 비밀번호 저장 | bcrypt(rounds=12) 단방향 해시. 평문 미저장 |
| 이메일 저장 | SHA-256 해시(`email_hash`)만 저장. 원문 DB 미저장 |
| JWT 서명 | HS256, `JWT_SECRET_KEY` 환경 변수 관리 |
| Access Token | TTL 1시간, `sub/exp/type` 페이로드 |
| Refresh Token | TTL 14일, `jti`(UUID) 포함 |
| Refresh Token Rotation | 갱신 시 이전 jti 즉시 블랙리스트 등록 |
| Redis 블랙리스트 | key=`blacklist:{jti}`, TTL = 토큰 잔여 만료 시간 |
| Redis 세션 | key=`session:{user_id}`, TTL 14일 |
| 로그아웃 내결함성 | Redis 실패 시에도 200 반환 (토큰 자연 만료에 의존) |

---

## 5. 에러 코드 구현

| 에러 코드 | HTTP | 발생 위치 |
|---------|------|---------|
| `EMAIL_ALREADY_EXISTS` | 409 | register: 이메일 중복 |
| `INVALID_PASSWORD_FORMAT` | 422 | register: 비밀번호 8자 미만 |
| `MISSING_REQUIRED_FIELD` | 422 | 모든 엔드포인트: 필수 필드 누락 |
| `USER_NOT_FOUND` | 401 | login: 미가입 이메일 |
| `INVALID_CREDENTIALS` | 401 | login: 비밀번호 불일치 |
| `INVALID_REFRESH_TOKEN` | 401 | refresh: 만료·블랙리스트·서명 오류 |
| `INVALID_TOKEN` | 401 | 미들웨어: Access Token 오류 |
| `TOKEN_BLACKLISTED` | 401 | 미들웨어: 블랙리스트 토큰 |

---

## 6. 검증 시나리오 결과 (10/10)

| # | 시나리오 | 결과 |
|---|---------|------|
| 1 | 정상 회원가입 → 201 + requires_assessment:true | ✅ |
| 2 | 중복 이메일 → 409 EMAIL_ALREADY_EXISTS | ✅ |
| 3 | 비밀번호 7자 → 422 INVALID_PASSWORD_FORMAT | ✅ |
| 4 | 정상 로그인 → 200 + 토큰 반환 | ✅ |
| 5 | 틀린 비밀번호 → 401 INVALID_CREDENTIALS | ✅ |
| 6 | 없는 이메일 → 401 USER_NOT_FOUND | ✅ |
| 7 | 토큰 갱신 → 200 + 새 토큰 쌍 | ✅ |
| 8 | 이전 Refresh Token 재사용 → 401 INVALID_REFRESH_TOKEN | ✅ |
| 9 | 로그아웃 → 200 성공 | ✅ |
| 10 | 잘못된 Access Token → 401 INVALID_TOKEN | ✅ |

---

## 7. Gap 분석 및 해소 이력

| Gap | 최초 발견 | 해소 여부 | 해소 방법 |
|-----|---------|---------|---------|
| GAP-1: 공통 응답 스키마 미구현 | Check 단계 | ✅ 즉시 해소 | `SuccessResponse[T]` 제네릭 + `response_model` 적용 |
| GAP-2: INVALID_PASSWORD_FORMAT 형식 불일치 | Check 단계 | ✅ 즉시 해소 | `RequestValidationError` 핸들러 추가 |
| GAP-3: MISSING_REQUIRED_FIELD 미구현 | Check 단계 | ✅ 즉시 해소 | 에러 `type==missing` 분기 처리 |
| GAP-4: passlib→bcrypt 문서 동기화 | Do 단계 | 기록 유지 | bcrypt 5.x 호환성 문제로 불가피한 변경, 기능 영향 없음 |

---

## 8. 이슈 및 학습

### bcrypt 5.x + passlib 1.7.4 호환성 문제

- **현상**: `passlib.handlers.bcrypt`의 `detect_wrap_bug()` 함수가 72바이트 초과 테스트 비밀번호로 bcrypt 호출 시 `ValueError` 발생
- **원인**: passlib 1.7.4는 bcrypt 4.x 이상을 공식 지원하지 않음 (bcrypt 5.0.0 설치됨)
- **해결**: passlib 제거, `bcrypt` 라이브러리 직접 사용 (`bcrypt.hashpw`, `bcrypt.checkpw`, `bcrypt.gensalt(rounds=12)`)
- **영향**: 없음. 동일한 bcrypt 알고리즘, 동일한 해시 결과

---

## 9. 다음 Phase 준비 사항

Phase 3 (자가평가 API)에서 `get_current_user` 의존성을 즉시 재사용 가능하다.

```python
# Phase 3 이후 모든 보호 엔드포인트에서 이렇게 사용
from app.dependencies.auth import get_current_user
from app.models.user import User

@router.post("/assessments")
async def create_assessment(
    body: AssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ...
```

---

## 10. 참고 문서

| 문서 | 경로 |
|------|------|
| Plan | `docs/01-plan/features/Phase2-인증.plan.md` |
| Design | `docs/02-design/features/Phase2-인증.design.md` |
| Gap Analysis | `docs/03-analysis/Phase2-인증.analysis.md` |
| API 명세서 | `docs/Bridge_API_명세서.md` (2. 인증 섹션) |
| 시퀀스 다이어그램 | `docs/Bridge_시퀀스다이어그램.md` |
